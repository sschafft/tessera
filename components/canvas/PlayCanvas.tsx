import { CanvasGridBg } from "./CanvasGridBg";
import { Tile } from "./Tile";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
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
}

/**
 * Read-only canvas. Draws the triangular grid background plus an array
 * of pieces at their (q, r) cell coords. Used for guider goal preview,
 * observer split view, and (in 3.2) builder placement render.
 */
export function PlayCanvas({ pieces, className, ghost = false }: PlayCanvasProps) {
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
      {pieces.map((p, i) => {
        const { x, y } = cellToPixel({ q: p.q, r: p.r });
        const size = tileSizeFor(p.shape);
        // Centre the tile on its cell rather than top-left.
        const offset = (size - 64) / 2;
        return (
          <Tile
            key={i}
            kind={p.shape}
            color={p.color}
            x={x - offset}
            y={y - offset}
            size={size}
            rotate={p.rot * 60}
            ghost={ghost}
          />
        );
      })}
    </div>
  );
}
