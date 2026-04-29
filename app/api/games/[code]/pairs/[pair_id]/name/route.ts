import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; pair_id: string }>;
}

interface NamePayload {
  /** Empty string clears the name. */
  display_name?: string | null;
}

const MAX_NAME_LEN = 40;

/**
 * Set or clear the pair's self-chosen display name. Builder, guider,
 * observer in the pair, or the GM may all rename. Empty string or
 * null reverts to the default ("Builder ↔ Guider" in the UI).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { code, pair_id } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  let body: NamePayload;
  try {
    body = (await req.json()) as NamePayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  let trimmed: string | null = null;
  if (typeof body.display_name === "string") {
    const t = body.display_name.trim();
    if (t.length > MAX_NAME_LEN) {
      return NextResponse.json(
        { error: "name_too_long", max: MAX_NAME_LEN },
        { status: 400 },
      );
    }
    trimmed = t.length === 0 ? null : t;
  } else if (body.display_name !== null) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const repo = getRepository();
  const pair = await repo.pairs.findById(pair_id);
  if (!pair || pair.game_id !== session.claims.game_id) {
    return NextResponse.json({ error: "pair_not_found" }, { status: 404 });
  }
  // GM, or anyone whose pair_id matches.
  const me = session.me;
  const allowed = me.role === "gm" || me.pair_id === pair_id;
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await repo.pairs.setDisplayName(pair_id, trimmed);
  await publishGameEvent(session.claims.game_id, "pair_renamed");

  return NextResponse.json({ ok: true, display_name: trimmed });
}
