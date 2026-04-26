/**
 * Game code generation (per PRD §10 #5 / TDD locked decision):
 * Format `XXX-NNN` — three letters, hyphen, three alphanumerics.
 * Excludes ambiguous characters: 0, O, 1, I.
 */

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 (no I, O)
const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 24 letters + 8 digits = 32

function pick(alphabet: string, randomBytes: Uint8Array): string {
  // Use rejection sampling to avoid modulo bias.
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  for (const b of randomBytes) {
    if (b < max) {
      return alphabet[b % alphabet.length]!;
    }
  }
  // Fallback (should be extraordinarily rare): just take the first byte mod len.
  return alphabet[randomBytes[0]! % alphabet.length]!;
}

export function generateGameCode(): string {
  const buf = new Uint8Array(48); // plenty for rejection sampling
  crypto.getRandomValues(buf);
  let cursor = 0;
  const take = (alphabet: string) => {
    const slice = buf.subarray(cursor, cursor + 8);
    cursor += 8;
    return pick(alphabet, slice);
  };

  const letters = take(LETTERS) + take(LETTERS) + take(LETTERS);
  const tail = take(ALNUM) + take(ALNUM) + take(ALNUM);
  return `${letters}-${tail}`;
}

const GAME_CODE_RE = /^[A-HJ-NP-Z]{3}-[A-HJ-NP-Z2-9]{3}$/;

export function isValidGameCode(code: string): boolean {
  return GAME_CODE_RE.test(code);
}
