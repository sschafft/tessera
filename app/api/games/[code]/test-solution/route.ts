import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { scorePlacements } from "@/lib/scoring/score";
import { publishGameEvent } from "@/lib/realtime/publish";
import type { GoalPattern } from "@/lib/pattern/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Builder-triggered "Test solution". Computes the current score from
 * placements vs goal, flips test_enabled=true so green/red highlights
 * persist on the canvas, and broadcasts so the guider + observer + GM
 * see the result too.
 *
 * Re-runnable any time during a running round — players are expected
 * to test-iterate freely.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.me.role !== "builder") {
    return NextResponse.json(
      { error: "only_builder_can_test" },
      { status: 403 },
    );
  }
  const me = session.me;
  if (!me.pair_id) {
    return NextResponse.json({ error: "not_in_pair" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== session.claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  const round = await repo.findLatestRound(game.id);
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }
  const pairRound = await repo.findPairRound(round.id, me.pair_id);
  if (!pairRound) {
    return NextResponse.json({ error: "no_pair_round" }, { status: 400 });
  }

  const placements = await repo.listPlacements(pairRound.id);
  const goal = (pairRound.goal_pattern as GoalPattern) ?? [];
  const breakdown = scorePlacements(placements, goal, {
    correctPts: game.scoring_correct_pts,
    wrongPts: game.scoring_wrong_pts,
  });

  // Persist test-enabled so the canvas shows correctness highlights
  // even after the celebratory animation fades.
  if (!pairRound.test_enabled) {
    await repo.setTestEnabled(pairRound.id, true);
  }

  await publishGameEvent(game.id, "solution_tested", {
    pair_id: me.pair_id,
    correct: breakdown.correct,
    wrong: breakdown.wrong,
    score: breakdown.score,
  });

  // Per-piece correctness map keyed by placement id, so the BuilderView
  // can highlight green/red instantly without waiting for the next /play
  // refetch (which has realtime broadcast latency).
  const correctness: Record<string, boolean> = {};
  for (const sp of breakdown.placements) correctness[sp.id] = sp.correct;

  return NextResponse.json({
    ok: true,
    correct: breakdown.correct,
    wrong: breakdown.wrong,
    total: breakdown.total,
    score: breakdown.score,
    penalty_applied: breakdown.penaltyApplied,
    correct_pts: game.scoring_correct_pts,
    wrong_pts: game.scoring_wrong_pts,
    correctness,
    tested_at: new Date().toISOString(),
  });
}
