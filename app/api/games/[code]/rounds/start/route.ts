import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { generatePattern } from "@/lib/pattern/generator";
import {
  GeminiBriefFailedError,
  pickBrief,
} from "@/lib/briefs/orchestrator";
import type { PickedBrief } from "@/lib/briefs/library";
import type { BriefSource } from "@/lib/game/repository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const maxDuration = 30;

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface StartPayload {
  /** Optional override; defaults to the game's default_complexity. */
  complexity?: number;
  /** Optional override; defaults to the game's round_duration_seconds. */
  duration_seconds?: number;
  /**
   * Override the brief source for both sides for this round. The GM
   * sets this when retrying after a Gemini failure ('library'), or
   * when explicitly downgrading to presets without re-editing the
   * game. Falls through to game.{builder,guider}_brief_source when
   * absent.
   */
  brief_source_override?: BriefSource;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const claims = await readSessionForGame(code);
  if (!claims) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (claims.role !== "gm") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: StartPayload = {};
  try {
    body = (await req.json()) as StartPayload;
  } catch {
    // Empty body is fine.
  }
  const briefOverride: BriefSource | undefined =
    body.brief_source_override === "library" ||
    body.brief_source_override === "gm" ||
    body.brief_source_override === "gemini"
      ? body.brief_source_override
      : undefined;

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const pairs = await repo.pairs.list(game.id);
  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "no_pairs", message: "Allocate at least one pair first." },
      { status: 400 },
    );
  }

  const latest = await repo.rounds.findLatest(game.id);
  if (latest && latest.status === "running") {
    return NextResponse.json(
      { error: "round_already_running", round_id: latest.id },
      { status: 409 },
    );
  }
  // A pending round is an orphan from a prior failed Start (e.g.
  // Gemini timeout). Drop it so the GM can retry cleanly.
  if (latest && latest.status === "pending") {
    await repo.rounds.delete(latest.id);
  }
  const nextIndex =
    (latest && latest.status === "ended" ? latest.index : 0) + 1;
  // round_count is a *planned* count — the GM can keep going past it
  // if the room is still engaged. No hard cap server-side.

  const complexity = clamp(body.complexity ?? game.default_complexity, 1, 8);
  const duration =
    body.duration_seconds && body.duration_seconds >= 60
      ? body.duration_seconds
      : game.round_duration_seconds;

  const builderSource: BriefSource =
    briefOverride ?? game.builder_brief_source;
  const guiderSource: BriefSource =
    briefOverride ?? game.guider_brief_source;
  // Only fall back silently when the GM has explicitly chosen the
  // override (so re-rolls / overrides keep working even if Gemini
  // hiccups). For the default Start path, surface the failure so the
  // GM can choose between library / custom / retry.
  const allowFallback = briefOverride !== undefined;

  // ─── Preflight: generate every brief in memory before we touch the
  // ─── DB. If any Gemini call fails we'll return 502 cleanly without
  // ─── leaving an orphan round behind.
  type PreparedPair = {
    pair_id: string;
    seed: string;
    goal: unknown;
    builder?: PickedBrief;
    guider?: PickedBrief;
  };
  // Track which titles have already been handed out in this round so
  // the picker dedups across pairs. Playtest with 3 pairs surfaced two
  // pairs receiving the same library brief — boring for the workshop.
  const usedBuilderTitles: string[] = [];
  const usedGuiderTitles: string[] = [];

  const prepared: PreparedPair[] = [];
  try {
    for (const pair of pairs) {
      const seed = `${game.id}:${nextIndex}:${pair.id}:${Date.now()}`;
      const goal = generatePattern({ complexity, seed });
      const entry: PreparedPair = { pair_id: pair.id, seed, goal };
      // Parallelise builder + guider brief picks within the pair —
      // they're independent (different roles, separate Gemini budget
      // reservations). Cuts each pair's wall-clock from
      // builder-then-guider ≈ 4–8s sequential to max(builder, guider)
      // ≈ 2–4s. With 4 pairs that's the difference between 16–32s
      // (risks blowing maxDuration=30) and 8–16s.
      //
      // Pairs themselves stay sequential so the cross-pair
      // exclude_titles dedup keeps working — the next pair's
      // pick sees the previous pair's title.
      const [builderBrief, guiderBrief] = await Promise.all([
        game.builder_brief_on
          ? pickBrief({
              role: "builder",
              complexity,
              source: builderSource,
              game_id: game.id,
              custom: game.builder_brief_custom,
              exclude_titles: usedBuilderTitles,
              allow_library_fallback: allowFallback,
            })
          : Promise.resolve(undefined),
        game.guider_brief_on
          ? pickBrief({
              role: "guider",
              complexity,
              source: guiderSource,
              game_id: game.id,
              custom: game.guider_brief_custom,
              exclude_titles: usedGuiderTitles,
              allow_library_fallback: allowFallback,
            })
          : Promise.resolve(undefined),
      ]);
      if (builderBrief) {
        entry.builder = builderBrief;
        usedBuilderTitles.push(builderBrief.title);
      }
      if (guiderBrief) {
        entry.guider = guiderBrief;
        usedGuiderTitles.push(guiderBrief.title);
      }
      prepared.push(entry);
    }
  } catch (err) {
    if (err instanceof GeminiBriefFailedError) {
      return NextResponse.json(
        {
          error: "gemini_failed",
          failed_role: err.role,
          reason: err.reason,
        },
        { status: 502 },
      );
    }
    throw err;
  }

  // ─── Commit: now that briefs are guaranteed, write the round + per-
  // ─── pair rows. Failures here are rare (DB outages) and would still
  // ─── leave a pending round; the next Start retries it (delete-then-
  // ─── create above).
  const round = await repo.rounds.create({
    game_id: game.id,
    index: nextIndex,
    complexity,
    duration_seconds: duration,
  });

  for (const p of prepared) {
    const pairRound = await repo.pairRounds.create({
      round_id: round.id,
      pair_id: p.pair_id,
      goal_pattern: p.goal,
      pattern_seed: p.seed,
    });
    if (p.builder) {
      await repo.briefs.upsert({
        pair_round_id: pairRound.id,
        role: "builder",
        source: p.builder.source,
        title: p.builder.title,
        rules: p.builder.rules,
      });
    }
    if (p.guider) {
      await repo.briefs.upsert({
        pair_round_id: pairRound.id,
        role: "guider",
        source: p.guider.source,
        title: p.guider.title,
        rules: p.guider.rules,
      });
    }
  }

  await repo.rounds.start(round.id);
  await repo.games.setStatus(game.id, "running");
  await publishGameEvent(game.id, "round_started");

  return NextResponse.json({
    ok: true,
    round_id: round.id,
    index: round.index,
    complexity: round.complexity,
    duration_seconds: round.duration_seconds,
    pairs: pairs.length,
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
