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
        return (
          <Tile
            key={i}
            kind={p.shape}
            color={p.color}
            x={x - offset}
            y={y - offset}
            size={size}
            rotate={p.rot * 90}
            ghost={ghost}
          />
        );
      })}
    </div>
  );
}
