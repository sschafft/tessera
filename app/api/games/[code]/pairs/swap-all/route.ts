import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GM-only bulk swap — flips builder ↔ guider for every fully-paired
 * pair in the game. Pre-round only (same gating as the per-pair
 * swap-roles endpoint). One realtime broadcast at the end so player
 * tabs refetch once instead of N times.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
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
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const round = await repo.rounds.findLatest(game.id);
  if (round && round.status === "running") {
    return NextResponse.json(
      { error: "round_running" },
      { status: 409 },
    );
  }

  const swapped = await repo.pairs.swapAllRoles(game.id);
  if (swapped > 0) {
    await publishGameEvent(game.id, "lobby_changed");
  }
  return NextResponse.json({ ok: true, swapped });
}
