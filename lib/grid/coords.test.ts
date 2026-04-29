import { describe, expect, it } from "vitest";
import {
  CELL,
  MAX_GRID,
  PADDING,
  canvasSizeFor,
  cellToPixel,
  gridSizeFor,
  tileSizeFor,
} from "./coords";

describe("gridSizeFor", () => {
  it("returns the canonical size table for 1..8", () => {
    expect(gridSizeFor(1)).toEqual({ w: 3, h: 3 });
    expect(gridSizeFor(2)).toEqual({ w: 4, h: 4 });
    expect(gridSizeFor(3)).toEqual({ w: 4, h: 4 });
    expect(gridSizeFor(4)).toEqual({ w: 5, h: 5 });
    expect(gridSizeFor(5)).toEqual({ w: 6, h: 6 });
    expect(gridSizeFor(6)).toEqual({ w: 7, h: 7 });
    expect(gridSizeFor(7)).toEqual({ w: 8, h: 8 });
    expect(gridSizeFor(8)).toEqual({ w: 9, h: 9 });
  });

  it("clamps below 1 + above 8", () => {
    expect(gridSizeFor(0)).toEqual(gridSizeFor(1));
    expect(gridSizeFor(-5)).toEqual(gridSizeFor(1));
    expect(gridSizeFor(9)).toEqual(gridSizeFor(8));
    expect(gridSizeFor(100)).toEqual(gridSizeFor(8));
  });

  it("rounds non-integer complexity", () => {
    expect(gridSizeFor(2.4)).toEqual(gridSizeFor(2));
    expect(gridSizeFor(2.6)).toEqual(gridSizeFor(3));
  });

  it("never exceeds MAX_GRID", () => {
    for (let c = 1; c <= 8; c++) {
      const { w, h } = gridSizeFor(c);
      expect(w).toBeLessThanOrEqual(MAX_GRID);
      expect(h).toBeLessThanOrEqual(MAX_GRID);
    }
  });
});

describe("canvasSizeFor", () => {
  it("multiplies cell count by CELL and adds 2× padding", () => {
    expect(canvasSizeFor(1)).toEqual({
      width: 3 * CELL + 2 * PADDING,
      height: 3 * CELL + 2 * PADDING,
    });
    expect(canvasSizeFor(8)).toEqual({
      width: 9 * CELL + 2 * PADDING,
      height: 9 * CELL + 2 * PADDING,
    });
  });
});

describe("cellToPixel", () => {
  it("places (0,0) at PADDING", () => {
    expect(cellToPixel({ q: 0, r: 0 })).toEqual({ x: PADDING, y: PADDING });
  });

  it("steps by CELL per cell", () => {
    expect(cellToPixel({ q: 1, r: 0 })).toEqual({ x: PADDING + CELL, y: PADDING });
    expect(cellToPixel({ q: 0, r: 1 })).toEqual({ x: PADDING, y: PADDING + CELL });
    expect(cellToPixel({ q: 3, r: 2 })).toEqual({
      x: PADDING + 3 * CELL,
      y: PADDING + 2 * CELL,
    });
  });
});

describe("tileSizeFor", () => {
  it("returns slightly-larger-than-CELL for triangles + rhombs + traps + hexagons + pentagons", () => {
    expect(tileSizeFor("tri-up")).toBeGreaterThan(CELL);
    expect(tileSizeFor("rhomb")).toBeGreaterThan(CELL);
    expect(tileSizeFor("trap")).toBeGreaterThan(CELL);
    expect(tileSizeFor("hex")).toBeGreaterThan(CELL);
    expect(tileSizeFor("pent")).toBeGreaterThan(CELL);
  });

  it("returns slightly-smaller-than-CELL for squares", () => {
    expect(tileSizeFor("sq")).toBeLessThan(CELL);
  });
});
