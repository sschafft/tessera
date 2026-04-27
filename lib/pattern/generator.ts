import { gridSizeFor } from "@/lib/grid/coords";
import { BUILDER_COLORS, BUILDER_SHAPES, paletteColorCount } from "./palette";
import type {
  GeneratePatternInput,
  GoalPattern,
  GoalPiece,
} from "./types";

interface ComplexityProfile {
  pieces: [number, number]; // min, max
  shapes: number; // distinct shape kinds available
}

const PROFILES: Record<number, ComplexityProfile> = {
  1: { pieces: [3, 3], shapes: 1 },
  2: { pieces: [4, 4], shapes: 2 },
  3: { pieces: [5, 5], shapes: 2 },
  4: { pieces: [6, 7], shapes: 3 },
  5: { pieces: [8, 8], shapes: 3 },
  6: { pieces: [9, 10], shapes: 4 },
  7: { pieces: [11, 12], shapes: 4 },
  8: { pieces: [13, 16], shapes: 4 },
};

/**
 * 32-bit FNV-1a → seeds a small xorshift PRNG. Same seed → same sequence.
 * Avoids any external rng dep.
 */
function makeRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h | 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff);
  };
}

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  const i = Math.floor(rng() * arr.length);
  return arr[Math.min(i, arr.length - 1)]!;
}

function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Generate a goal pattern. Pieces are placed on a square grid (q, r)
 * with one piece per cell. Higher complexity = wider grid, more
 * pieces, more shape + colour variety.
 *
 * The pattern is centre-clustered: every complexity weights cells
 * closer to the middle higher, so patterns feel composed rather than
 * scattered to the corners.
 */
export function generatePattern({
  complexity,
  seed,
}: GeneratePatternInput): GoalPattern {
  const lvl = Math.max(1, Math.min(8, Math.round(complexity)));
  const profile = PROFILES[lvl]!;
  const rng = makeRng(seed);
  const grid = gridSizeFor(lvl);

  // Pick subsets of shapes + colors for this pattern. Color count comes
  // from the shared palette helper so the builder's tray and the goal
  // pattern always agree on the active palette.
  const shapes = shuffle(rng, BUILDER_SHAPES).slice(0, profile.shapes);
  const colors = shuffle(rng, BUILDER_COLORS).slice(0, paletteColorCount(lvl));

  const targetCount = pickInt(rng, profile.pieces[0], profile.pieces[1]);

  // Build a list of candidate cells, prefer cells closer to centre.
  const cells: { q: number; r: number; weight: number }[] = [];
  const cx = (grid.w - 1) / 2;
  const cy = (grid.h - 1) / 2;
  const spread = grid.w; // diagonal-ish reach
  for (let q = 0; q < grid.w; q++) {
    for (let r = 0; r < grid.h; r++) {
      const dist = Math.hypot(q - cx, r - cy);
      const weight = Math.max(0.05, spread - dist);
      cells.push({ q, r, weight });
    }
  }

  // Weighted sampling without replacement.
  const used = new Set<string>();
  const picked: { q: number; r: number }[] = [];
  while (picked.length < targetCount && cells.length - used.size > 0) {
    const remaining = cells.filter((c) => !used.has(`${c.q},${c.r}`));
    const totalWeight = remaining.reduce((s, c) => s + c.weight, 0);
    let target = rng() * totalWeight;
    for (const c of remaining) {
      target -= c.weight;
      if (target <= 0) {
        used.add(`${c.q},${c.r}`);
        picked.push({ q: c.q, r: c.r });
        break;
      }
    }
  }

  const pattern: GoalPattern = picked.map(({ q, r }) => {
    const piece: GoalPiece = {
      shape: pickFrom(rng, shapes),
      color: pickFrom(rng, colors),
      q,
      r,
      // Rotation: 0..3 in 90° steps. tri/rhomb/trap orient meaningfully.
      rot: pickInt(rng, 0, 3),
    };
    return piece;
  });

  return pattern;
}
