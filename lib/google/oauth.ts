import "server-only";

import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Google OAuth helpers for the breakouts feature. We use the
 * Authorization Code + PKCE flow because the redirect URI lives on
 * the same origin as the rest of the app and the client_secret is
 * present anyway (web flow), but PKCE is still defence-in-depth
 * against code interception on the redirect.
 *
 * Scopes: only `calendar.events`. We don't need full calendar read
 * or any other Google product surface. The Meet link is auto-attached
 * to the calendar event we create via conferenceData.createRequest.
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

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
 * Read OAuth client config from env. Missing values mean the feature
 * is unconfigured on this deployment — callers should hide the UI.
 */
export function getGoogleConfig(): GoogleClientConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const publicUrl = process.env.TESSERA_PUBLIC_URL;
  if (!clientId || !clientSecret || !publicUrl) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${publicUrl.replace(/\/$/, "")}/api/auth/google/callback`,
  };
}

export function isGoogleConfigured(): boolean {
  return getGoogleConfig() !== null;
}

interface StatePayload {
  game_id: string;
  game_code: string;
  // PKCE verifier (base64url, 32 bytes random) — stays inside the
  // signed JWT so the callback can prove it owns the original /start
  // request without a second cookie roundtrip.
  cv: string;
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
}): Promise<string> {
  const jwt = await new SignJWT({
    game_id: payload.game_id,
    game_code: payload.game_code,
    cv: payload.code_verifier,
    nonce: randomBytes(8).toString("hex"),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("tessera")
    .setSubject("google_oauth_state")
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(jwtSecret());
  return jwt;
}

export async function verifyState(token: string): Promise<{
  game_id: string;
  game_code: string;
  code_verifier: string;
}> {
  const { payload } = await jwtVerify<StatePayload>(token, jwtSecret(), {
    issuer: "tessera",
    subject: "google_oauth_state",
  });
  if (
    typeof payload.game_id !== "string" ||
    typeof payload.game_code !== "string" ||
    typeof payload.cv !== "string"
  ) {
    throw new Error("invalid_state");
  }
  return {
    game_id: payload.game_id,
    game_code: payload.game_code,
    code_verifier: payload.cv,
  };
}

/** Generate a PKCE verifier + S256 challenge pair. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
}

/**
 * Exchange the authorization code from Google for an access + refresh
 * token pair. PKCE verifier is the proof that the request comes from
 * the same client that initiated /start.
 */
export async function exchangeCode(
  cfg: GoogleClientConfig,
  args: { code: string; codeVerifier: string },
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code: args.code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
    code_verifier: args.codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`google_token_exchange_failed: ${res.status} ${body}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Refresh an expired access token. Refresh tokens are long-lived
 * (months) but can be revoked by the user; the caller should treat
 * a 400/401 here as "Google session lost — prompt re-auth".
 */
export async function refreshAccessToken(
  cfg: GoogleClientConfig,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`google_token_refresh_failed: ${res.status} ${body}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Best-effort revoke. Called on game-end after we've cleaned up
 * calendar events — leaves Google in a clean state if the GM never
 * comes back. Failures are logged + swallowed.
 */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch {
    // Swallow — game-end shouldn't block on a revoke roundtrip.
  }
}

export function buildAuthUrl(
  cfg: GoogleClientConfig,
  args: { state: string; codeChallenge: string; loginHint?: string },
): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    code_challenge: args.codeChallenge,
    code_challenge_method: "S256",
    state: args.state,
  });
  if (args.loginHint) params.set("login_hint", args.loginHint);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}
