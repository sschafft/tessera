import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { MAX_GRID, gridSizeFor } from "@/lib/grid/coords";
import { PlacementCellTakenError } from "@/lib/game/repository.memory";
import { publishGameEvent } from "@/lib/realtime/publish";
import {
  BUILDER_COLOR_SET,
  BUILDER_SHAPE_SET,
} from "@/lib/pattern/palette";
import { scorePlacements } from "@/lib/scoring/score";
import type { GoalPattern } from "@/lib/pattern/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface PlacePayload {
  shape?: string;
  color?: string;
  q?: number;
  r?: number;
  rot?: number;
}

// Validators import the palette directly. The previous hand-maintained
// VALID_COLORS list had drifted (allowed pink/teal — colours the goal
// generator never emits — silently un-scorable). design_patterns.md
// > "Validation at boundaries, trust internal code" — the validator
// must match the palette exactly.

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
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
      { error: "only_builder_can_place" },
      { status: 403 },
    );
  }

  let body: PlacePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof body.shape !== "string" ||
    !BUILDER_SHAPE_SET.has(body.shape as never)
  ) {
    return NextResponse.json({ error: "invalid_shape" }, { status: 400 });
  }
  if (
    typeof body.color !== "string" ||
    !BUILDER_COLOR_SET.has(body.color as never)
  ) {
    return NextResponse.json({ error: "invalid_color" }, { status: 400 });
  }
  if (!isInt(body.q) || body.q < 0 || body.q >= MAX_GRID) {
    return NextResponse.json({ error: "invalid_q" }, { status: 400 });
  }
  if (!isInt(body.r) || body.r < 0 || body.r >= MAX_GRID) {
    return NextResponse.json({ error: "invalid_r" }, { status: 400 });
  }
  if (!isInt(body.rot) || body.rot < 0 || body.rot > 3) {
    return NextResponse.json({ error: "invalid_rot" }, { status: 400 });
  }

  const repo = getRepository();
  const me = session.me;
  if (!me.pair_id) {
    return NextResponse.json({ error: "not_in_pair" }, { status: 400 });
  }

  // Load game + round in parallel — game is needed for scoring config
  // (we annotate the POST response with `correct` + `wrong_reasons` so
  // the builder UX renders correctness without waiting for the realtime
  // broadcast → /play refetch round-trip).
  const [game, round] = await Promise.all([
    repo.games.findByCode(code),
    repo.rounds.findLatest(session.claims.game_id),
  ]);
  if (!game || game.id !== session.claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }
  // Per-round square grid bounds — the broad MAX_GRID check above is a
  // cheap early exit; this is the precise check.
  const grid = gridSizeFor(round.complexity);
  if (body.q >= grid.w) {
    return NextResponse.json({ error: "invalid_q" }, { status: 400 });
  }
  if (body.r >= grid.h) {
    return NextResponse.json({ error: "invalid_r" }, { status: 400 });
  }
  const pairRound = await repo.pairRounds.find(round.id, me.pair_id);
  if (!pairRound) {
    return NextResponse.json({ error: "no_pair_round" }, { status: 400 });
  }

  try {
    // POST is upsert-by-cell: tapping an occupied cell with a fresh
    // selection overwrites the existing piece. We delete first so the
    // unique(pair_round, q, r) constraint can't fire.
    const existing = await repo.placements.list(pairRound.id);
    const collision = existing.find((p) => p.q === body.q && p.r === body.r);
    if (collision) {
      await repo.placements.delete(collision.id);
    }
    const placement = await repo.placements.create({
      pair_round_id: pairRound.id,
      shape: body.shape,
      color: body.color,
      q: body.q,
      r: body.r,
      rot: body.rot,
      placed_by: me.id,
    });
    // Score the new placement against the goal so the response can
    // carry correctness directly. The builder UX (single-target model,
    // wash + badge + wrong-because tooltip) needs `correct` AND
    // `wrong_reasons` to render feedback; without this, the player
    // would have to wait for the realtime broadcast → /play refetch
    // (~50–100ms) just for the wash to appear under a freshly-placed
    // piece. Goal scoring is O(N + G) on small workshop-scale arrays
    // — cheap to do inline.
    let placementCorrect: boolean | undefined;
    let placementWrongReasons:
      | { shape: boolean; color: boolean; rotation: boolean }
      | null
      | undefined;
    {
      const goal = (pairRound.goal_pattern as GoalPattern) ?? [];
      const allPlacements = (await repo.placements.list(pairRound.id)).map(
        (p) => ({
          id: p.id,
          shape: p.shape,
          color: p.color,
          q: p.q,
          r: p.r,
          rot: p.rot,
        }),
      );
      const breakdown = scorePlacements(allPlacements, goal, {
        correctPts: game.scoring_correct_pts,
        wrongPts: game.scoring_wrong_pts,
      });
      const scoredNew = breakdown.placements.find(
        (p) => p.id === placement.id,
      );
      if (scoredNew) {
        placementCorrect = scoredNew.correct;
        placementWrongReasons = scoredNew.wrong_reasons;
      }
    }
    await publishGameEvent(session.claims.game_id, "placement_added");
    return NextResponse.json({
      ok: true,
      placement: {
        ...placement,
        correct: placementCorrect,
        wrong_reasons: placementWrongReasons ?? null,
      },
      replaced: collision?.id ?? null,
    });
  } catch (err) {
    if (err instanceof PlacementCellTakenError) {
      // Race with a concurrent place at the same cell — surface as 409
      // so the client can re-fetch and retry. With the optimistic UI
      // this only happens if a racy super-power fires mid-place.
      return NextResponse.json({ error: "cell_taken" }, { status: 409 });
    }
    throw err;
  }
}

/**
 * Clear every placement on the builder's canvas. Builder-only — observer
 * and guider should never wipe state. The pair_round itself is left
 * intact (round, briefs, snapshot all preserved).
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
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
      { error: "only_builder_can_clear" },
      { status: 403 },
    );
  }
  const me = session.me;
  if (!me.pair_id) {
    return NextResponse.json({ error: "not_in_pair" }, { status: 400 });
  }

  const repo = getRepository();
  const round = await repo.rounds.findLatest(session.claims.game_id);
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }
  const pairRound = await repo.pairRounds.find(round.id, me.pair_id);
  if (!pairRound) {
    return NextResponse.json({ error: "no_pair_round" }, { status: 400 });
  }

  const cleared = await repo.placements.clear(pairRound.id);
  await publishGameEvent(session.claims.game_id, "placements_cleared");
  return NextResponse.json({ ok: true, cleared });
}
