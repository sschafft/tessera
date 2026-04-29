import { describe, expect, it } from "vitest";
import { colorFor } from "./colors";

describe("colorFor", () => {
  it("is deterministic for the same (name, gameId)", () => {
    expect(colorFor("Sam", "abc")).toBe(colorFor("Sam", "abc"));
    expect(colorFor("Avery", "game-1")).toBe(colorFor("Avery", "game-1"));
  });

  it("is case-insensitive on display name", () => {
    expect(colorFor("Sam", "abc")).toBe(colorFor("SAM", "abc"));
    expect(colorFor("Sam", "abc")).toBe(colorFor("sam", "abc"));
  });

  it("differs across game ids for the same name", () => {
    // Sam in game A vs game B should rarely collide. Test against a
    // few different ids to ensure the gameId actually mixes in.
    const sams = new Set([
      colorFor("Sam", "alpha"),
      colorFor("Sam", "bravo"),
      colorFor("Sam", "charlie"),
      colorFor("Sam", "delta"),
      colorFor("Sam", "echo"),
    ]);
    expect(sams.size).toBeGreaterThan(1);
  });

  it("returns one of the palette tokens", () => {
    const palette = new Set([
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "purple",
      "pink",
      "teal",
    ]);
    for (let i = 0; i < 50; i++) {
      const c = colorFor(`name-${i}`, `game-${i}`);
      expect(palette.has(c)).toBe(true);
    }
  });

  it("spreads names across the palette in one game", () => {
    const colors = new Set<string>();
    for (let i = 0; i < 50; i++) colors.add(colorFor(`Player-${i}`, "game-1"));
    // 50 names into 8 palette entries — should hit at least 5 distinct.
    expect(colors.size).toBeGreaterThanOrEqual(5);
  });
});
