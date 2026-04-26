import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * End the entire game. Implicitly ends any running round. Marks
 * games.status='ended' and ended_at=now(). All routes that gate on
 * game_status will start returning 'ended' from this point.
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
  if (game.status === "ended") {
    return NextResponse.json({ ok: true, already_ended: true });
  }

  // End the active round first (idempotent), then flip the game.
  const round = await repo.findLatestRound(game.id);
  if (round && round.status === "running") {
    await repo.endRound(round.id);
  }
  await repo.setGameStatus(game.id, "ended");
  return NextResponse.json({ ok: true });
}
