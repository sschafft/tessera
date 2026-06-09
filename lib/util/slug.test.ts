import { describe, expect, it } from "vitest";
import { pairSlug, RESERVED_PAIR_SLUGS } from "./slug";

describe("pairSlug", () => {
  it("lowercases + hyphenates whitespace", () => {
    expect(pairSlug("The Pelicans")).toBe("the-pelicans");
  });

  it("collapses runs of non-alphanumerics", () => {
    expect(pairSlug("Avery  &  Bri!!")).toBe("avery-bri");
  });

  it("strips diacritics", () => {
    expect(pairSlug("Café équipe")).toBe("cafe-equipe");
  });

  it("handles unicode names without going empty", () => {
    expect(pairSlug("Über-Team 7")).toBe("uber-team-7");
  });

  it("returns empty when nothing alphanumeric survives", () => {
    expect(pairSlug("¿¡!!??")).toBe("");
  });

  it("trims leading/trailing hyphens", () => {
    expect(pairSlug("--foo--")).toBe("foo");
  });

  it("matches case-insensitively across renders", () => {
    expect(pairSlug("Alice ↔ Bob")).toBe(pairSlug("ALICE ↔ BOB"));
  });
});

describe("RESERVED_PAIR_SLUGS", () => {
  it("covers the existing /g/[code]/* pages", () => {
    expect(RESERVED_PAIR_SLUGS.has("join")).toBe(true);
    expect(RESERVED_PAIR_SLUGS.has("master")).toBe(true);
    expect(RESERVED_PAIR_SLUGS.has("play")).toBe(true);
  });

  it("does not falsely flag legitimate team names", () => {
    expect(RESERVED_PAIR_SLUGS.has(pairSlug("The Pelicans"))).toBe(false);
    expect(RESERVED_PAIR_SLUGS.has(pairSlug("Team Avery"))).toBe(false);
  });
});
