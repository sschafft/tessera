import { describe, expect, it } from "vitest";
import { generateGameCode, isValidGameCode } from "./code";

describe("isValidGameCode", () => {
  it("accepts the canonical XXX-NNN shape", () => {
    expect(isValidGameCode("HEX-934")).toBe(true);
    expect(isValidGameCode("ABC-DEF")).toBe(true);
    expect(isValidGameCode("ZZZ-999")).toBe(true);
  });

  it("rejects ambiguous characters (0, O, 1, I)", () => {
    expect(isValidGameCode("OAK-123")).toBe(false); // O in letters
    expect(isValidGameCode("ABC-1AB")).toBe(false); // 1 in tail
    expect(isValidGameCode("ABC-DE0")).toBe(false); // 0 in tail
    expect(isValidGameCode("ABI-234")).toBe(false); // I in letters
  });

  it("rejects wrong shapes", () => {
    expect(isValidGameCode("")).toBe(false);
    expect(isValidGameCode("ABC123")).toBe(false); // missing hyphen
    expect(isValidGameCode("AB-CDE")).toBe(false); // letters too short
    expect(isValidGameCode("ABCD-EF2")).toBe(false); // letters too long
    expect(isValidGameCode("abc-234")).toBe(false); // lowercase
    expect(isValidGameCode("ABC-23")).toBe(false); // tail too short
  });
});

describe("generateGameCode", () => {
  it("produces only valid codes (statistical sanity)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGameCode();
      expect(isValidGameCode(code)).toBe(true);
    }
  });

  it("uses XXX-NNN shape", () => {
    const code = generateGameCode();
    expect(code).toMatch(/^[A-Z]{3}-[A-Z0-9]{3}$/);
    expect(code[3]).toBe("-");
  });

  it("never includes ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGameCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it("has reasonable entropy across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateGameCode());
    // 200 random draws from 24^3 * 32^3 ≈ 4.7e8 should never collide.
    expect(seen.size).toBe(200);
  });
});
