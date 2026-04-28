import { CanvasGridBg } from "./CanvasGridBg";
import { CoordinateLabels } from "./CoordinateLabels";
import { Tile } from "./Tile";
import {
  CELL,
  canvasSizeFor,
  cellToPixel,
  gridSizeFor,
  tileSizeFor,
} from "@/lib/grid/coords";
import type { GoalPiece } from "@/lib/pattern/types";

export interface PlayCanvasProps {
  pieces: GoalPiece[];
  /** Round complexity — drives grid + canvas size. */
  complexity: number;
  /** Optional class name for the wrapper. */
  className?: string;
  /** Render pieces as ghosts (translucent) — used for goal previews. */
  ghost?: boolean;
  /** Render letter/number coordinate labels along the canvas edges. */
  showCoords?: boolean;
  /**
   * Optional per-piece correctness flags, parallel to `pieces`. When
   * provided, pieces with `correctness[i] === true` get a pulsing
   * green halo. Used by GuiderView to mirror the live builder
   * correctness on the goal canvas (paired with Test Build), so
   * the guider sees which goal positions are currently satisfied
   * without needing the builder's own placements rendered.
   */
  correctness?: boolean[];
}

/**
 * Read-only canvas. Square grid sized to round complexity, plus an
 * array of pieces at their (q, r) cells. Used for guider goal preview,
 * observer split view, and GM dashboards.
 */
export function PlayCanvas({
  pieces,
  complexity,
  className,
  ghost = false,
  showCoords = false,
  correctness,
}: PlayCanvasProps) {
  const grid = gridSizeFor(complexity);
  const { width, height } = canvasSizeFor(complexity);
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        background: "#fff",
        borderRadius: "var(--radius-lg)",
        boxShadow:
          "0 1px 0 rgba(0,0,0,0.04), 0 6px 14px rgba(60,40,10,0.10), inset 0 0 0 1.5px rgba(60,40,10,0.06)",
        overflow: "hidden",
      }}
    >
      <CanvasGridBg width={width} height={height} />
      {showCoords && <CoordinateLabels width={grid.w} height={grid.h} />}
      {pieces.map((p, i) => {
        const { x, y } = cellToPixel({ q: p.q, r: p.r });
        const size = tileSizeFor(p.shape);
        const offset = (size - CELL) / 2;
        const isCorrect = correctness?.[i] === true;
        return (
          <div key={i} style={{ position: "absolute", inset: 0 }}>
            {isCorrect && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: x - offset - 4,
                  top: y - offset - 4,
                  width: size + 8,
                  height: size + 8,
                  borderRadius: 8,
                  background: "var(--color-tint-green)",
                  boxShadow: "0 0 0 2px var(--color-t-green)",
                  animation: "tessera-correct-pulse 1600ms ease-in-out infinite",
                  pointerEvents: "none",
                }}
              />
            )}
            <Tile
              kind={p.shape}
              color={p.color}
              x={x - offset}
              y={y - offset}
              size={size}
              rotate={p.rot * 90}
              ghost={ghost}
            />
            {isCorrect && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: x - offset + size - 14,
                  top: y - offset - 6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--color-t-green)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                  pointerEvents: "none",
                }}
              >
                ✓
              </span>
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes tessera-correct-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
