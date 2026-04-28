import type { TileShape } from "@/components/canvas/Tile";

/**
 * Coordinate system: integer grid (q, r) → pixel (x, y).
 *
 * Each grid cell is `CELL` px square; one piece occupies one cell on the
 * conceptual grid. The grid is square and its size scales with the
 * round's complexity (smaller = easier to talk about, larger = more
 * placements possible).
 *
 * Origin is the top-left of the canvas. Cell (0, 0) sits at
 * (PADDING, PADDING) px.
 */
export const CELL = 64;
export const PADDING = 32;

/** Hard upper bound on grid size. Used for server-side input validation. */
export const MAX_GRID = 9;

export interface GridSize {
  w: number;
  h: number;
}

const SIZE_BY_COMPLEXITY: Record<number, number> = {
  1: 3,
  2: 4,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
};

/**
 * Square grid dimensions for a given round complexity. Builders see
 * fewer cells at low complexity (faster to scan, easier to describe on
 * a call); higher complexity widens the canvas for richer patterns.
 */
export function gridSizeFor(complexity: number): GridSize {
  const lvl = Math.max(1, Math.min(8, Math.round(complexity)));
  const n = SIZE_BY_COMPLEXITY[lvl] ?? 6;
  return { w: n, h: n };
}

export function canvasSizeFor(
  complexity: number,
): { width: number; height: number } {
  const { w, h } = gridSizeFor(complexity);
  return {
    width: w * CELL + PADDING * 2,
    height: h * CELL + PADDING * 2,
  };
}

/**
 * Per-shape rendering size as a multiple of CELL. Larger shapes render
 * a bit bigger than their cell so the goal pattern feels chunky.
 */
const SHAPE_SIZE_RATIO: Record<TileShape, number> = {
  "tri-up": 1.05,
  "tri-dn": 1.05,
  sq: 0.95,
  rhomb: 1.1,
  trap: 1.1,
  hex: 1.05,
  pent: 1.05,
};

export interface Cell {
  q: number;
  r: number;
}

export interface Pixel {
  x: number;
  y: number;
}

export function cellToPixel(cell: Cell): Pixel {
  return {
    x: PADDING + cell.q * CELL,
    y: PADDING + cell.r * CELL,
  };
}

export function tileSizeFor(shape: TileShape): number {
  return CELL * SHAPE_SIZE_RATIO[shape];
}
