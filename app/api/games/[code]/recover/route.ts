import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { mintSession } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookie";
import { verifyRecoveryToken } from "@/lib/auth/recoveryToken";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface RecoverPayload {
  participant_id?: string;
  token?: string;
}

/**
 * Player session recovery — exchanges the one-shot token returned at
 * join time for a fresh session cookie. Mirrors /host-recover but on
 * participant_id + recovery_token_hash. The plain token is sent in
 * the request body (never the URL path or query) so it stays out of
 * access logs and Referer headers.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  let body: RecoverPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.participant_id || typeof body.participant_id !== "string") {
    return NextResponse.json(
      { error: "participant_id_required" },
      { status: 400 },
    );
  }
  if (!body.token || typeof body.token !== "string") {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "ended" || game.status === "purged") {
    return NextResponse.json({ error: "game_closed" }, { status: 410 });
  }

  const participant = await repo.participants.findById(body.participant_id);
  if (!participant || participant.game_id !== game.id) {
    return NextResponse.json(
      { error: "participant_not_found" },
      { status: 404 },
    );
  }
  if (participant.released_at !== null) {
    return NextResponse.json(
      { error: "participant_released" },
      { status: 410 },
    );
  }
  if (!participant.recovery_token_hash) {
    // Older participants from before recovery_token_hash existed have
    // no hash to verify against. Surface a typed error so the UI can
    // route them to /join instead of looping on the recover form.
    return NextResponse.json(
      { error: "no_recovery_configured" },
      { status: 422 },
    );
  }

  const ok = await verifyRecoveryToken(
    body.token,
    participant.recovery_token_hash,
  );
  if (!ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  await repo.participants.touch(participant.id);

  const token = await mintSession({
    sub: participant.id,
    game_id: game.id,
    role: participant.role,
    code,
  });

  const redirect = `/g/${code}/play`;
  const res = NextResponse.json({ ok: true, code, redirect });
  setSessionCookie(res.cookies, code, token);
  return res;
}
