import { describe, expect, it } from "vitest";
import {
  BUILDER_COLORS,
  BUILDER_COLOR_SET,
  BUILDER_SHAPES,
  BUILDER_SHAPE_SET,
  paletteColorCount,
  paletteColorsFor,
} from "./palette";

describe("BUILDER_SHAPES + COLORS", () => {
  it("declared list and Set form stay in sync", () => {
    expect(BUILDER_SHAPE_SET.size).toBe(BUILDER_SHAPES.length);
    expect(BUILDER_COLOR_SET.size).toBe(BUILDER_COLORS.length);
    for (const s of BUILDER_SHAPES) expect(BUILDER_SHAPE_SET.has(s)).toBe(true);
    for (const c of BUILDER_COLORS) expect(BUILDER_COLOR_SET.has(c)).toBe(true);
  });
});

describe("paletteColorCount", () => {
  it("returns the canonical map for 1..8", () => {
    expect(paletteColorCount(1)).toBe(2);
    expect(paletteColorCount(2)).toBe(3);
    expect(paletteColorCount(3)).toBe(3);
    expect(paletteColorCount(4)).toBe(3);
    expect(paletteColorCount(5)).toBe(4);
    expect(paletteColorCount(6)).toBe(4);
    expect(paletteColorCount(7)).toBe(5);
    expect(paletteColorCount(8)).toBe(6);
  });

  it("clamps below 1 and above 8", () => {
    expect(paletteColorCount(0)).toBe(paletteColorCount(1));
    expect(paletteColorCount(-3)).toBe(paletteColorCount(1));
    expect(paletteColorCount(9)).toBe(paletteColorCount(8));
    expect(paletteColorCount(100)).toBe(paletteColorCount(8));
  });

  it("rounds non-integer complexity", () => {
    expect(paletteColorCount(2.4)).toBe(paletteColorCount(2));
    expect(paletteColorCount(2.6)).toBe(paletteColorCount(3));
  });

  it("never exceeds the BUILDER_COLORS length", () => {
    for (let c = 1; c <= 8; c++) {
      expect(paletteColorCount(c)).toBeLessThanOrEqual(BUILDER_COLORS.length);
    }
  });
});

describe("paletteColorsFor", () => {
  it("slices BUILDER_COLORS in declared order", () => {
    expect(paletteColorsFor(1)).toEqual(BUILDER_COLORS.slice(0, 2));
    expect(paletteColorsFor(8)).toEqual(BUILDER_COLORS.slice(0, 6));
  });

  it("returns a non-empty subset of BUILDER_COLOR_SET", () => {
    for (let c = 1; c <= 8; c++) {
      const palette = paletteColorsFor(c);
      expect(palette.length).toBeGreaterThan(0);
      for (const color of palette) {
        expect(BUILDER_COLOR_SET.has(color)).toBe(true);
      }
    }
  });
});
