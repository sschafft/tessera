import type { GoalPattern } from "@/lib/pattern/types";

export interface ScoringConfig {
  correctPts: number;
  wrongPts: number;
}

export interface ScoredPlacement {
  id: string;
  shape: string;
  color: string;
  q: number;
  r: number;
  rot: number;
  correct: boolean;
}

export interface ScoreBreakdown {
  correct: number;
  wrong: number;
  /** Total goal piece count — needed for "X / Y placed" type displays. */
  total: number;
  score: number;
  /** True when the GM's wrong-penalty was applied. */
  penaltyApplied: boolean;
  /** Per-placement correctness, in original order. */
  placements: ScoredPlacement[];
  /**
   * Per-goal-piece correctness, parallel to the input goal array.
   * `true` at index i means the builder has placed a piece that
   * matches goal[i] (shape + color + position + rotation,
   * normalized for symmetry). Drives the guider's mirrored
   * "X / Y satisfied" view without leaking the builder's wrong
   * placements.
   */
  goalCorrectness: boolean[];
}

/**
 * Rotational symmetry per shape: how many distinct visual orientations
 * a piece has out of the four 90° steps the canvas permits. Squares
 * (and hexagons) look the same at every rotation, so any rot value
 * collapses to 0. Rhombus has 2-fold symmetry: rot 0/2 are visually
 * the same, as are 1/3. Triangles, trapezoids, and pentagons orient
 * meaningfully at every step.
 */
function normalizeRot(shape: string, rot: number): number {
  if (shape === "sq" || shape === "hex") return 0;
  if (shape === "rhomb") return ((rot % 2) + 2) % 2;
  return ((rot % 4) + 4) % 4;
}

/**
 * Compute the per-pair-round score:
 *   score = correctPts * correct + wrongPts * wrong
 *
 * Wrong placements scale linearly so a builder who blankets the canvas
 * doesn't get a free ride. `wrongPts` is the per-wrong penalty (0 to
 * disable, negative to punish). With correctPts=10 and wrongPts=-1, a
 * 4-correct / 6-wrong attempt nets 40 - 6 = 34. Scores are intentionally
 * NOT clamped at 0 — the GM can tune wrongPts down to push aggressive
 * guessers into negative territory.
 */
export function scorePlacements(
  placements: Array<{
    id: string;
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
  }>,
  goal: GoalPattern,
  config: ScoringConfig,
): ScoreBreakdown {
  const goalKey = (g: {
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
  }) =>
    `${g.shape}|${g.color}|${g.q},${g.r}|${normalizeRot(g.shape, g.rot)}`;
  const goalSet = new Set(goal.map(goalKey));
  const placementSet = new Set(placements.map(goalKey));

  let correct = 0;
  let wrong = 0;
  const scored: ScoredPlacement[] = placements.map((p) => {
    const ok = goalSet.has(goalKey(p));
    if (ok) correct += 1;
    else wrong += 1;
    return {
      id: p.id,
      shape: p.shape,
      color: p.color,
      q: p.q,
      r: p.r,
      rot: p.rot,
      correct: ok,
    };
  });
  const goalCorrectness = goal.map((g) => placementSet.has(goalKey(g)));

  const score = config.correctPts * correct + config.wrongPts * wrong;
  const penaltyApplied = wrong > 0 && config.wrongPts !== 0;

  return {
    correct,
    wrong,
    total: goal.length,
    score,
    penaltyApplied,
    placements: scored,
    goalCorrectness,
  };
}
