import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { scorePlacements } from "@/lib/scoring/score";
import type { GoalPattern } from "@/lib/pattern/types";
import type { PairRoundRecord } from "@/lib/game/repository";
import { aggregateFrictionByRound } from "@/lib/game/frictionAggregate";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Per-pair leaderboard for the game's debrief. Computes total score
 * across every round the game played, plus a "latest round" snapshot
 * (correct/total/placed) for the legacy mid-round status display.
 *
 * Anyone in the game can read this — once the game ends, there's
 * nothing to hide. The session is required only so we know they're a
 * legit participant.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const claims = await readSessionForGame(code);
  if (!claims) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const pairs = await repo.pairs.list(game.id);
  const allRounds = await repo.rounds.list(game.id);
  const latestRound = allRounds[allRounds.length - 1] ?? null;
  const allParticipants = await repo.participants.listActive(game.id);
  const byId = new Map(allParticipants.map((p) => [p.id, p]));

  // Pre-fetch every round's pair_rounds, then the placements for the
  // whole set in one batched call. Was previously a per-pair × per-
  // round nested fetch — at a 25-pair × 3-round game that's 150
  // round-trips per /summary call. Now it's `rounds.length` listForRound
  // queries + 1 placements.listByPairRoundIds = 4. Mirrors the same
  // pattern landed for the GM lobby route in PR #89.
  const pairRoundsByRound = new Map<string, PairRoundRecord[]>();
  const allPairRoundIds: string[] = [];
  await Promise.all(
    allRounds.map(async (round) => {
      const list = await repo.pairRounds.listForRound(round.id);
      pairRoundsByRound.set(round.id, list);
      for (const pr of list) allPairRoundIds.push(pr.id);
    }),
  );
  const placementsByPairRoundId =
    await repo.placements.listByPairRoundIds(allPairRoundIds);

  const summary: Array<{
    pair_id: string;
    builder: string | null;
    guider: string | null;
    /** Latest-round snapshot (mid-round display). */
    correct: number;
    total: number;
    placed: number;
    extras: number;
    complete: boolean;
    /** Cumulative score across every round in this game. */
    total_score: number;
    /** Per-round score breakdown for the leaderboard tooltip / detail row. */
    rounds: Array<{
      index: number;
      correct: number;
      total: number;
      score: number;
    }>;
  }> = [];

  // Mid-game leak gate: while the game is still running, the
  // builder / guider / observer learn correctness only via the
  // builder's "Test solution" tap (which sets pair_round.test_enabled
  // = true). /summary previously returned correct / placed / total
  // for every pair regardless, which let any participant query the
  // route mid-round and see how every pair was doing — defeating
  // the point of the test-enabled gate. Now we expose per-round
  // correctness only when (a) the round has ended, OR (b) test was
  // explicitly enabled on that pair_round. Score and total counts
  // remain hidden too since they're derived from `correct`.
  const gameEnded = game.status === "ended";

  // Build a (round_id → pair_id → pair_round) lookup so the per-pair
  // inner loop is an in-memory join, not another fetch.
  const pairRoundsByRoundAndPair = new Map<
    string,
    Map<string, PairRoundRecord>
  >();
  for (const [round_id, list] of pairRoundsByRound) {
    const inner = new Map<string, PairRoundRecord>();
    for (const pr of list) inner.set(pr.pair_id, pr);
    pairRoundsByRoundAndPair.set(round_id, inner);
  }

  const pairResults = pairs.map((pair) => {
      const builder = pair.builder_id ? byId.get(pair.builder_id) : undefined;
      const guider = pair.guider_id ? byId.get(pair.guider_id) : undefined;
      const roundResults = allRounds.map((round) => {
          const pr = pairRoundsByRoundAndPair.get(round.id)?.get(pair.id);
          if (!pr) return null;
          const goal = (pr.goal_pattern as GoalPattern) ?? [];
          const placements = placementsByPairRoundId.get(pr.id) ?? [];
          const breakdown = scorePlacements(placements, goal, {
            correctPts: game.scoring_correct_pts,
            wrongPts: game.scoring_wrong_pts,
          });
          return {
            round_id: round.id,
            round_index: round.index,
            round_status: round.status,
            test_enabled: pr.test_enabled,
            placements_count: placements.length,
            breakdown,
          };
        });
      let correct = 0;
      let placed = 0;
      let total = 0;
      let totalScore = 0;
      const perRound: Array<{
        index: number;
        correct: number;
        total: number;
        score: number;
      }> = [];
      for (const r of roundResults) {
        if (!r) continue;
        const reveal =
          gameEnded || r.round_status === "ended" || r.test_enabled;
        // total_score is preserved across all rounds — it's the
        // headline leaderboard number and the round needs to have
        // happened for it to count, which the score already encodes.
        // (Score is 0 if there are no placements.)
        if (reveal) {
          totalScore += r.breakdown.score;
          perRound.push({
            index: r.round_index,
            correct: r.breakdown.correct,
            total: r.breakdown.total,
            score: r.breakdown.score,
          });
        }
        if (latestRound && r.round_id === latestRound.id && reveal) {
          correct = r.breakdown.correct;
          placed = r.placements_count;
          total = r.breakdown.total;
        }
      }
      const extras = Math.max(0, placed - correct);
      return {
        pair_id: pair.id,
        // Self-chosen pair name surfaces on the leaderboard when set;
        // null when the pair never named themselves (UI falls back to
        // the participant pair label).
        display_name: pair.display_name,
        builder: builder?.display_name ?? null,
        guider: guider?.display_name ?? null,
        correct,
        total,
        placed,
        extras,
        complete: total > 0 && correct === total && placed === total,
        total_score: totalScore,
        rounds: perRound,
      };
    });
  summary.push(...pairResults);

  // Sort by total_score desc, then completeness, then accuracy ratio.
  summary.sort((a, b) => {
    if (a.total_score !== b.total_score) return b.total_score - a.total_score;
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    const ra = a.total > 0 ? a.correct / a.total : 0;
    const rb = b.total > 0 ? b.correct / b.total : 0;
    return rb - ra;
  });

  // Per-round survey aggregate. Surfaces what pair players self-
  // reported about who carried the conversation + how the round's
  // friction split across self / partner / system. Anonymised — only
  // counts + averages, no individual responses, and rounds with
  // fewer than 4 responses suppress entirely (see
  // MIN_RESPONSES_FOR_AGGREGATE in lib/game/frictionAggregate).
  const surveysByRound = await Promise.all(
    allRounds.map(async (round) => ({
      round,
      responses: await repo.roundSurveys.listForRound(round.id),
    })),
  );
  // Role lookup feeds the by-role split inside the aggregator. The
  // GM dashboard's `byId` map is built from listActive participants
  // above; reuse it but narrow to builder/guider since observers
  // don't fill the survey anyway.
  const roleByParticipantId = new Map<string, "builder" | "guider">();
  for (const p of allParticipants) {
    if (p.role === "builder" || p.role === "guider") {
      roleByParticipantId.set(p.id, p.role);
    }
  }
  // The aggregator returns { rounds, suppressed } — qualifying rounds
  // (>= MIN_RESPONSES_FOR_AGGREGATE) and rounds that got responses
  // but didn't clear the anonymity floor. We surface both so the
  // GameEndedView can show a "below the floor" hint when the GM's
  // expecting an aggregate that won't render.
  const surveyAggregate = aggregateFrictionByRound(
    surveysByRound.map(({ round, responses }) => ({
      round_id: round.id,
      round_index: round.index,
      responses,
      roleByParticipantId,
    })),
  );
  const surveys = surveyAggregate.rounds;
  const surveysSuppressed = surveyAggregate.suppressed;

  return NextResponse.json({
    code,
    workshop_name: game.workshop_name,
    video_call_url: game.video_call_url,
    whiteboard_url: game.whiteboard_url ?? null,
    round_index: latestRound?.index ?? null,
    scoring: {
      correct_pts: game.scoring_correct_pts,
      wrong_pts: game.scoring_wrong_pts,
    },
    pairs: summary,
    surveys,
    surveys_suppressed: surveysSuppressed,
  });
}
