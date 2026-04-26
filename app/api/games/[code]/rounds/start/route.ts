import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { generatePattern } from "@/lib/pattern/generator";
import { pickLibraryBrief } from "@/lib/briefs/library";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface StartPayload {
  /** Optional override; defaults to the game's default_complexity. */
  complexity?: number;
  /** Optional override; defaults to the game's round_duration_seconds. */
  duration_seconds?: number;
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

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const pairs = await repo.listPairs(game.id);
  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "no_pairs", message: "Allocate at least one pair first." },
      { status: 400 },
    );
  }

  const latest = await repo.findLatestRound(game.id);
  if (latest && latest.status === "running") {
    return NextResponse.json(
      { error: "round_already_running", round_id: latest.id },
      { status: 409 },
    );
  }
  const nextIndex = (latest?.index ?? 0) + 1;
  if (nextIndex > game.round_count) {
    return NextResponse.json(
      { error: "all_rounds_complete" },
      { status: 409 },
    );
  }

  const complexity = clamp(body.complexity ?? game.default_complexity, 1, 8);
  const duration =
    body.duration_seconds && body.duration_seconds >= 60
      ? body.duration_seconds
      : game.round_duration_seconds;

  // Create the round (status='pending') then per-pair patterns.
  const round = await repo.createRound({
    game_id: game.id,
    index: nextIndex,
    complexity,
    duration_seconds: duration,
  });

  for (const pair of pairs) {
    const seed = `${game.id}:${round.id}:${pair.id}`;
    const goal = generatePattern({ complexity, seed });
    const pairRound = await repo.createPairRound({
      round_id: round.id,
      pair_id: pair.id,
      goal_pattern: goal,
      pattern_seed: seed,
    });

    // Brief generation per pair, gated by per-side toggles. Only the
    // 'library' source is wired in M5; 'gemini' / 'gm' source paths
    // ship in M5.5 and M5.6.
    if (game.builder_brief_on) {
      // GM-authored briefs (source='gm') skip the library; library
      // is the fallback if the source is library or the GM didn't
      // actually fill in a custom brief.
      const useCustom =
        game.builder_brief_source === "gm" && game.builder_brief_custom;
      const brief = useCustom
        ? {
            source: "gm" as const,
            title: game.builder_brief_custom!.title,
            rules: game.builder_brief_custom!.rules,
          }
        : await pickLibraryBrief({ role: "builder", complexity });
      await repo.upsertBrief({
        pair_round_id: pairRound.id,
        role: "builder",
        source: brief.source,
        title: brief.title,
        rules: brief.rules,
      });
    }
    if (game.guider_brief_on) {
      const useCustom =
        game.guider_brief_source === "gm" && game.guider_brief_custom;
      const brief = useCustom
        ? {
            source: "gm" as const,
            title: game.guider_brief_custom!.title,
            rules: game.guider_brief_custom!.rules,
          }
        : await pickLibraryBrief({ role: "guider", complexity });
      await repo.upsertBrief({
        pair_round_id: pairRound.id,
        role: "guider",
        source: brief.source,
        title: brief.title,
        rules: brief.rules,
      });
    }
  }

  await repo.startRound(round.id);
  await repo.setGameStatus(game.id, "running");

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
