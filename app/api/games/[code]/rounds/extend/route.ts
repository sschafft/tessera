import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface ExtendPayload {
  /** Seconds to add to the running round. 30..600. */
  delta_seconds?: number;
}

/**
 * GM-only "extend round" — pads the running round timer with extra
 * seconds. Reuses repo.decrementRoundDuration with a negative delta
 * (the existing impl handles both directions; the floor at 30s only
 * applies when shrinking).
 *
 * Lives outside the super-power surface: time extension is a top-bar
 * GM action ("+30s / +1m / +2m") rather than a paced mechanic.
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

  let body: ExtendPayload;
  try {
    body = (await req.json()) as ExtendPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const delta = body.delta_seconds;
  if (
    typeof delta !== "number" ||
    !Number.isFinite(delta) ||
    delta < 30 ||
    delta > 600
  ) {
    return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  const round = await repo.findLatestRound(game.id);
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }

  await repo.decrementRoundDuration(round.id, -delta);
  void publishGameEvent(game.id, "round_extended", { delta_seconds: delta });

  return NextResponse.json({ ok: true, delta_seconds: delta });
}
