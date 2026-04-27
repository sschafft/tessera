import { CELL, PADDING } from "@/lib/grid/coords";

const LETTERS = "ABCDEFGHIJKLMN";

export interface CoordinateLabelsProps {
  width: number;
  height: number;
}

/**
 * Letter (column) and number (row) labels along the top + left edges.
 * Helps guider + builder talk about positions on a call ("the red
 * triangle goes on B3"). Sized to the round's grid via props.
 */
export function CoordinateLabels({ width, height }: CoordinateLabelsProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        color: "var(--color-ink-3)",
        letterSpacing: ".05em",
      }}
    >
      {Array.from({ length: width }, (_, q) => (
        <span
          key={`col-${q}`}
          style={{
            position: "absolute",
            left: PADDING + q * CELL,
            top: 8,
            width: CELL,
            textAlign: "center",
          }}
        >
          {LETTERS[q] ?? ""}
        </span>
      ))}
      {Array.from({ length: height }, (_, r) => (
        <span
          key={`row-${r}`}
          style={{
            position: "absolute",
            top: PADDING + r * CELL,
            left: 8,
            height: CELL,
            display: "flex",
            alignItems: "center",
          }}
        >
          {r + 1}
        </span>
      ))}
    </div>
  );
}
