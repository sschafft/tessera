import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { scorePlacements } from "@/lib/scoring/score";
import type { GoalPattern } from "@/lib/pattern/types";

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
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const pairs = await repo.listPairs(game.id);
  const allRounds = await repo.listRounds(game.id);
  const latestRound = allRounds[allRounds.length - 1] ?? null;
  const allParticipants = await repo.listActiveParticipants(game.id);
  const byId = new Map(allParticipants.map((p) => [p.id, p]));

  // Pre-fetch all pair_rounds + placements grouped by round, so the
  // leaderboard summation is O(rounds × pairs) without N+1 round trips
  // mid-loop.
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

  // Parallelise the per-pair per-round fetch — was sequential
  // pairs × rounds × 2 awaits, blew the dashboard / debrief load
  // budget on long games. Same shape, batched.
  const pairResults = await Promise.all(
    pairs.map(async (pair) => {
      const builder = pair.builder_id ? byId.get(pair.builder_id) : undefined;
      const guider = pair.guider_id ? byId.get(pair.guider_id) : undefined;
      const roundResults = await Promise.all(
        allRounds.map(async (round) => {
          const pr = await repo.findPairRound(round.id, pair.id);
          if (!pr) return null;
          const goal = (pr.goal_pattern as GoalPattern) ?? [];
          const placements = await repo.listPlacements(pr.id);
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
        }),
      );
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
    }),
  );
  summary.push(...pairResults);

  // Sort by total_score desc, then completeness, then accuracy ratio.
  summary.sort((a, b) => {
    if (a.total_score !== b.total_score) return b.total_score - a.total_score;
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    const ra = a.total > 0 ? a.correct / a.total : 0;
    const rb = b.total > 0 ? b.correct / b.total : 0;
    return rb - ra;
  });

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
  });
}
