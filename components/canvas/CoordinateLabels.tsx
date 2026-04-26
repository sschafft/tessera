import {
  CELL,
  GRID_HEIGHT,
  GRID_WIDTH,
  PADDING,
} from "@/lib/grid/coords";

const LETTERS = "ABCDEFGHIJKLMN";

/**
 * Letter (column) and number (row) labels along the top + left edges
 * of the canvas. Helps guider + builder talk about positions on a
 * call ("the red triangle goes on B3"). Only rendered at lower
 * complexity levels where the verbal scaffold is appropriate.
 */
export function CoordinateLabels() {
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
      {/* Column letters along the top */}
      {Array.from({ length: GRID_WIDTH }, (_, q) => (
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
      {/* Row numbers down the left */}
      {Array.from({ length: GRID_HEIGHT }, (_, r) => (
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
