import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, getGoogleConfig, verifyState } from "@/lib/google/oauth";
import { upsertTokens } from "@/lib/google/tokenStore";

export const runtime = "nodejs";

/**
 * OAuth callback. Verifies the state JWT, exchanges the code for
 * tokens, encrypts + persists them against the game, and redirects
 * the GM back to /master with a query param so the dashboard can
 * surface a "Google connected" toast.
 *
 * Errors land back at /master too, but with `?google_error=...` so
 * the dashboard can show a friendly retry CTA instead of a raw
 * Next.js error page.
 */
export async function GET(req: NextRequest) {
  const cfg = getGoogleConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "oauth_unconfigured" },
      { status: 503 },
    );
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errParam = req.nextUrl.searchParams.get("error");

  // User clicked Cancel on Google's consent screen. Honour it
  // gracefully — no game_code in the URL since state never made it
  // through, so go to home.
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

  let tokens;
  try {
    tokens = await exchangeCode(cfg, {
      code,
      codeVerifier: parsed.code_verifier,
    });
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
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_in_seconds: tokens.expires_in,
    scope: tokens.scope,
  });

  const back = new URL(`/g/${parsed.game_code}/master`, req.url);
  back.searchParams.set("google_connected", "1");
  return NextResponse.redirect(back, { status: 302 });
}
