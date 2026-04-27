"use client";

import { useRef, useState, type PointerEvent } from "react";
import { CanvasGridBg } from "./CanvasGridBg";
import { CoordinateLabels } from "./CoordinateLabels";
import { Tile, type TileColor, type TileShape } from "./Tile";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL,
  GRID_HEIGHT,
  GRID_WIDTH,
  PADDING,
  cellToPixel,
  tileSizeFor,
} from "@/lib/grid/coords";
import type { PlacedPiece } from "@/components/play/PlayContent";

export interface InteractiveCanvasProps {
  pieces: PlacedPiece[];
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
  /** Click on an existing piece — caller decides to select or move-to-cell. */
  onPieceClick: (piece: PlacedPiece) => void;
  /**
   * Click on an empty cell while a piece is in edit mode. Caller moves
   * the editing piece there.
   */
  onMoveTo: (q: number, r: number) => void;
}

/**
 * Builder canvas with three interaction modes:
 *   1. Idle — no shape selected, no piece edited. Hovering an empty
 *      cell shows nothing; clicking a piece selects it for editing.
 *   2. Add — a tray shape is selected. Hovering shows a ghost preview
 *      of the new piece on the targeted cell. Click empty → place.
 *      Click an existing piece → swap to edit mode.
 *   3. Edit — a placement is selected. The piece shows a dashed
 *      bounding box and corner handles. Hover an empty cell shows a
 *      "move here" preview. Click → moves. Click another piece → swap
 *      selection.
 *
 * The canvas always renders a target-cell highlight under the cursor
 * when in Add or Edit mode so the snap target is unambiguous.
 */
export function InteractiveCanvas({
  pieces,
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

  const occupiedById = new Map(pieces.map((p) => [p.id, p]));
  const occupiedByCell = new Map(pieces.map((p) => [`${p.q},${p.r}`, p]));
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
    if (q < 0 || q >= GRID_WIDTH || r < 0 || r >= GRID_HEIGHT) return null;
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

  // Decide what to render at the hover cell.
  const hoverCellEmpty =
    hover && !occupiedByCell.has(`${hover.q},${hover.r}`);
  const showHoverHighlight = interactive && hover && hoverCellEmpty;
  const showAddGhost =
    inAddMode && hoverCellEmpty && hover && selectedShape;
  const showMoveGhost = inEditMode && hoverCellEmpty && hover && editing;

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={handleClick}
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: "var(--color-paper)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        cursor,
      }}
    >
      <CanvasGridBg />
      {showCoords && <CoordinateLabels />}

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

      {/* Existing placements */}
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
              correct={p.correct ?? null}
            />
            {isEditing && <EditingHandles q={p.q} r={p.r} />}
          </div>
        );
      })}

      {/* Add-mode ghost: selected tray shape on hovered cell */}
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
