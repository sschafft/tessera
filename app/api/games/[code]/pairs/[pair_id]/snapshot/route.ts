import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import type { GoalPattern } from "@/lib/pattern/types";
import { scorePlacements } from "@/lib/scoring/score";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; pair_id: string }>;
}

/**
 * GM-only "observe a pair" snapshot. Returns the focused pair's
 * canvas state (goal + placements + per-piece correctness), both
 * briefs, and round info, so the master dashboard can show a live
 * preview of what the pair is doing without the GM losing access to
 * their accelerant rail.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { code, pair_id } = await params;
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
  const pair = await repo.findPairById(pair_id);
  if (!pair || pair.game_id !== game.id) {
    return NextResponse.json({ error: "pair_not_found" }, { status: 404 });
  }

  // Resolve player names from the pair regardless of round state, so
  // the GM's focused-pair heading reads "Avery ↔ Bri" before Start
  // is clicked, not "? ↔ ?".
  const builder =
    pair.builder_id ? await repo.findParticipantById(pair.builder_id) : null;
  const guider =
    pair.guider_id ? await repo.findParticipantById(pair.guider_id) : null;

  const round = await repo.findLatestRound(game.id);
  if (!round) {
    return NextResponse.json({
      pair_id,
      round: null,
      goal: [],
      placements: [],
      accuracy: null,
      builder_name: builder?.display_name ?? null,
      builder_color: builder?.color ?? null,
      guider_name: guider?.display_name ?? null,
      guider_color: guider?.color ?? null,
      builder_brief: null,
      guider_brief: null,
    });
  }

  const pairRound = await repo.findPairRound(round.id, pair_id);

  const goal: GoalPattern = pairRound
    ? ((pairRound.goal_pattern as GoalPattern) ?? [])
    : [];
  const placementsRaw = pairRound
    ? await repo.listPlacements(pairRound.id)
    : [];

  // Per-piece correctness — always computed for the GM. Route through
  // the canonical scorer so rotation symmetry (squares look identical
  // at every rot, rhombi at rot mod 2) is normalised the same way as
  // /test-solution and /play. Inlining a goalKey here was the same
  // anti-pattern design_patterns.md > "Single source of truth for
  // scoring" calls out.
  const breakdown = scorePlacements(placementsRaw, goal, {
    correctPts: game.scoring_correct_pts,
    wrongPts: game.scoring_wrong_pts,
  });
  const correctById = new Map(
    breakdown.placements.map((p) => [p.id, p.correct]),
  );
  const correct = breakdown.correct;
  const placements = placementsRaw.map((p) => ({
    id: p.id,
    shape: p.shape,
    color: p.color,
    q: p.q,
    r: p.r,
    rot: p.rot,
    correct: correctById.get(p.id) ?? false,
  }));

  const briefs = pairRound
    ? await repo.listBriefsForPairRound(pairRound.id)
    : [];
  const builderBrief = briefs.find((b) => b.role === "builder") ?? null;
  const guiderBrief = briefs.find((b) => b.role === "guider") ?? null;

  return NextResponse.json({
    pair_id,
    round: {
      id: round.id,
      index: round.index,
      complexity: round.complexity,
      status: round.status,
      duration_seconds: round.duration_seconds,
      started_at: round.started_at,
      ended_at: round.ended_at,
    },
    goal,
    placements,
    accuracy: { correct, total: goal.length },
    builder_name: builder?.display_name ?? null,
    builder_color: (builder?.color as string | undefined) ?? null,
    guider_name: guider?.display_name ?? null,
    guider_color: (guider?.color as string | undefined) ?? null,
    builder_brief: builderBrief
      ? { title: builderBrief.title, rules: builderBrief.rules }
      : null,
    guider_brief: guiderBrief
      ? { title: guiderBrief.title, rules: guiderBrief.rules }
      : null,
  });
}
