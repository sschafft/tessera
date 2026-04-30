"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { CanvasGridBg } from "./CanvasGridBg";
import { CoordinateLabels } from "./CoordinateLabels";
import { Tile, type TileColor, type TileShape } from "./Tile";
import {
  CELL,
  PADDING,
  canvasSizeFor,
  cellToPixel,
  gridSizeFor,
  tileSizeFor,
} from "@/lib/grid/coords";
import type { PlacedPiece } from "@/components/play/PlayContent";

export interface InteractiveCanvasProps {
  pieces: PlacedPiece[];
  /** Round complexity — drives grid + canvas size. */
  complexity: number;
  /** Selected shape from the tray; non-null = "add" mode. */
  selectedShape: TileShape | null;
  selectedColor: TileColor;
  selectedRotation: number;
  /** Currently-selected existing piece by id. Non-null = "edit" mode. */
  editingId: string | null;
  /** Show letter/number coordinate labels on the canvas edges. */
  showCoords?: boolean;

  /** Click on an empty cell with a tray shape selected. */
  onPlace: (q: number, r: number) => void;
  /**
   * Click on an existing piece. The caller decides what to do:
   *   - In Add mode: convert that piece to the selected shape/color/rot.
   *   - Otherwise: enter edit mode for that piece.
   */
  onPieceClick: (piece: PlacedPiece) => void;
  /**
   * Click on an empty cell while a piece is in edit mode. The caller
   * moves the editing piece there.
   */
  onMoveTo: (q: number, r: number) => void;
}

/**
 * Builder canvas. One shape per cell on a square grid sized to the
 * round's complexity.
 *
 *   - Idle (no shape selected, no piece edited):
 *     hover does nothing; clicking a piece selects it for editing.
 *   - Add (a tray shape is selected):
 *     hover shows a ghost preview of the new piece on the targeted
 *     cell. Click empty → place. Click an existing piece → caller
 *     converts it in place to the selection.
 *   - Edit (an existing placement is selected):
 *     piece shows a dashed bounding box and corner handles. Hover an
 *     empty cell → "move here" preview. Click empty → moves. Click
 *     another piece → swap selection.
 */
export function InteractiveCanvas({
  pieces,
  complexity,
  selectedShape,
  selectedColor,
  selectedRotation,
  editingId,
  showCoords = false,
  onPlace,
  onPieceClick,
  onMoveTo,
}: InteractiveCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ q: number; r: number } | null>(null);
  const grid = gridSizeFor(complexity);
  const { width, height } = canvasSizeFor(complexity);

  // Memoise on `pieces` identity so unrelated state changes (cursor
  // hover, sidebar tray tweaks) don't churn through the .map() loops
  // every render. Both maps are read-only — recomputing them only
  // when the placements list actually changes is a free win.
  const occupiedById = useMemo(
    () => new Map(pieces.map((p) => [p.id, p])),
    [pieces],
  );
  const occupiedByCell = useMemo(
    () => new Map(pieces.map((p) => [`${p.q},${p.r}`, p])),
    [pieces],
  );
  const editing = editingId ? (occupiedById.get(editingId) ?? null) : null;
  const inAddMode = selectedShape !== null;
  const inEditMode = editing !== null;
  const interactive = inAddMode || inEditMode;

  const eventToCell = (e: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const q = Math.round((x - PADDING) / CELL);
    const r = Math.round((y - PADDING) / CELL);
    if (q < 0 || q >= grid.w || r < 0 || r >= grid.h) return null;
    return { q, r };
  };

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) {
      if (hover !== null) setHover(null);
      return;
    }
    const cell = eventToCell(e);
    if (cell && (cell.q !== hover?.q || cell.r !== hover?.r)) setHover(cell);
    if (!cell && hover !== null) setHover(null);
  };

  const handleLeave = () => setHover(null);

  const handleClick = (e: PointerEvent<HTMLDivElement>) => {
    const cell = eventToCell(e);
    if (!cell) return;
    const existing = occupiedByCell.get(`${cell.q},${cell.r}`);

    if (existing) {
      onPieceClick(existing);
      return;
    }
    // Empty cell.
    if (inEditMode && editing) {
      onMoveTo(cell.q, cell.r);
      return;
    }
    if (inAddMode && selectedShape) {
      onPlace(cell.q, cell.r);
    }
  };

  const cursor = !interactive
    ? "default"
    : inEditMode
      ? "move"
      : "crosshair";

  // What to render at the hover cell.
  const hoverCellOccupant =
    hover && occupiedByCell.get(`${hover.q},${hover.r}`);
  const hoverCellEmpty = hover && !hoverCellOccupant;
  const showHoverHighlight = interactive && hoverCellEmpty;
  const showAddGhost = inAddMode && hoverCellEmpty && hover && selectedShape;
  const showMoveGhost = inEditMode && hoverCellEmpty && hover && editing;
  // Add-mode hovering an occupied cell → preview the swap with a red
  // outline on the existing piece + a small "swap" pill.
  const showSwapHint = inAddMode && hover && hoverCellOccupant;

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={handleClick}
      style={{
        position: "relative",
        width,
        height,
        // White card surface stands out from the paper page bg + soft
        // emboss so the play area reads as the focal element.
        background: "#fff",
        borderRadius: "var(--radius-lg)",
        boxShadow:
          "0 1px 0 rgba(0,0,0,0.04), 0 6px 14px rgba(60,40,10,0.10), inset 0 0 0 1.5px rgba(60,40,10,0.06)",
        overflow: "hidden",
        cursor,
      }}
    >
      <CanvasGridBg width={width} height={height} />
      {showCoords && <CoordinateLabels width={grid.w} height={grid.h} />}

      {/* Cell highlight under cursor */}
      {showHoverHighlight && hover && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: PADDING + hover.q * CELL - 2,
            top: PADDING + hover.r * CELL - 2,
            width: CELL + 4,
            height: CELL + 4,
            borderRadius: 8,
            border: `2px solid ${
              inEditMode ? "var(--color-t-orange)" : "var(--color-t-blue)"
            }`,
            background: inEditMode
              ? "rgba(255, 138, 31, 0.08)"
              : "rgba(44, 123, 232, 0.08)",
            transition: "left 70ms linear, top 70ms linear",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Swap-hint outline on an existing piece in add mode */}
      {showSwapHint && hover && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: PADDING + hover.q * CELL - 4,
            top: PADDING + hover.r * CELL - 4,
            width: CELL + 8,
            height: CELL + 8,
            borderRadius: 10,
            border: "2px dashed var(--color-t-red)",
            background: "rgba(238, 58, 58, 0.06)",
            pointerEvents: "none",
            transition: "left 70ms linear, top 70ms linear",
          }}
        />
      )}

      {/* Existing placements. Correctness badges live in a separate
          overlay layer below so toggling correct/wrong feedback after
          a Test solution doesn't re-render every Tile (the SVG path
          stays stable; only the small badge layer flips). */}
      {pieces.map((p) => {
        const { x, y } = cellToPixel({ q: p.q, r: p.r });
        const size = tileSizeFor(p.shape);
        const offset = (size - CELL) / 2;
        const isEditing = editing?.id === p.id;
        return (
          <div key={p.id} style={{ position: "absolute" }}>
            <Tile
              kind={p.shape}
              color={p.color}
              x={x - offset}
              y={y - offset}
              size={size}
              rotate={p.rot * 90}
            />
            {isEditing && <EditingHandles q={p.q} r={p.r} />}
          </div>
        );
      })}

      {/* Correctness overlay — only the pieces whose `correct` flag
          is non-null get a badge. Decoupled from Tile so flipping the
          badge after a Test doesn't bust Tile's memo. */}
      {pieces.map((p) => {
        if (p.correct === null || p.correct === undefined) return null;
        const { x, y } = cellToPixel({ q: p.q, r: p.r });
        const size = tileSizeFor(p.shape);
        const offset = (size - CELL) / 2;
        return (
          <CorrectnessBadge
            key={`badge-${p.id}`}
            x={x - offset}
            y={y - offset}
            size={size}
            correct={p.correct}
          />
        );
      })}

      {/* Add-mode ghost: selected tray shape on hovered empty cell */}
      {showAddGhost && hover && selectedShape && (() => {
        const { x, y } = cellToPixel(hover);
        const size = tileSizeFor(selectedShape);
        const offset = (size - CELL) / 2;
        return (
          <Tile
            kind={selectedShape}
            color={selectedColor}
            x={x - offset}
            y={y - offset}
            size={size}
            rotate={selectedRotation * 90}
            ghost
          />
        );
      })()}

      {/* Move-mode ghost: editing piece preview at hovered empty cell */}
      {showMoveGhost && hover && editing && (() => {
        const { x, y } = cellToPixel(hover);
        const size = tileSizeFor(editing.shape);
        const offset = (size - CELL) / 2;
        return (
          <Tile
            kind={editing.shape}
            color={editing.color}
            x={x - offset}
            y={y - offset}
            size={size}
            rotate={editing.rot * 90}
            ghost
          />
        );
      })()}
    </div>
  );
}

/** Small green/red dot at the tile's top-right corner. Pure visual,
 *  no interaction. Kept as its own component so React.memo can
 *  short-circuit the badge render when only `correct` flips. */
const CorrectnessBadge = (function makeBadge() {
  const Cmp = ({
    x,
    y,
    size,
    correct,
  }: {
    x: number;
    y: number;
    size: number;
    correct: boolean;
  }) => (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: x + size * 0.8 - 9,
        top: y + size * 0.2 - 9,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: correct ? "#46b86a" : "#ee3a3a",
        border: "2.5px solid #fff",
        boxShadow: "0 1px 2px rgba(0,0,0,.18)",
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
  Cmp.displayName = "CorrectnessBadge";
  return Cmp;
})();

function EditingHandles({ q, r }: { q: number; r: number }) {
  const { x, y } = cellToPixel({ q, r });
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: x - 6,
        top: y - 6,
        width: CELL + 12,
        height: CELL + 12,
        border: "2px dashed var(--color-t-orange)",
        borderRadius: 8,
        pointerEvents: "none",
      }}
    >
      {[
        { left: -7, top: -7 },
        { right: -7, top: -7 },
        { left: -7, bottom: -7 },
        { right: -7, bottom: -7 },
      ].map((pos, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "#fff",
            border: "2px solid var(--color-t-orange)",
          }}
        />
      ))}
    </div>
  );
}
