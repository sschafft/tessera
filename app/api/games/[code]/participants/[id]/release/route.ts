import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; id: string }>;
}

/**
 * GM-only "release a stuck seat" affordance. Sets released_at on the
 * participant row, clears their pair_id + role. Frees their display
 * name for re-join (the unique-name check excludes released
 * participants).
 *
 * Reason this exists: cookies get cleared, players switch devices, or
 * miss the recovery URL. Without this route, a stuck seat blocks a
 * legitimate rejoin under the same name with no escape valve. The
 * cookie-based reconnect path + the home-page Resume Games pill cover
 * the common cases; this is the GM's last-resort tool.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { code, id } = await params;
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

  const target = await repo.findParticipantById(id);
  if (!target || target.game_id !== game.id) {
    return NextResponse.json({ error: "participant_not_found" }, { status: 404 });
  }
  if (target.id === game.gm_participant_id) {
    // The GM seat is the one running this request. Releasing it would
    // strand the dashboard; refuse.
    return NextResponse.json({ error: "cannot_release_gm" }, { status: 400 });
  }

  await repo.releaseParticipant(id);
  await publishGameEvent(game.id, "lobby_changed");
  return NextResponse.json({ ok: true });
}
