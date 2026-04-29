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
  token?: string;
}

/**
 * Host recovery — exchanges the one-shot host_token (shown once at game
 * create) for a fresh GM session cookie. The token never appears in the
 * URL path or query string; clients send it in the request body so it
 * stays out of access logs and Referer headers.
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
  if (!body.token || typeof body.token !== "string") {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const ok = await verifyRecoveryToken(body.token, game.host_token_hash);
  if (!ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const token = await mintSession({
    sub: game.gm_participant_id,
    game_id: game.id,
    role: "gm",
    code: game.code,
  });

  const res = NextResponse.json({ ok: true, code: game.code });
  setSessionCookie(res.cookies, code, token);
  return res;
}
