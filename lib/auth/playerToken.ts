import bcrypt from "bcryptjs";

const TOKEN_BYTES = 24; // 192 bits → 32 base64url chars
const BCRYPT_ROUNDS = 10;

/**
 * Generate a fresh player recovery token. The plaintext form is shown
 * exactly once in the join response (and surfaced to the player as a
 * "save this URL" affordance); the bcrypt hash lands on the
 * participants row. Mirrors `lib/auth/hostToken.ts` for the GM.
 */
export function generatePlayerToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

export async function hashPlayerToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS);
}

export async function verifyPlayerToken(
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
