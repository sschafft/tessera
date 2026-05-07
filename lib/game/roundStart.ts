import "server-only";

import { generatePattern } from "@/lib/pattern/generator";
import {
  GeminiBriefFailedError,
  pickBrief,
} from "@/lib/briefs/orchestrator";
import type { PickedBrief } from "@/lib/briefs/library";
import { publishGameEvent } from "@/lib/realtime/publish";
import type {
  BriefRole,
  BriefSource,
  GameRecord,
  GameRepository,
} from "./repository";

/**
 * Shared round-start orchestrator. Single source of truth for the
 * preflight → commit pipeline both `/api/games/[code]/rounds/start`
 * and `/api/games/[code]/replay` use.
 *
 * Why this exists: the 2026-05-04 tessera-tl review caught the replay
 * route forking the lifecycle and dropping every safeguard the start
 * route earned across multiple incidents — round-running gate, AI
 * preflight, parallel builder/guider picks, cross-pair title dedup,
 * typed Gemini-failed return path. Centralising the logic means
 * either route inherits the next safeguard automatically.
 *
 * Flow:
 *   1. Verify there's at least one pair.
 *   2. Refuse if a round is already running (409).
 *   3. Drop a stale `pending` round (orphan from a prior failed start).
 *   4. Compute nextIndex and round config (complexity, duration).
 *   5. Preflight: generate every (goal, builder brief, guider brief)
 *      tuple in memory. Builder + guider picks within a pair fan out
 *      in parallel; pairs themselves stay sequential so cross-pair
 *      title dedup keeps working. If any AI brief fails and library
 *      fallback isn't allowed, return a typed gemini_failed result
 *      without touching the DB.
 *   6. Commit: create the round + per-pair rows + briefs, then mark
 *      the round running, set the game to running (clears ended_at as
 *      a side effect — see setGameStatus), and publish round_started.
 */

export interface StartRoundOptions {
  /** Override complexity. Defaults to `game.default_complexity`. */
  complexity?: number;
  /**
   * Override duration in seconds. Falls back to
   * `game.round_duration_seconds`; ignored when < 60.
   */
  duration_seconds?: number;
  /**
   * Force both sides to a single brief source for this round. The GM
   * uses this on retry after a Gemini failure ('library'), or to
   * downgrade to presets without re-editing the game. Setting this
   * also enables silent library fallback inside `pickBrief` so
   * overrides keep working through transient AI outages.
   */
  briefSourceOverride?: BriefSource;
}

export interface StartRoundSuccess {
  ok: true;
  round_id: string;
  index: number;
  complexity: number;
  duration_seconds: number;
  pairs: number;
}

export type StartRoundError =
  | { ok: false; kind: "no_pairs" }
  | { ok: false; kind: "round_already_running"; round_id: string }
  | { ok: false; kind: "gemini_failed"; failed_role: BriefRole; reason: string }
  | { ok: false; kind: "game_purged" };

export type StartRoundResult = StartRoundSuccess | StartRoundError;

interface PreparedPair {
  pair_id: string;
  seed: string;
  goal: unknown;
  builder?: PickedBrief;
  guider?: PickedBrief;
}

export async function startRound(
  repo: GameRepository,
  game: GameRecord,
  options: StartRoundOptions = {},
): Promise<StartRoundResult> {
  if (game.status === "purged") return { ok: false, kind: "game_purged" };

  const pairs = await repo.pairs.list(game.id);
  if (pairs.length === 0) return { ok: false, kind: "no_pairs" };

  const latest = await repo.rounds.findLatest(game.id);
  if (latest && latest.status === "running") {
    return {
      ok: false,
      kind: "round_already_running",
      round_id: latest.id,
    };
  }
  // A pending round is an orphan from a prior failed Start (e.g.
  // Gemini timeout / DB blip). Drop it so the GM can retry cleanly.
  if (latest && latest.status === "pending") {
    await repo.rounds.delete(latest.id);
  }

  const previousIndex =
    latest && latest.status === "ended" ? latest.index : 0;
  const nextIndex = previousIndex + 1;

  const complexity = clamp(
    options.complexity ?? game.default_complexity,
    1,
    8,
  );
  const duration =
    options.duration_seconds && options.duration_seconds >= 60
      ? options.duration_seconds
      : game.round_duration_seconds;

  const builderSource: BriefSource =
    options.briefSourceOverride ?? game.builder_brief_source;
  const guiderSource: BriefSource =
    options.briefSourceOverride ?? game.guider_brief_source;
  const allowFallback = options.briefSourceOverride !== undefined;

  // ─── Preflight: build every (goal, builder, guider) tuple in
  // ─── memory. If any AI brief fails and fallback isn't allowed,
  // ─── return a typed result without persisting anything.
  //
  // Per-pair brief overrides (set at game-create via the CSV upload
  // flow) preempt pickBrief on round 1 only. The override columns
  // are cleared after commit so round 2+ run the normal flow. We
  // track which pairs consumed an override so the post-commit
  // cleanup loop knows which rows to nuke.
  const usedBuilderTitles: string[] = [];
  const usedGuiderTitles: string[] = [];
  const prepared: PreparedPair[] = [];
  const pairsWithConsumedOverride: string[] = [];
  const isFirstRound = nextIndex === 1;
  try {
    for (const pair of pairs) {
      const seed = `${game.id}:${nextIndex}:${pair.id}:${Date.now()}`;
      const goal = generatePattern({ complexity, seed });
      const entry: PreparedPair = { pair_id: pair.id, seed, goal };

      // Override-aware brief selection. When the GM seeded a brief
      // for this side AND it's round 1, the seed wins; otherwise
      // fall through to pickBrief. Either or both sides can be
      // overridden independently.
      const builderOverride = isFirstRound ? pair.builder_brief_override : null;
      const guiderOverride = isFirstRound ? pair.guider_brief_override : null;

      const builderBriefP = !game.builder_brief_on
        ? Promise.resolve(undefined)
        : builderOverride
          ? Promise.resolve({
              source: "gm" as const,
              title: builderOverride.title,
              rules: builderOverride.rules,
            })
          : pickBrief({
              role: "builder",
              complexity,
              source: builderSource,
              game_id: game.id,
              custom: game.builder_brief_custom,
              exclude_titles: usedBuilderTitles,
              allow_library_fallback: allowFallback,
            });

      const guiderBriefP = !game.guider_brief_on
        ? Promise.resolve(undefined)
        : guiderOverride
          ? Promise.resolve({
              source: "gm" as const,
              title: guiderOverride.title,
              rules: guiderOverride.rules,
            })
          : pickBrief({
              role: "guider",
              complexity,
              source: guiderSource,
              game_id: game.id,
              custom: game.guider_brief_custom,
              exclude_titles: usedGuiderTitles,
              allow_library_fallback: allowFallback,
            });

      const [builderBrief, guiderBrief] = await Promise.all([
        builderBriefP,
        guiderBriefP,
      ]);
      if (builderBrief) {
        entry.builder = builderBrief;
        usedBuilderTitles.push(builderBrief.title);
      }
      if (guiderBrief) {
        entry.guider = guiderBrief;
        usedGuiderTitles.push(guiderBrief.title);
      }
      if (builderOverride || guiderOverride) {
        pairsWithConsumedOverride.push(pair.id);
      }
      prepared.push(entry);
    }
  } catch (err) {
    if (err instanceof GeminiBriefFailedError) {
      return {
        ok: false,
        kind: "gemini_failed",
        failed_role: err.role,
        reason: err.reason,
      };
    }
    throw err;
  }

  // ─── Commit: write round + per-pair rows + briefs.
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
  // setStatus also clears games.ended_at when transitioning to
  // running — important for the replay path where the game was
  // already ended before this call.
  await repo.games.setStatus(game.id, "running");

  // Clear consumed brief overrides so round 2+ falls back to the
  // game-level brief source. Best-effort: a transient failure here
  // means the override leaks into round 2, which is annoying but
  // not destructive — the GM can re-roll. The round itself is
  // already committed, so we don't surface this as a route error.
  for (const pair_id of pairsWithConsumedOverride) {
    try {
      await repo.pairs.clearBriefOverrides(pair_id);
    } catch (err) {
      console.warn(
        `[roundStart] failed to clear brief override for pair ${pair_id}:`,
        err,
      );
    }
  }

  await publishGameEvent(game.id, "round_started");

  return {
    ok: true,
    round_id: round.id,
    index: round.index,
    complexity: round.complexity,
    duration_seconds: round.duration_seconds,
    pairs: pairs.length,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
