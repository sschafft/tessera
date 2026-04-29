import { CELL, PADDING } from "@/lib/grid/coords";

export interface CanvasGridBgProps {
  /** Total canvas width in px (used to clip the pattern at the right edge). */
  width: number;
  /** Total canvas height in px. */
  height: number;
}

/**
 * Square cell-grid background for the canvas. One faint line every
 * CELL pixels, padded to match the grid origin. Pattern is sized to
 * the parent canvas via explicit width/height so smaller grids don't
 * paint stray cells outside their envelope.
 */
export function CanvasGridBg({ width, height }: CanvasGridBgProps) {
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        // Bumped from 0.6 → 1.0 with a stronger ink shade. Players
        // reported the cells were hard to see when describing
        // positions on the call ("the row second from the top"
        // requires the grid lines to actually read).
        opacity: 1,
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
            stroke="rgba(60,40,10,.32)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect
        x={PADDING}
        y={PADDING}
        width={width - PADDING * 2}
        height={height - PADDING * 2}
        fill="url(#square-grid)"
      />
    </svg>
  );
}
