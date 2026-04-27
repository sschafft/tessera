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
}

/**
 * Compute the per-pair-round score:
 *   score = correctPts * correct
 *           + (wrong > 0 ? wrongPts : 0)
 *
 * Note that the wrong-penalty is FLAT — one application no matter how
 * many wrong placements there are. The GM-tunable `wrongPts` defaults
 * to 0; flipping it to -1 via the scoring super-power makes attempting
 * carry a small cost while still letting a single correct placement
 * net positive (10 + -1 = 9).
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
  }) => `${g.shape}|${g.color}|${g.q},${g.r}|${g.rot}`;
  const goalSet = new Set(goal.map(goalKey));

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

  const base = config.correctPts * correct;
  const penaltyApplied = wrong > 0 && config.wrongPts !== 0;
  const score = penaltyApplied ? base + config.wrongPts : base;

  return {
    correct,
    wrong,
    total: goal.length,
    score,
    penaltyApplied,
    placements: scored,
  };
}
