import { describe, expect, it } from "vitest";
import { jitsiUrlForPair } from "./jitsi";

describe("jitsiUrlForPair", () => {
  it("produces a deterministic URL for a given (code, pairId)", () => {
    const args = {
      gameCode: "ATH-45K",
      pairId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(jitsiUrlForPair(args)).toBe(jitsiUrlForPair(args));
    expect(jitsiUrlForPair(args)).toMatch(/^https:\/\/meet\.jit\.si\//);
  });

  it("lower-cases + truncates the pair id to 12 chars", () => {
    const url = jitsiUrlForPair({
      gameCode: "ATH-45K",
      pairId: "550e8400-e29b-41d4-a716-446655440000",
    });
    // Slug = first 12 of safeSlug applied to UUID. Hyphens kept,
    // letters lowercased.
    expect(url).toContain("-550e8400-e29");
  });

  it("strips unsafe characters from the game code", () => {
    const url = jitsiUrlForPair({
      gameCode: "ATH-45K!@#$%",
      pairId: "abc",
    });
    // Result keeps the alphanumerics + hyphens, drops the symbols.
    expect(url).toContain("ath-45k");
    expect(url).not.toMatch(/[!@#$%]/);
  });

  it("differs across pair ids in the same game", () => {
    const a = jitsiUrlForPair({ gameCode: "ATH-45K", pairId: "alpha" });
    const b = jitsiUrlForPair({ gameCode: "ATH-45K", pairId: "bravo" });
    expect(a).not.toBe(b);
  });

  it("differs across games for the same pair id", () => {
    const a = jitsiUrlForPair({ gameCode: "ATH-45K", pairId: "alpha" });
    const b = jitsiUrlForPair({ gameCode: "BCD-99X", pairId: "alpha" });
    expect(a).not.toBe(b);
  });
});
