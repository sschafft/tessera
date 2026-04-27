import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface ScoringPayload {
  correct_pts?: number;
  wrong_pts?: number;
}

/**
 * GM-only patch for the game's scoring config. Driven by the scoring
 * super-power tile in AccelerantsRail. Bounds:
 *   correct_pts: 1..100
 *   wrong_pts:   -10..0  (negative is the penalty; 0 turns it off)
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

  let body: ScoringPayload;
  try {
    body = (await req.json()) as ScoringPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const patch: { scoring_correct_pts?: number; scoring_wrong_pts?: number } =
    {};
  if (body.correct_pts !== undefined) {
    if (
      !Number.isInteger(body.correct_pts) ||
      body.correct_pts < 1 ||
      body.correct_pts > 100
    ) {
      return NextResponse.json({ error: "invalid_correct_pts" }, { status: 400 });
    }
    patch.scoring_correct_pts = body.correct_pts;
  }
  if (body.wrong_pts !== undefined) {
    if (
      !Number.isInteger(body.wrong_pts) ||
      body.wrong_pts < -10 ||
      body.wrong_pts > 0
    ) {
      return NextResponse.json({ error: "invalid_wrong_pts" }, { status: 400 });
    }
    patch.scoring_wrong_pts = body.wrong_pts;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  await repo.updateScoring(game.id, patch);
  await publishGameEvent(game.id, "scoring_changed");

  return NextResponse.json({
    ok: true,
    correct_pts: patch.scoring_correct_pts ?? game.scoring_correct_pts,
    wrong_pts: patch.scoring_wrong_pts ?? game.scoring_wrong_pts,
  });
}
