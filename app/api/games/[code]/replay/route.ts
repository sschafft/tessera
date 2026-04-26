import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { generatePattern } from "@/lib/pattern/generator";
import { pickBrief } from "@/lib/briefs/orchestrator";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Replay the game with the same pairs and players. Starts a fresh
 * round even if game.status was 'ended'. Used by the GM's "Start
 * another round" CTA on the end-game summary.
 */
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

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "purged") {
    return NextResponse.json({ error: "game_purged" }, { status: 410 });
  }

  const pairs = await repo.listPairs(game.id);
  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "no_pairs", message: "Allocate at least one pair before replaying." },
      { status: 400 },
    );
  }

  // Reopen the game if it had ended.
  if (game.status === "ended") {
    await repo.setGameStatus(game.id, "running");
  }

  // Pick the next round index, extending round_count if we'd otherwise
  // hit the all_rounds_complete cap.
  const latest = await repo.findLatestRound(game.id);
  const nextIndex = (latest?.index ?? 0) + 1;
  // (round_count is just a planning ceiling; bumping it is the cheapest
  // way to allow another round without a schema change.)

  const complexity = game.default_complexity;
  const duration = game.round_duration_seconds;

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
    if (game.builder_brief_on) {
      const brief = await pickBrief({
        role: "builder",
        complexity,
        source: game.builder_brief_source,
        game_id: game.id,
        custom: game.builder_brief_custom,
      });
      await repo.upsertBrief({
        pair_round_id: pairRound.id,
        role: "builder",
        source: brief.source,
        title: brief.title,
        rules: brief.rules,
      });
    }
    if (game.guider_brief_on) {
      const brief = await pickBrief({
        role: "guider",
        complexity,
        source: game.guider_brief_source,
        game_id: game.id,
        custom: game.guider_brief_custom,
      });
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
  void publishGameEvent(game.id, "round_started");

  return NextResponse.json({
    ok: true,
    round_id: round.id,
    index: round.index,
    complexity: round.complexity,
    duration_seconds: round.duration_seconds,
    pairs: pairs.length,
  });
}
