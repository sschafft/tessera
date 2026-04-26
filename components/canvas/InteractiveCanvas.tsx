"use client";

import { useRef, useState, type PointerEvent } from "react";
import { CanvasGridBg } from "./CanvasGridBg";
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
  /** Currently-selected shape from the tray, or null. */
  selectedShape: TileShape | null;
  selectedColor: TileColor;
  selectedRotation: number;
  /** Called when the user clicks an empty cell with a shape selected. */
  onPlace: (q: number, r: number) => void;
  /** Called when the user clicks an existing piece. */
  onPieceClick: (piece: PlacedPiece) => void;
  /** Optional id of a pending-deletion piece — rendered with a ✕ marker. */
  pendingDeleteId?: string | null;
}

/**
 * Builder canvas with hover ghost + click-to-place.
 *
 * Coordinate model: every event is converted to a cell (q, r) by
 * pixelToCell-equivalent math. The ghost rendering reuses the same Tile
 * primitive as the placed pieces so positioning matches exactly.
 */
export function InteractiveCanvas({
  pieces,
  selectedShape,
  selectedColor,
  selectedRotation,
  onPlace,
  onPieceClick,
  pendingDeleteId,
}: InteractiveCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ q: number; r: number } | null>(null);

  const occupied = new Map(pieces.map((p) => [`${p.q},${p.r}`, p]));

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
    if (!selectedShape) {
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
    const existing = occupied.get(`${cell.q},${cell.r}`);
    if (existing) {
      onPieceClick(existing);
      return;
    }
    if (selectedShape) onPlace(cell.q, cell.r);
  };

  const ghostOk =
    selectedShape && hover && !occupied.has(`${hover.q},${hover.r}`);

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
        cursor: selectedShape ? "crosshair" : "default",
      }}
    >
      <CanvasGridBg />

      {/* Existing placements */}
      {pieces.map((p) => {
        const { x, y } = cellToPixel({ q: p.q, r: p.r });
        const size = tileSizeFor(p.shape);
        const offset = (size - CELL) / 2;
        return (
          <div key={p.id} style={{ position: "absolute" }}>
            <Tile
              kind={p.shape}
              color={p.color}
              x={x - offset}
              y={y - offset}
              size={size}
              rotate={p.rot * 60}
              correct={p.correct ?? null}
            />
            {pendingDeleteId === p.id && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: x + CELL / 2 + 18,
                  top: y - 6,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--color-t-red)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 12,
                  boxShadow: "0 2px 6px rgba(0,0,0,.25)",
                }}
              >
                ×
              </span>
            )}
          </div>
        );
      })}

      {/* Hover ghost (only when a shape is selected and the cell is empty) */}
      {ghostOk && hover && (
        (() => {
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
              rotate={selectedRotation * 60}
              ghost
            />
          );
        })()
      )}
    </div>
  );
}
