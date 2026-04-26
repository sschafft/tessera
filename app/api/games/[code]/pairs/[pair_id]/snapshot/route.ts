import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import type { GoalPattern } from "@/lib/pattern/types";

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

  const round = await repo.findLatestRound(game.id);
  if (!round) {
    return NextResponse.json({
      pair_id,
      round: null,
      goal: [],
      placements: [],
      accuracy: null,
      builder_name: null,
      guider_name: null,
      builder_brief: null,
      guider_brief: null,
    });
  }

  const pairRound = await repo.findPairRound(round.id, pair_id);
  const builder =
    pair.builder_id ? await repo.findParticipantById(pair.builder_id) : null;
  const guider =
    pair.guider_id ? await repo.findParticipantById(pair.guider_id) : null;

  const goal: GoalPattern = pairRound
    ? ((pairRound.goal_pattern as GoalPattern) ?? [])
    : [];
  const placementsRaw = pairRound
    ? await repo.listPlacements(pairRound.id)
    : [];

  // Per-piece correctness — always computed for the GM.
  const goalKey = (g: { shape: string; color: string; q: number; r: number; rot: number }) =>
    `${g.shape}|${g.color}|${g.q},${g.r}|${g.rot}`;
  const goalSet = new Set(goal.map(goalKey));
  let correct = 0;
  const placements = placementsRaw.map((p) => {
    const ok = goalSet.has(goalKey(p));
    if (ok) correct += 1;
    return {
      id: p.id,
      shape: p.shape,
      color: p.color,
      q: p.q,
      r: p.r,
      rot: p.rot,
      correct: ok,
    };
  });

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
