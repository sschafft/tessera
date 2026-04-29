import { describe, expect, it } from "vitest";
import { generatePattern } from "./generator";
import { BUILDER_COLOR_SET, BUILDER_SHAPE_SET } from "./palette";
import { gridSizeFor } from "@/lib/grid/coords";

describe("generatePattern", () => {
  it("is deterministic for the same seed", () => {
    const a = generatePattern({ complexity: 5, seed: "alpha" });
    const b = generatePattern({ complexity: 5, seed: "alpha" });
    expect(a).toEqual(b);
  });

  it("differs with different seeds", () => {
    const a = generatePattern({ complexity: 5, seed: "alpha" });
    const b = generatePattern({ complexity: 5, seed: "bravo" });
    expect(a).not.toEqual(b);
  });

  it("respects per-complexity piece count windows", () => {
    // Profiles per complexity from generator.ts. Spot-check a few.
    const cases: Array<[number, number, number]> = [
      [1, 3, 3],
      [3, 5, 5],
      [5, 8, 8],
      [6, 9, 10],
      [8, 13, 16],
    ];
    for (const [c, min, max] of cases) {
      const p = generatePattern({ complexity: c, seed: `seed-${c}` });
      expect(p.length).toBeGreaterThanOrEqual(min);
      expect(p.length).toBeLessThanOrEqual(max);
    }
  });

  it("places every piece inside the grid for that complexity", () => {
    for (let c = 1; c <= 8; c++) {
      const grid = gridSizeFor(c);
      const p = generatePattern({ complexity: c, seed: `g-${c}` });
      for (const piece of p) {
        expect(piece.q).toBeGreaterThanOrEqual(0);
        expect(piece.q).toBeLessThan(grid.w);
        expect(piece.r).toBeGreaterThanOrEqual(0);
        expect(piece.r).toBeLessThan(grid.h);
      }
    }
  });

  it("never places two pieces on the same cell", () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePattern({ complexity: 5, seed: `unique-${i}` });
      const cells = new Set(p.map((piece) => `${piece.q},${piece.r}`));
      expect(cells.size).toBe(p.length);
    }
  });

  it("uses only the BUILDER palette (shapes + colors)", () => {
    for (let i = 0; i < 10; i++) {
      const p = generatePattern({ complexity: 8, seed: `palette-${i}` });
      for (const piece of p) {
        expect(BUILDER_SHAPE_SET.has(piece.shape)).toBe(true);
        expect(BUILDER_COLOR_SET.has(piece.color)).toBe(true);
      }
    }
  });

  it("produces only valid 90° rotations (rot ∈ {0,1,2,3})", () => {
    const p = generatePattern({ complexity: 7, seed: "rot-test" });
    for (const piece of p) {
      expect([0, 1, 2, 3]).toContain(piece.rot);
    }
  });

  it("clamps complexity below 1 and above 8", () => {
    // No throw, returns a valid pattern.
    expect(() =>
      generatePattern({ complexity: 0, seed: "clamp-low" }),
    ).not.toThrow();
    expect(() =>
      generatePattern({ complexity: 100, seed: "clamp-high" }),
    ).not.toThrow();
  });
});
