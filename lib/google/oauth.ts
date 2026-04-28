import "server-only";

import { Google, generateCodeVerifier, generateState } from "arctic";
import { SignJWT, jwtVerify } from "jose";

/**
 * Google OAuth helpers for the breakouts feature, backed by `arctic`.
 *
 * Why arctic and not roll-our-own: the previous in-house version
 * worked but rolled PKCE + state JWT + token exchange + refresh by
 * hand. arctic is a small (~10kb, zero deps) library that handles
 * exactly those four primitives for the major OAuth providers,
 * including a Google class. Less surface, fewer bugs, easier to
 * audit. The state-JWT bit (game-id binding) stays ours because that
 * piece is application-specific, not OAuth-spec.
 *
 * Scopes: only `calendar.events`. We don't read existing events or
 * touch any other Google product surface.
 */

export const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

/** State JWT lifetime — long enough for Google's interactive consent. */
const STATE_TTL_SECONDS = 600;
/** Skew window for refreshing access tokens before expiry. */
export const REFRESH_SKEW_SECONDS = 60;

export interface GoogleClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Read OAuth client config from env, computing the redirect URI from
 * either an explicit `origin` (the request's origin in the route
 * handler) or `TESSERA_PUBLIC_URL` as a fallback. Routes always pass
 * the request origin so the URL matches whichever host the GM is
 * actually on (custom domain, vercel preview, localhost) without
 * requiring a per-deploy env var.
 *
 * Returns null when client id/secret are missing — callers should
 * surface a typed error so the UI can prompt the deployer.
 */
export function getGoogleConfig(
  origin?: string,
): GoogleClientConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const base = (origin ?? process.env.TESSERA_PUBLIC_URL ?? "").replace(
    /\/$/,
    "",
  );
  if (!base) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${base}/api/auth/google/callback`,
  };
}

export function isGoogleConfigured(): boolean {
  // Presence-only check — `origin` only matters when actually
  // building a redirect URI in a route handler. The lobby route
  // calls this for the dashboard "configured" boolean and doesn't
  // care about the host.
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

/** Names of env vars missing from the OAuth config, in check order. */
export function missingGoogleConfigVars(): string[] {
  const missing: string[] = [];
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID)
    missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  return missing;
}

/** Build an arctic Google client for the given config. */
export function googleClient(cfg: GoogleClientConfig): Google {
  return new Google(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

/** PKCE + state utilities re-exported from arctic. */
export { generateCodeVerifier, generateState };

// ─── State JWT (binds the OAuth roundtrip to a specific game) ────────

interface StatePayload {
  game_id: string;
  game_code: string;
  /** PKCE verifier; carried inside the signed state so the callback
   *  can prove it owns the original /start request. */
  cv: string;
  /** Origin used to build the redirect URI on the start hop. We
   *  re-use it on the callback so the token-exchange request goes
   *  out with the exact same redirect URI. */
  o: string;
  nonce: string;
  [key: string]: unknown;
}

function jwtSecret(): Uint8Array {
  const s = process.env.TESSERA_JWT_SECRET;
  if (!s) throw new Error("TESSERA_JWT_SECRET missing");
  return new TextEncoder().encode(s);
}

export async function signState(payload: {
  game_id: string;
  game_code: string;
  code_verifier: string;
  origin: string;
}): Promise<string> {
  return new SignJWT({
    game_id: payload.game_id,
    game_code: payload.game_code,
    cv: payload.code_verifier,
    o: payload.origin,
    nonce: generateState().slice(0, 16),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("tessera")
    .setSubject("google_oauth_state")
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(jwtSecret());
}

export async function verifyState(token: string): Promise<{
  game_id: string;
  game_code: string;
  code_verifier: string;
  origin: string;
}> {
  const { payload } = await jwtVerify<StatePayload>(token, jwtSecret(), {
    issuer: "tessera",
    subject: "google_oauth_state",
  });
  if (
    typeof payload.game_id !== "string" ||
    typeof payload.game_code !== "string" ||
    typeof payload.cv !== "string" ||
    typeof payload.o !== "string"
  ) {
    throw new Error("invalid_state");
  }
  return {
    game_id: payload.game_id,
    game_code: payload.game_code,
    code_verifier: payload.cv,
    origin: payload.o,
  };
}
