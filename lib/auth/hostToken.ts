import bcrypt from "bcryptjs";

const TOKEN_BYTES = 24; // 192 bits → 32 base64url chars
const BCRYPT_ROUNDS = 10;

/**
 * Generate a fresh host-recovery token. The plaintext form is shown
 * exactly once to the GM (in the "save this URL" modal) and never
 * persisted; the bcrypt hash is what we keep.
 */
export function generateHostToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes);
}

export async function hashHostToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS);
}

export async function verifyHostToken(
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
