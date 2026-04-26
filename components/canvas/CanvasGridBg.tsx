import { CELL, PADDING } from "@/lib/grid/coords";

/**
 * Square cell-grid background for the canvas. One faint line every
 * CELL pixels, padded to match the grid origin. The grid is the
 * primary visual reference players use to align pieces; coordinate
 * labels (A1, B2, …) sit on top via <CoordinateLabels />.
 */
export function CanvasGridBg() {
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.6,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="square-grid"
          width={CELL}
          height={CELL}
          x={PADDING}
          y={PADDING}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${CELL} 0 L 0 0 0 ${CELL}`}
            fill="none"
            stroke="rgba(60,40,10,.14)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#square-grid)" />
    </svg>
  );
}
