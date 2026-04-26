import type { TileShape } from "@/components/canvas/Tile";

/**
 * Coordinate system: integer grid (q, r) → pixel (x, y).
 *
 * Each grid cell is `CELL` px square; one piece occupies one cell on the
 * conceptual grid even though the visual tile may extend slightly beyond
 * (e.g. hex / trap have wider bounding boxes than the cell). The visual
 * size per shape is captured by SHAPE_SIZE_RATIO.
 *
 * Origin is the top-left of the canvas. (0, 0) places the piece at
 * (PADDING, PADDING) px.
 */
export const CELL = 64;
export const PADDING = 32;

export const GRID_WIDTH = 9;
export const GRID_HEIGHT = 7;

export const CANVAS_WIDTH = GRID_WIDTH * CELL + PADDING * 2;
export const CANVAS_HEIGHT = GRID_HEIGHT * CELL + PADDING * 2;

/**
 * Per-shape rendering size as a multiple of CELL. Larger shapes render
 * a bit bigger than their cell so the goal pattern feels chunky and
 * pieces visually overlap, like in the design.
 */
export const SHAPE_SIZE_RATIO: Record<TileShape, number> = {
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

/**
 * Top-left pixel position of a piece occupying cell (q, r). Tiles
 * accept absolute (x, y) of their bounding box's top-left, so the
 * caller subtracts the size offset themselves if they want the tile
 * centred on the cell.
 */
export function cellToPixel(cell: Cell): Pixel {
  return {
    x: PADDING + cell.q * CELL,
    y: PADDING + cell.r * CELL,
  };
}

/**
 * Closest cell for a given pixel coord. Used by drag-drop snapping in
 * milestone 3.2. Clamps to the grid envelope.
 */
export function pixelToCell(pixel: Pixel): Cell {
  const q = Math.round((pixel.x - PADDING) / CELL);
  const r = Math.round((pixel.y - PADDING) / CELL);
  return {
    q: Math.max(0, Math.min(GRID_WIDTH - 1, q)),
    r: Math.max(0, Math.min(GRID_HEIGHT - 1, r)),
  };
}

/**
 * Tile-bounding-box size in px for a given shape, given the configured
 * cell size. Useful when positioning a Tile so it visually fills the
 * cell.
 */
export function tileSizeFor(shape: TileShape): number {
  return CELL * SHAPE_SIZE_RATIO[shape];
}
