import "server-only";

import { decryptToken, encryptToken } from "@/lib/auth/encrypt";
import { getServiceClient } from "@/lib/supabase/server";
import {
  REFRESH_SKEW_SECONDS,
  getGoogleConfig,
  googleClient,
} from "./oauth";

/**
 * Server-side token store for the GM's Google session, scoped per
 * game. Tokens are AES-256-GCM encrypted at rest (lib/auth/encrypt).
 * Callers should always go through `getValidAccessToken` rather than
 * reading the row directly so refresh + persistence stays centralised.
 */

export interface StoredGoogleSession {
  game_id: string;
  scope: string;
  expires_at: string;
  refreshed_at: string | null;
}

export interface UpsertTokensInput {
  game_id: string;
  access_token: string;
  refresh_token?: string | null;
  expires_in_seconds: number;
  scope: string;
}

export async function upsertTokens(input: UpsertTokensInput): Promise<void> {
  const supabase = getServiceClient();
  const expiresAt = new Date(
    Date.now() + input.expires_in_seconds * 1000,
  ).toISOString();
  const { error } = await supabase.from("gm_google_tokens").upsert(
    {
      game_id: input.game_id,
      access_token_enc: encryptToken(input.access_token),
      refresh_token_enc: input.refresh_token
        ? encryptToken(input.refresh_token)
        : null,
      expires_at: expiresAt,
      scope: input.scope,
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: "game_id" },
  );
  if (error) throw new Error(`upsertTokens: ${error.message}`);
}

export async function getSession(
  game_id: string,
): Promise<StoredGoogleSession | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("gm_google_tokens")
    .select("game_id, scope, expires_at, refreshed_at")
    .eq("game_id", game_id)
    .maybeSingle();
  if (error) throw new Error(`getSession: ${error.message}`);
  return data ?? null;
}

/**
 * Returns a usable access token for the game, refreshing once if the
 * stored token is within REFRESH_SKEW_SECONDS of expiring. Throws
 * `GoogleSessionLost` when there's no row, no refresh token, or the
 * refresh call fails — caller should surface a re-auth prompt.
 */
export async function getValidAccessToken(game_id: string): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("gm_google_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at, scope")
    .eq("game_id", game_id)
    .maybeSingle();
  if (error) throw new Error(`getValidAccessToken: ${error.message}`);
  if (!data) throw new GoogleSessionLost("no_tokens");

  const expiresAt = new Date(data.expires_at).getTime();
  const stillFresh = Date.now() < expiresAt - REFRESH_SKEW_SECONDS * 1000;
  if (stillFresh) return decryptToken(data.access_token_enc);

  // Need to refresh. Use arctic's Google client; redirectURI doesn't
  // matter for token refresh, so we pass a stable placeholder built
  // from TESSERA_PUBLIC_URL when present (or empty string — Google
  // ignores it on the refresh endpoint).
  if (!data.refresh_token_enc) throw new GoogleSessionLost("no_refresh_token");
  const cfg = getGoogleConfig();
  if (!cfg) throw new GoogleSessionLost("oauth_unconfigured");
  const refreshToken = decryptToken(data.refresh_token_enc);
  let refreshed;
  try {
    refreshed = await googleClient(cfg).refreshAccessToken(refreshToken);
  } catch (err) {
    throw new GoogleSessionLost(
      `refresh_failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await upsertTokens({
    game_id,
    access_token: refreshed.accessToken(),
    // Google rotates refresh tokens occasionally; fall back to the
    // existing one when none is returned.
    refresh_token: refreshed.hasRefreshToken()
      ? refreshed.refreshToken()
      : refreshToken,
    expires_in_seconds: refreshed.accessTokenExpiresInSeconds(),
    scope: refreshed.hasScopes() ? refreshed.scopes().join(" ") : data.scope,
  });
  return refreshed.accessToken();
}

/**
 * Revoke + delete on game-end. Best-effort: if the revoke roundtrip
 * fails, we still drop the row (game is ending; no point keeping
 * orphaned encrypted material around).
 */
export async function revokeAndDelete(game_id: string): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("gm_google_tokens")
    .select("access_token_enc, refresh_token_enc")
    .eq("game_id", game_id)
    .maybeSingle();
  if (data) {
    const cfg = getGoogleConfig();
    if (cfg) {
      // Revoke either token (they share an authorization on Google's side).
      const token = data.refresh_token_enc
        ? decryptToken(data.refresh_token_enc)
        : decryptToken(data.access_token_enc);
      await googleClient(cfg)
        .revokeToken(token)
        .catch(() => undefined); // best-effort
    }
  }
  await supabase.from("gm_google_tokens").delete().eq("game_id", game_id);
}

export class GoogleSessionLost extends Error {
  constructor(public readonly reason: string) {
    super(`google_session_lost: ${reason}`);
    this.name = "GoogleSessionLost";
  }
}
