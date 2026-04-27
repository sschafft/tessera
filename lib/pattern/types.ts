import type { TileColor, TileShape } from "@/components/canvas/Tile";

/**
 * A single piece in a goal pattern. Stored at integer grid coords (q, r),
 * with rotation in 90° steps (0..3). Rotation is rendered as `rot * 90deg`.
 */
export interface GoalPiece {
  shape: TileShape;
  color: TileColor;
  q: number;
  r: number;
  rot: number;
}

export type GoalPattern = GoalPiece[];

/**
 * Inputs to the pattern generator. The seed makes generation
 * deterministic — Randomizer feeds in `(complexity, round_id, pair_id)`
 * to ensure no two pairs / rounds get identical patterns.
 */
export interface GeneratePatternInput {
  /** 1..8 — drives piece count, shape variety, color variety. */
  complexity: number;
  /** A short string seed; fed into the PRNG. */
  seed: string;
}
