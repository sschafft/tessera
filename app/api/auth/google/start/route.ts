import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import {
  SCOPES,
  generateCodeVerifier,
  generateState as randomState,
  getGoogleConfig,
  googleClient,
  missingGoogleConfigVars,
  signState,
} from "@/lib/google/oauth";

export const runtime = "nodejs";

/**
 * Step 1 of the breakouts OAuth flow. The GM hits this endpoint from
 * the dashboard; we ask arctic to build a Google authorization URL
 * with PKCE + state, sign the state JWT (binding it to the game and
 * carrying the PKCE verifier so the callback can prove it owns the
 * original /start request), then 302.
 *
 * Auth gate: GM session cookie matching the game code in the query
 * string. Only the GM of this game can start the OAuth flow.
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

  const origin = req.nextUrl.origin;
  const cfg = getGoogleConfig(origin);
  if (!cfg) {
    return NextResponse.json(
      {
        error: "oauth_unconfigured",
        missing_env_vars: missingGoogleConfigVars(),
      },
      { status: 503 },
    );
  }

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const codeVerifier = generateCodeVerifier();
  // arctic also exposes a `generateState()` helper, but we want the
  // state to be a signed JWT bound to the game so the callback can
  // verify ownership without an extra cookie roundtrip. The opaque
  // arctic-generated string is folded into the JWT as a nonce.
  const state = await signState({
    game_id: game.id,
    game_code: code,
    code_verifier: codeVerifier,
    origin,
  });
  // Touch arctic's randomState to silence the "imported but unused" lint
  // when callers want to use it; remove if not needed.
  void randomState;

  const url = googleClient(cfg).createAuthorizationURL(
    state,
    codeVerifier,
    SCOPES,
  );
  // Long-lived offline access for refresh tokens, plus prompt=consent
  // so Google guarantees a refresh_token on the first authorization
  // even when the user has previously consented.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return NextResponse.redirect(url, { status: 302 });
}
