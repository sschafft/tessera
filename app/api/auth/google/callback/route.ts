import { NextResponse, type NextRequest } from "next/server";
import {
  getGoogleConfig,
  googleClient,
  verifyState,
} from "@/lib/google/oauth";
import { upsertTokens } from "@/lib/google/tokenStore";

export const runtime = "nodejs";

/**
 * OAuth callback. Verifies the state JWT (which carries the game id
 * + PKCE verifier + the origin used on the /start hop), exchanges
 * the code for tokens via arctic, encrypts + persists them against
 * the game, and redirects the GM back to /master with a query param
 * so the dashboard can surface a "Google connected" banner.
 *
 * Errors land back at /master too, but with `?google_error=...` so
 * the dashboard can show a friendly retry CTA instead of a raw
 * Next.js error page.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errParam = req.nextUrl.searchParams.get("error");

  // User clicked Cancel on Google's consent screen — honour it.
  if (errParam) {
    const home = new URL("/", req.url);
    home.searchParams.set("google_error", errParam);
    return NextResponse.redirect(home, { status: 302 });
  }
  if (!code || !state) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await verifyState(state);
  } catch {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  // Use the same origin the /start hop used so Google sees an
  // identical redirect_uri on both legs of the dance.
  const cfg = getGoogleConfig(parsed.origin);
  if (!cfg) {
    return NextResponse.json(
      { error: "oauth_unconfigured" },
      { status: 503 },
    );
  }

  let tokens;
  try {
    tokens = await googleClient(cfg).validateAuthorizationCode(
      code,
      parsed.code_verifier,
    );
  } catch (err) {
    const back = new URL(`/g/${parsed.game_code}/master`, req.url);
    back.searchParams.set(
      "google_error",
      err instanceof Error ? err.message.slice(0, 80) : "exchange_failed",
    );
    return NextResponse.redirect(back, { status: 302 });
  }

  await upsertTokens({
    game_id: parsed.game_id,
    access_token: tokens.accessToken(),
    refresh_token: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
    expires_in_seconds: tokens.accessTokenExpiresInSeconds(),
    scope: tokens.hasScopes() ? tokens.scopes().join(" ") : "",
  });

  const back = new URL(`/g/${parsed.game_code}/master`, req.url);
  back.searchParams.set("google_connected", "1");
  return NextResponse.redirect(back, { status: 302 });
}
