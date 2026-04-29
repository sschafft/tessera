import { describe, expect, it } from "vitest";
import {
  generateRecoveryToken,
  hashRecoveryToken,
  verifyRecoveryToken,
} from "./recoveryToken";

describe("generateRecoveryToken", () => {
  it("returns a 32-character base64url-safe string", () => {
    const t = generateRecoveryToken();
    expect(t).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never contains base64 padding or non-url-safe chars", () => {
    for (let i = 0; i < 30; i++) {
      const t = generateRecoveryToken();
      expect(t).not.toMatch(/[=+/]/);
    }
  });

  it("returns distinct values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateRecoveryToken());
    expect(seen.size).toBe(50);
  });
});

describe("hashRecoveryToken + verifyRecoveryToken", () => {
  it("verifies a freshly-hashed token", async () => {
    const token = generateRecoveryToken();
    const hash = await hashRecoveryToken(token);
    expect(await verifyRecoveryToken(token, hash)).toBe(true);
  });

  it("rejects a different token against the same hash", async () => {
    const token = generateRecoveryToken();
    const hash = await hashRecoveryToken(token);
    expect(await verifyRecoveryToken(generateRecoveryToken(), hash)).toBe(false);
  });

  it("rejects a token with one character changed", async () => {
    const token = generateRecoveryToken();
    const hash = await hashRecoveryToken(token);
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(await verifyRecoveryToken(tampered, hash)).toBe(false);
  });

  it("produces a different hash each call (bcrypt salt)", async () => {
    const token = "fixed-token-for-test";
    const a = await hashRecoveryToken(token);
    const b = await hashRecoveryToken(token);
    expect(a).not.toBe(b);
    // Both still verify against the same plaintext.
    expect(await verifyRecoveryToken(token, a)).toBe(true);
    expect(await verifyRecoveryToken(token, b)).toBe(true);
  });
});
