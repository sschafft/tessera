import type { TileColor, TileShape } from "@/components/canvas/Tile";

/**
 * The simplified builder palette shared by the goal generator and the
 * BuilderView tray. Trimmed to a small fixed set so the builder makes
 * fewer decisions per cell and the tray stays scannable on a call.
 *
 * Colors scale per complexity (see `paletteColorCount` below) — at
 * complexity 1-3 only the first few colors are used in goal patterns
 * and shown to the builder.
 */
// Hexagons render ~identical at 0/90/180/270° — replaced with the
// trapezoid which has a clearly different orientation at every step.
export const BUILDER_SHAPES: TileShape[] = ["sq", "tri-up", "rhomb", "trap"];

export const BUILDER_COLORS: TileColor[] = [
  "red",
  "blue",
  "yellow",
  "green",
  "orange",
  "purple",
];

const COLOR_COUNT_BY_COMPLEXITY: Record<number, number> = {
  1: 2,
  2: 3,
  3: 3,
  4: 3,
  5: 4,
  6: 4,
  7: 5,
  8: 6,
};

/**
 * How many colors the builder palette should expose at a given
 * complexity. Mirrors the goal-pattern color count so the builder
 * picks from the same set the pattern uses.
 */
export function paletteColorCount(complexity: number): number {
  const lvl = Math.max(1, Math.min(8, Math.round(complexity)));
  return COLOR_COUNT_BY_COMPLEXITY[lvl]!;
}

export function paletteColorsFor(complexity: number): TileColor[] {
  return BUILDER_COLORS.slice(0, paletteColorCount(complexity));
}
