import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "crypto";

/**
 * AES-256-GCM envelope encryption for tokens at rest. The key is
 * derived from TESSERA_JWT_SECRET via HKDF so we don't ship a second
 * key env var — anyone with the JWT secret already controls our auth
 * surface, so reusing it as the KDF input doesn't widen the blast
 * radius. The HKDF info string scopes the derived key to "tokens" so
 * the JWT-signing path and the encryption path don't share material.
 *
 * Format on disk: base64(iv ‖ authTag ‖ ciphertext). 12-byte IV,
 * 16-byte auth tag, variable ciphertext.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const HKDF_INFO = "tessera/tokens/v1";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.TESSERA_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("TESSERA_JWT_SECRET missing or too short");
  }
  // HKDF with empty salt is fine here — the input keying material
  // is already a high-entropy random secret. The info string is the
  // domain separator.
  const derived = hkdfSync(
    "sha256",
    Buffer.from(secret),
    Buffer.alloc(0),
    Buffer.from(HKDF_INFO),
    KEY_LEN,
  );
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptToken(envelope: string): string {
  const buf = Buffer.from(envelope, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("encrypted_token_too_short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}
