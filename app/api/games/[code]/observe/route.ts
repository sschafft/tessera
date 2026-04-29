import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { publishGameEvent } from "@/lib/realtime/publish";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface SwitchPayload {
  pair_id?: string;
}

/**
 * Observers may re-aim themselves at any pair in the game. Updates
 * participants.pair_id; the polling /play endpoint then surfaces the
 * new pair's goal + placements + briefs.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.me.role !== "observer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: SwitchPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.pair_id) {
    return NextResponse.json({ error: "pair_id_required" }, { status: 400 });
  }

  const repo = getRepository();
  const me = session.me;
  const pair = await repo.pairs.findById(body.pair_id);
  if (!pair || pair.game_id !== session.claims.game_id) {
    return NextResponse.json({ error: "pair_not_found" }, { status: 404 });
  }

  // Reuse the existing assignObserver helper. Our observer was
  // already role='observer'; this only updates pair_id.
  await repo.pairs.assignObserver(me.id, pair.id);
  await publishGameEvent(session.claims.game_id, "observer_switched");
  return NextResponse.json({ ok: true });
}
