"use client";

import { memo, useMemo, useRef, useState, type PointerEvent } from "react";
import { CanvasGridBg } from "@/components/canvas/CanvasGridBg";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import {
  CELL,
  PADDING,
  canvasSizeFor,
  cellToPixel,
  gridSizeFor,
  tileSizeFor,
} from "@/lib/grid/coords";
import type { PlacedPiece } from "@/components/play/PlayContent";
import { CoordRulers } from "./CoordRulers";
import { EmptyHint } from "./EmptyHint";
import { WrongTooltip } from "./WrongTooltip";

/**
 * Single-target model. Either:
 *   - phantom : armed for a placement at cell (q, r) with given attrs
 *   - piece   : a placed piece is the active edit target
 *   - null    : idle
 */
export type BuilderTarget =
  | { kind: "phantom"; q: number; r: number; shape: TileShape; color: TileColor; rot: number }
  | { kind: "piece"; id: string }
  | null;

export interface BuilderCanvasProps {
  pieces: PlacedPiece[];
  complexity: number;
  target: BuilderTarget;
  /**
   * Defaults the hover ghost reads when target is null. Same defaults
   * the parent will use to mint a new phantom on the next empty-cell
   * tap. Keeps the canvas dumb — it doesn't need to know the parent's
   * "next-piece" state, just gets the values to render with.
   */
  defaultShape: TileShape;
  defaultColor: TileColor;
  defaultRotation: number;
  /**
   * Click handler for ANY cell — empty or occupied. The parent
   * interprets the (q, r) and the current target to decide whether
   * to start a phantom, commit a phantom, move an editing piece, or
   * enter edit mode on a piece.
   */
  onCellClick: (q: number, r: number) => void;
  /**
   * Click handler for a placed piece. Fired before onCellClick when
   * a click lands on a piece, so the parent can short-circuit straight
   * into edit mode without resolving cell math twice.
   */
  onPieceClick: (piece: PlacedPiece) => void;
}

/**
 * Builder UX foundation: canvas surface for the single-target model.
 * Replaces InteractiveCanvas's add/edit dichotomy.
 *
 * - Hover ghost shows what would land if you tapped (only when
 *   target is null — the dock's previewing the same data).
 * - Phantom (target.kind === "phantom") renders as a dashed-border
 *   tile at its cell with the dock's current shape/color/rot.
 * - Piece halo (target.kind === "piece") draws a solid outline
 *   around the targeted piece.
 * - Coord rulers always visible. Empty hint shows when the board is
 *   bare. Wrong-because tooltip mounts only on hover of a wrong
 *   piece — zero render cost otherwise.
 *
 * Latency notes:
 * - `occupiedByCell` memoised on `pieces` identity so cursor moves
 *   don't churn the .map() loops.
 * - Hit-target buttons use cell-keyed `aria-label`s; React.memo'ing
 *   each cell would cost more than the cheap re-render.
 * - The wrong-because tooltip sets state ONLY on enter/leave of a
 *   wrong piece — neutral pieces don't write to state on hover.
 */
function BuilderCanvasImpl({
  pieces,
  complexity,
  target,
  defaultShape,
  defaultColor,
  defaultRotation,
  onCellClick,
  onPieceClick,
}: BuilderCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ q: number; r: number } | null>(null);
  const [hoverWrong, setHoverWrong] = useState<{
    pieceId: string;
    x: number;
    y: number;
  } | null>(null);

  const grid = gridSizeFor(complexity);
  const { width, height } = canvasSizeFor(complexity);

  // Memoised occupancy lookup. `pieces` identity drives this — when
  // an optimistic patch updates a single piece's q/r, the new array
  // reference triggers one rebuild. Cursor hovers don't.
  const occupiedByCell = useMemo(() => {
    const m = new Map<string, PlacedPiece>();
    for (const p of pieces) m.set(`${p.q},${p.r}`, p);
    return m;
  }, [pieces]);

  // Derived target geometry — cheap, runs once per render.
  const phantom = target?.kind === "phantom" ? target : null;
  const editingId = target?.kind === "piece" ? target.id : null;

  const targetCell = phantom
    ? { q: phantom.q, r: phantom.r }
    : editingId
      ? (() => {
          const p = pieces.find((pp) => pp.id === editingId);
          return p ? { q: p.q, r: p.r } : null;
        })()
      : null;

  const isInteractive = target !== null || hover !== null;
  void isInteractive;

  const eventToCell = (
    e: PointerEvent<HTMLDivElement>,
  ): { q: number; r: number } | null => {
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
    const cell = eventToCell(e);
    if (cell && (cell.q !== hover?.q || cell.r !== hover?.r)) setHover(cell);
    if (!cell && hover !== null) setHover(null);
  };

  const handleLeave = () => {
    setHover(null);
    setHoverWrong(null);
  };

  // Surface a hover ghost ONLY when the dock's idle. When a phantom
  // is already armed at a cell, the dock IS the preview; doubling up
  // a hover ghost on top of the phantom adds visual noise.
  const showHoverGhost =
    target === null && hover !== null && !occupiedByCell.has(`${hover.q},${hover.r}`);

  // Highlight the row + column of whatever's the active "anchor" — the
  // phantom cell, the editing piece's cell, or the hover cell while
  // idle. Falls back to none.
  const rulerCol =
    targetCell?.q ?? (target === null ? (hover?.q ?? null) : null);
  const rulerRow =
    targetCell?.r ?? (target === null ? (hover?.r ?? null) : null);

  return (
    <div style={{ position: "relative" }}>
      <CoordRulers
        cols={grid.w}
        rows={grid.h}
        highlightCol={rulerCol}
        highlightRow={rulerRow}
      />

      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        style={{
          position: "relative",
          width,
          height,
          background: "#fff",
          borderRadius: "var(--radius-lg)",
          boxShadow:
            "0 1px 0 rgba(0,0,0,0.04), 0 6px 14px rgba(60,40,10,0.10), inset 0 0 0 1.5px rgba(60,40,10,0.06)",
          overflow: "hidden",
          cursor: target !== null || hover !== null ? "pointer" : "default",
        }}
      >
        <CanvasGridBg width={width} height={height} />

        {/* Correctness wash — paints behind the tile when the server has
            evaluated this placement. Decoupled from Tile (PR #70) so
            test feedback flips don't churn the SVG. */}
        {pieces.map((p) => {
          if (p.correct === null || p.correct === undefined) return null;
          const isCorrect = p.correct === true;
          return (
            <div
              key={`fill-${p.id}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: PADDING + p.q * CELL,
                top: PADDING + p.r * CELL,
                width: CELL,
                height: CELL,
                background: isCorrect
                  ? "rgba(38, 162, 92, 0.13)"
                  : "rgba(217, 78, 64, 0.10)",
                pointerEvents: "none",
                transition: "background .25s ease",
              }}
            />
          );
        })}

        {/* R1 — empty-board first-step hint at A1. */}
        {pieces.length === 0 && target === null && <EmptyHint />}

        {/* Cell hit-targets. Cheap to re-render — each cell is a single
            absolutely-positioned button with no children. */}
        {Array.from({ length: grid.h }).map((_, r) =>
          Array.from({ length: grid.w }).map((__, q) => {
            const occ = occupiedByCell.get(`${q},${r}`);
            return (
              <button
                key={`${q}-${r}`}
                type="button"
                onClick={() => {
                  if (occ) onPieceClick(occ);
                  else onCellClick(q, r);
                }}
                onMouseEnter={() => setHover({ q, r })}
                aria-label={`Cell ${q},${r}${occ ? " (occupied)" : ""}`}
                style={{
                  position: "absolute",
                  left: PADDING + q * CELL,
                  top: PADDING + r * CELL,
                  width: CELL,
                  height: CELL,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              />
            );
          }),
        )}

        {/* Move-to highlight when the editing piece is selected and the
            user hovers an empty cell. The cell turns into a "drop zone"
            preview without committing anything. */}
        {editingId &&
          hover &&
          !occupiedByCell.has(`${hover.q},${hover.r}`) && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: PADDING + hover.q * CELL,
                top: PADDING + hover.r * CELL,
                width: CELL,
                height: CELL,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 2,
                  border: "2px dashed var(--color-ink)",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.5)",
                }}
              />
            </div>
          )}

        {/* Idle hover ghost — shown only when no target is armed.
            See the showHoverGhost note above for why we suppress it
            when a phantom is already present. */}
        {showHoverGhost && hover && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: PADDING + hover.q * CELL,
              top: PADDING + hover.r * CELL,
              width: CELL,
              height: CELL,
              pointerEvents: "none",
              opacity: 0.35,
            }}
          >
            {(() => {
              const size = tileSizeFor(defaultShape);
              const offset = (size - CELL) / 2;
              return (
                <Tile
                  kind={defaultShape}
                  color={defaultColor}
                  x={-offset}
                  y={-offset}
                  size={size}
                  rotate={defaultRotation * 90}
                  ghost
                />
              );
            })()}
          </div>
        )}

        {/* Existing pieces. Halo wraps the editing target when present.
            Each piece is keyed by id so movements animate via CSS
            transition rather than mount/unmount. */}
        {pieces.map((p) => {
          const { x, y } = cellToPixel({ q: p.q, r: p.r });
          const size = tileSizeFor(p.shape);
          const offset = (size - CELL) / 2;
          const isEditing = editingId === p.id;
          const isWrong = p.correct === false;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: PADDING + p.q * CELL,
                top: PADDING + p.r * CELL,
                width: CELL,
                height: CELL,
                transition: "left .15s ease, top .15s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => {
                if (!isWrong) return;
                const cx = PADDING + p.q * CELL + CELL / 2;
                const cy = PADDING + p.r * CELL;
                setHoverWrong({ pieceId: p.id, x: cx, y: cy });
              }}
              onMouseLeave={() => {
                if (isWrong) setHoverWrong(null);
              }}
            >
              <Tile
                kind={p.shape}
                color={p.color}
                x={x - offset - PADDING - p.q * CELL}
                y={y - offset - PADDING - p.r * CELL}
                size={size}
                rotate={p.rot * 90}
              />
              {isEditing && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: -5,
                    border: "2px solid var(--color-ink)",
                    borderRadius: 10,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Correctness badges (PR #70 overlay layer). Mounted as a
            sibling to keep Tile pure layout — toggling correct/wrong
            never re-renders the SVG path. */}
        {pieces.map((p) => {
          if (p.correct === null || p.correct === undefined) return null;
          const size = tileSizeFor(p.shape);
          return (
            <span
              key={`badge-${p.id}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: PADDING + p.q * CELL + size * 0.8 - 9,
                top: PADDING + p.r * CELL + size * 0.2 - 9,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: p.correct ? "#46b86a" : "#ee3a3a",
                border: "2.5px solid #fff",
                boxShadow: "0 1px 2px rgba(0,0,0,.18)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
          );
        })}

        {/* Phantom (armed placement) — dashed outline + dock-attribute
            tile preview at its cell. */}
        {phantom && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: PADDING + phantom.q * CELL,
              top: PADDING + phantom.r * CELL,
              width: CELL,
              height: CELL,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -3,
                border: "2px dashed var(--color-ink)",
                borderRadius: 10,
                background: "rgba(255,255,255,.4)",
              }}
            />
            {(() => {
              const size = tileSizeFor(phantom.shape);
              const offset = (size - CELL) / 2;
              return (
                <Tile
                  kind={phantom.shape}
                  color={phantom.color}
                  x={-offset}
                  y={-offset}
                  size={size}
                  rotate={phantom.rot * 90}
                  style={{ opacity: 0.85 }}
                />
              );
            })()}
          </div>
        )}

        {/* R3 — wrong-because tooltip. Mounts only on hover of a wrong
            piece; pointer-events: none so it can't steal hover. */}
        {hoverWrong &&
          (() => {
            const piece = pieces.find((pp) => pp.id === hoverWrong.pieceId);
            if (!piece) return null;
            return (
              <WrongTooltip
                q={piece.q}
                r={piece.r}
                x={hoverWrong.x}
                y={hoverWrong.y}
                reasons={piece.wrong_reasons ?? null}
              />
            );
          })()}
      </div>
    </div>
  );
}

export const BuilderCanvas = memo(BuilderCanvasImpl);
