import { Tile } from "@/components/canvas/Tile";

export interface WordmarkProps {
  /** Approximate height of the type in px. The icon scales with it. */
  size?: number;
}

/**
 * Wordmark — Tessera's text-only lockup (per locked decision §10/14, the
 * brand mark is the word "tessera" in Fraunces, with a small icon built
 * from a yellow hex + red triangle that matches the goal-pattern hero.
 */
export function Wordmark({ size = 22 }: WordmarkProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative"
        style={{ width: size + 10, height: size + 10 }}
        aria-hidden="true"
      >
        <Tile kind="hex" color="yellow" x={0} y={2} size={size + 6} />
        <Tile kind="tri-up" color="red" x={4} y={-2} size={size - 4} />
      </div>
      <span
        className="t-display font-bold tracking-tight"
        style={{ fontSize: size }}
      >
        tessera
      </span>
    </div>
  );
}
