import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import {
  buildAuthUrl,
  getGoogleConfig,
  pkcePair,
  signState,
} from "@/lib/google/oauth";

export const runtime = "nodejs";

/**
 * Step 1 of the breakouts OAuth flow. The GM hits this endpoint from
 * the dashboard; we mint a state JWT (carrying the PKCE verifier) and
 * 302 to Google's consent screen with the calendar.events scope.
 *
 * The GM session cookie + matching game code is the auth gate — only
 * the GM of this game can start the OAuth flow.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const claims = await readSessionForGame(code);
  if (!claims) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (claims.role !== "gm") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const cfg = getGoogleConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "oauth_unconfigured" },
      { status: 503 },
    );
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const { verifier, challenge } = pkcePair();
  const state = await signState({
    game_id: game.id,
    game_code: code,
    code_verifier: verifier,
  });
  const url = buildAuthUrl(cfg, { state, codeChallenge: challenge });
  return NextResponse.redirect(url, { status: 302 });
}
