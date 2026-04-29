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
 * GM-only "pull everyone back to the main room" action. Publishes a
 * one-shot realtime event that all player tabs listen for; each tab
 * surfaces a non-blocking modal pointing at the workshop's main
 * video-call URL. Useful when pairs have wandered off into their
 * breakout rooms and the GM wants to regroup for a debrief / brief
 * change / wrap-up.
 *
 * No DB write — the event is purely transient. Players who join AFTER
 * the call has been issued won't see it (intentional; the pull-back
 * is a moment, not a persisted state).
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

  await publishGameEvent(game.id, "return_to_main", {
    video_call_url: game.video_call_url ?? null,
  });
  return NextResponse.json({ ok: true });
}
