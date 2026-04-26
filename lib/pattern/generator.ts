import type { TileColor, TileShape } from "@/components/canvas/Tile";
import type {
  GeneratePatternInput,
  GoalPattern,
  GoalPiece,
} from "./types";

const ALL_COLORS: TileColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "teal",
];

const ALL_SHAPES: TileShape[] = [
  "tri-up",
  "tri-dn",
  "sq",
  "rhomb",
  "trap",
  "hex",
];

interface ComplexityProfile {
  pieces: [number, number]; // min, max
  shapes: number; // distinct shape kinds available
  colors: number; // distinct colors available
}

const PROFILES: Record<number, ComplexityProfile> = {
  1: { pieces: [3, 3], shapes: 1, colors: 1 },
  2: { pieces: [4, 4], shapes: 2, colors: 2 },
  3: { pieces: [5, 5], shapes: 2, colors: 3 },
  4: { pieces: [6, 7], shapes: 3, colors: 3 },
  5: { pieces: [8, 8], shapes: 3, colors: 4 },
  6: { pieces: [9, 10], shapes: 4, colors: 5 },
  7: { pieces: [11, 12], shapes: 5, colors: 6 },
  8: { pieces: [13, 16], shapes: 6, colors: 7 },
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

/** Canvas grid envelope. The pattern generator targets a 9-wide × 7-tall area. */
const GRID_WIDTH = 9;
const GRID_HEIGHT = 7;

/**
 * Generate a goal pattern. Pieces are placed on a square grid (q, r)
 * with one piece per cell. Higher complexity = more pieces, more shape
 * + colour variety.
 *
 * The pattern is centred-ish: lower complexities cluster pieces around
 * the centre; higher complexities spread out.
 */
export function generatePattern({
  complexity,
  seed,
}: GeneratePatternInput): GoalPattern {
  const lvl = Math.max(1, Math.min(8, Math.round(complexity)));
  const profile = PROFILES[lvl]!;
  const rng = makeRng(seed);

  // Pick subsets of shapes + colors for this pattern.
  const shapes = shuffle(rng, ALL_SHAPES).slice(0, profile.shapes);
  const colors = shuffle(rng, ALL_COLORS).slice(0, profile.colors);

  const targetCount = pickInt(rng, profile.pieces[0], profile.pieces[1]);

  // Build a list of candidate cells, prefer cells closer to centre at
  // low complexity. Centre is (4, 3).
  const cells: { q: number; r: number; weight: number }[] = [];
  const cx = 4;
  const cy = 3;
  for (let q = 0; q < GRID_WIDTH; q++) {
    for (let r = 0; r < GRID_HEIGHT; r++) {
      const dist = Math.hypot(q - cx, r - cy);
      // tighter spread at lower complexity
      const spread = 1.5 + lvl * 0.5;
      const weight = Math.max(0, spread - dist);
      if (weight > 0) cells.push({ q, r, weight });
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
      // Rotation: tri/rhomb/trap orient meaningfully; sq/hex look ~same.
      rot: pickInt(rng, 0, 5),
    };
    return piece;
  });

  return pattern;
}
