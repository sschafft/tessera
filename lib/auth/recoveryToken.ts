import bcrypt from "bcryptjs";

/**
 * Single source of truth for the recovery-token primitive used by
 * both the GM (host_token_hash on games) and players
 * (recovery_token_hash on participants). The shape is identical —
 * the previous lib/auth/hostToken.ts + lib/auth/playerToken.ts were
 * 95% the same file with renamed identifiers, which meant any future
 * change (rounds bump, switch to argon2, swap bcryptjs for
 * @node-rs/bcrypt) had two places to drift between.
 *
 * The plaintext form is shown to the user exactly once at create /
 * join time and never persisted; the bcrypt hash is what we keep.
 */

const TOKEN_BYTES = 24; // 192 bits → 32 base64url chars
const BCRYPT_ROUNDS = 10;

export function generateRecoveryToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

export async function hashRecoveryToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS);
}

export async function verifyRecoveryToken(
  token: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

function bufferToBase64Url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
