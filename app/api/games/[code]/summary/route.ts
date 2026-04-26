import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import type { GoalPattern } from "@/lib/pattern/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Per-pair leaderboard for the game's debrief. Computes final accuracy
 * for each pair on the most recent ended (or running) round.
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
  const round = await repo.findLatestRound(game.id);
  const allParticipants = await repo.listActiveParticipants(game.id);
  const byId = new Map(allParticipants.map((p) => [p.id, p]));

  const summary: Array<{
    pair_id: string;
    builder: string | null;
    guider: string | null;
    correct: number;
    total: number;
    placed: number;
    extras: number;
    complete: boolean;
  }> = [];
  for (const pair of pairs) {
    const builder = pair.builder_id ? byId.get(pair.builder_id) : undefined;
    const guider = pair.guider_id ? byId.get(pair.guider_id) : undefined;
    let correct = 0;
    let placed = 0;
    let total = 0;
    if (round) {
      const pr = await repo.findPairRound(round.id, pair.id);
      if (pr) {
        const goal = (pr.goal_pattern as GoalPattern) ?? [];
        total = goal.length;
        const placements = await repo.listPlacements(pr.id);
        placed = placements.length;
        const goalKey = (g: { shape: string; color: string; q: number; r: number; rot: number }) =>
          `${g.shape}|${g.color}|${g.q},${g.r}|${g.rot}`;
        const goalSet = new Set(goal.map(goalKey));
        for (const p of placements) {
          if (goalSet.has(goalKey(p))) correct += 1;
        }
      }
    }
    const extras = Math.max(0, placed - correct);
    summary.push({
      pair_id: pair.id,
      builder: builder?.display_name ?? null,
      guider: guider?.display_name ?? null,
      correct,
      total,
      placed,
      extras,
      complete: total > 0 && correct === total && placed === total,
    });
  }

  // Sort by accuracy desc (complete first, then by correct/total ratio).
  summary.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    const ra = a.total > 0 ? a.correct / a.total : 0;
    const rb = b.total > 0 ? b.correct / b.total : 0;
    return rb - ra;
  });

  return NextResponse.json({
    code,
    workshop_name: game.workshop_name,
    round_index: round?.index ?? null,
    pairs: summary,
  });
}
