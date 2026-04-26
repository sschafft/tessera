import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * End the active round. Idempotent. Either the GM clicks End round, or
 * the dashboard auto-fires this when the timer hits zero.
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
  const round = await repo.findLatestRound(game.id);
  if (!round) {
    return NextResponse.json({ error: "no_round" }, { status: 400 });
  }
  if (round.status === "ended") {
    return NextResponse.json({ ok: true, already_ended: true });
  }
  await repo.endRound(round.id);
  return NextResponse.json({ ok: true, round_id: round.id });
}
