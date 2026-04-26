import type { TileColor } from "@/components/canvas/Tile";

const PALETTE: readonly TileColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "teal",
] as const;

/**
 * Deterministic colour from display name. Same name → same colour
 * across reconnects, but different participants in the same game
 * get a spread because we mix the game id in too.
 */
export function colorFor(name: string, gameId: string): TileColor {
  let h = 2166136261;
  const s = `${gameId}::${name.toLowerCase()}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}
