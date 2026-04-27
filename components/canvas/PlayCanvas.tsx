import { CanvasGridBg } from "./CanvasGridBg";
import { CoordinateLabels } from "./CoordinateLabels";
import { Tile } from "./Tile";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL,
  cellToPixel,
  tileSizeFor,
} from "@/lib/grid/coords";
import type { GoalPiece } from "@/lib/pattern/types";

export interface PlayCanvasProps {
  pieces: GoalPiece[];
  /**
   * Optional class name for the wrapper. Caller controls margins +
   * borders; the canvas sizes itself from the grid math.
   */
  className?: string;
  /** Render pieces as ghosts (translucent) — used for goal previews. */
  ghost?: boolean;
  /** Render letter/number coordinate labels along the canvas edges. */
  showCoords?: boolean;
}

/**
 * Read-only canvas. Draws the square grid background plus an array
 * of pieces at their (q, r) cell coords. Used for guider goal
 * preview, observer split view, and (in 3.2) builder placement
 * render.
 */
export function PlayCanvas({
  pieces,
  className,
  ghost = false,
  showCoords = false,
}: PlayCanvasProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: "var(--color-paper)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <CanvasGridBg />
      {showCoords && <CoordinateLabels />}
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
