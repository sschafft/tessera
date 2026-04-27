"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import { InteractiveCanvas } from "@/components/canvas/InteractiveCanvas";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { JoinCallCta } from "./JoinCallCta";
import { BUILDER_SHAPES, paletteColorsFor } from "@/lib/pattern/palette";
import type { PlacedPiece, PlayState } from "./PlayContent";

const SHAPE_LABEL: Record<TileShape, string> = {
  "tri-up": "triangle",
  "tri-dn": "triangle",
  sq: "square",
  rhomb: "rhombus",
  trap: "trapezoid",
  hex: "hexagon",
  pent: "pentagon",
};

const LETTERS = "ABCDEFGHIJKLMN";
function cellLabel(q: number, r: number): string {
  return `${LETTERS[q] ?? "?"}${r + 1}`;
}

export interface BuilderViewProps {
  state: PlayState;
}

export function BuilderView({ state }: BuilderViewProps) {
  if (!state.round || state.round.status !== "running") {
    return <WaitingForRound state={state} />;
  }
  return <BuilderInteractive state={state} />;
}

function BuilderInteractive({ state }: { state: PlayState }) {
  const complexity = state.round?.complexity ?? 5;
  const palette = useMemo(() => paletteColorsFor(complexity), [complexity]);
  const [selectedShape, setSelectedShape] = useState<TileShape | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileColor>(
    palette[0] ?? "blue",
  );
  const [selectedRotation, setSelectedRotation] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<PlacedPiece[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  /**
   * Optimistic field-level overrides applied to confirmed pieces, so
   * rotates / moves / converts feel instant without waiting for the
   * server roundtrip. Cleared once state.placements echoes the new
   * value back (see GC effect below).
   */
  const [optimisticPatches, setOptimisticPatches] = useState<
    Map<string, Partial<PlacedPiece>>
  >(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const [sharingProgress, setSharingProgress] = useState(false);

  // Snap selected color to a value in the active palette if complexity
  // shrinks the palette mid-round (super-power side-effect).
  useEffect(() => {
    if (!palette.includes(selectedColor)) {
      setSelectedColor(palette[0] ?? "blue");
    }
  }, [palette, selectedColor]);

  // GC: any optimistic patch whose values now match state.placements
  // can be dropped — the server caught up.
  useEffect(() => {
    if (optimisticPatches.size === 0) return;
    setOptimisticPatches((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, patch] of prev.entries()) {
        const server = state.placements.find((p) => p.id === id);
        if (!server) continue;
        const stillNeeded = (Object.keys(patch) as (keyof PlacedPiece)[]).some(
          (k) => patch[k] !== undefined && patch[k] !== server[k],
        );
        if (!stillNeeded) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state.placements, optimisticPatches]);

  // Server placements + local optimistic adds, minus locally-pending
  // deletes, with optimistic patches merged on top.
  const visiblePieces = [...state.placements, ...optimistic]
    .filter((p) => !pendingDeletes.has(p.id))
    .map((p) => {
      const patch = optimisticPatches.get(p.id);
      return patch ? { ...p, ...patch } : p;
    });
  const editingPiece =
    editingId === null
      ? null
      : (visiblePieces.find((p) => p.id === editingId) ?? null);

  // Selecting a tray shape exits edit mode (and vice versa).
  const pickShape = (shape: TileShape | null) => {
    setSelectedShape(shape);
    if (shape !== null) setEditingId(null);
  };
  const stopEditing = useCallback(() => setEditingId(null), []);

  // Esc cancels whichever mode is active.
  useEffect(() => {
    if (selectedShape === null && editingId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedShape(null);
        setEditingId(null);
      } else if (e.key === "r" || e.key === "R") {
        if (editingPiece) {
          // Rotate the editing piece via API
          void rotateEditing();
        } else if (selectedShape !== null) {
          setSelectedRotation((p) => (p + 1) % 4);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // rotateEditing closes over editingPiece + state; it's stable in
    // its own closure scope, but we recompute on dep change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShape, editingId, editingPiece?.rot]);

  const place = useCallback(
    async (q: number, r: number) => {
      if (!selectedShape) return;
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimisticPiece: PlacedPiece = {
        id: tempId,
        shape: selectedShape,
        color: selectedColor,
        q,
        r,
        rot: selectedRotation,
      };
      setOptimistic((prev) => [...prev, optimisticPiece]);
      setError(null);

      try {
        const res = await fetch(`/api/games/${state.code}/placements`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shape: selectedShape,
            color: selectedColor,
            q,
            r,
            rot: selectedRotation,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        setOptimistic((prev) => prev.filter((p) => p.id !== tempId));
      } catch (err) {
        setOptimistic((prev) => prev.filter((p) => p.id !== tempId));
        setError(err instanceof Error ? err.message : "place failed");
      }
    },
    [selectedShape, selectedColor, selectedRotation, state.code],
  );

  const moveEditingTo = useCallback(
    async (q: number, r: number) => {
      if (!editingPiece) return;
      const id = editingPiece.id;
      setError(null);
      // Optimistic move via patch — piece appears in the new cell
      // immediately while the PATCH is still in flight.
      setOptimisticPatches((prev) => {
        const next = new Map(prev);
        next.set(id, { ...next.get(id), q, r });
        return next;
      });
      if (id.startsWith("temp-")) return; // POST will sync the new q/r
      try {
        const res = await fetch(
          `/api/games/${state.code}/placements/${id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ q, r }),
          },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
      } catch (err) {
        // Drop the optimistic move so the piece reverts to its
        // server cell on the next state refresh.
        setOptimisticPatches((prev) => {
          const next = new Map(prev);
          const cur = next.get(id);
          if (cur) {
            const { q: _q, r: _r, ...rest } = cur;
            void _q;
            void _r;
            if (Object.keys(rest).length === 0) next.delete(id);
            else next.set(id, rest);
          }
          return next;
        });
        const reason = err instanceof Error ? err.message : "move failed";
        setError(
          reason === "cell_taken" ? "That cell already has a piece." : reason,
        );
      }
    },
    [editingPiece, state.code],
  );

  const rotateEditing = useCallback(async () => {
    if (!editingPiece) return;
    const newRot = (editingPiece.rot + 1) % 4;
    const id = editingPiece.id;
    setError(null);
    // Optimistic: apply rotation locally first.
    setOptimisticPatches((prev) => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id), rot: newRot });
      return next;
    });
    if (id.startsWith("temp-")) return; // POST will sync the new rot
    try {
      const res = await fetch(
        `/api/games/${state.code}/placements/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rot: newRot }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "rotate failed");
    }
  }, [editingPiece, state.code]);

  /**
   * Tap-occupied-cell-with-selection: convert the existing piece to
   * the currently selected shape/color/rotation in place. Single
   * PATCH; piece identity is preserved so stay-on-cell mutations
   * don't churn through new IDs.
   */
  const convertPiece = useCallback(
    async (target: PlacedPiece) => {
      if (!selectedShape) return;
      const id = target.id;
      const patch = {
        shape: selectedShape,
        color: selectedColor,
        rot: selectedRotation,
      };
      setError(null);
      // Optimistic: apply locally.
      setOptimisticPatches((prev) => {
        const next = new Map(prev);
        next.set(id, { ...next.get(id), ...patch });
        return next;
      });
      if (id.startsWith("temp-")) return;
      try {
        const res = await fetch(
          `/api/games/${state.code}/placements/${id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "convert failed");
      }
    },
    [selectedShape, selectedColor, selectedRotation, state.code],
  );

  /**
   * Click on an existing piece. If a tray shape is selected, this is
   * a "convert in place" tap — overwrite the piece with the active
   * selection. Otherwise, enter edit mode for that piece.
   */
  const onPieceClick = useCallback(
    (piece: PlacedPiece) => {
      if (selectedShape) {
        void convertPiece(piece);
        return;
      }
      setEditingId(piece.id);
      setSelectedShape(null);
    },
    [selectedShape, convertPiece],
  );

  const deleteEditing = useCallback(async () => {
    if (!editingPiece) return;
    if (editingPiece.id.startsWith("temp-")) return;
    setPendingDeletes((prev) => new Set(prev).add(editingPiece.id));
    setError(null);
    try {
      const res = await fetch(
        `/api/games/${state.code}/placements/${editingPiece.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      setEditingId(null);
    } catch (err) {
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        next.delete(editingPiece.id);
        return next;
      });
      setError(err instanceof Error ? err.message : "delete failed");
    }
  }, [editingPiece, state.code]);

  const shareProgress = useCallback(async () => {
    setSharingProgress(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${state.code}/agile-share`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "share failed");
    } finally {
      setSharingProgress(false);
    }
  }, [state.code]);

  const [clearArmed, setClearArmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (!clearArmed) return;
    const t = setTimeout(() => setClearArmed(false), 3000);
    return () => clearTimeout(t);
  }, [clearArmed]);

  const clearAll = useCallback(async () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearing(true);
    setError(null);
    setEditingId(null);
    setSelectedShape(null);
    try {
      const res = await fetch(`/api/games/${state.code}/placements`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      setOptimistic([]);
      setPendingDeletes(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "clear failed");
    } finally {
      setClearing(false);
      setClearArmed(false);
    }
  }, [clearArmed, state.code]);

  const showCoords = (state.round?.complexity ?? 5) <= 4;

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: "280px 1fr" }}>
      <aside className="flex flex-col gap-5 border-r border-[var(--color-line)] bg-[var(--color-paper-2)] p-5">
        <ModeBanner
          shape={selectedShape}
          color={selectedColor}
          rotation={selectedRotation}
          editing={editingPiece}
          onClearAdd={() => setSelectedShape(null)}
          onStopEditing={stopEditing}
        />
        <Tray
          selected={selectedShape}
          onSelect={pickShape}
          color={selectedColor}
          rotation={selectedRotation}
        />
        <Palette
          selected={selectedColor}
          onSelect={setSelectedColor}
          colors={palette}
        />
        <Tools
          rotation={selectedRotation}
          setRotation={setSelectedRotation}
          deselect={() => setSelectedShape(null)}
          hasSelection={selectedShape !== null}
        />
        {error && (
          <p className="text-[12px] text-[var(--color-t-red)]" role="alert">
            {error}
          </p>
        )}
      </aside>
      <section className="relative flex items-start justify-center overflow-auto p-6">
        <div className="absolute right-6 top-6 z-10 flex flex-col gap-3">
          {state.brief && state.brief.role === "builder" && (
            <BriefEnvelope
              role="builder"
              title={state.brief.title}
              rules={state.brief.rules}
            />
          )}
          {state.partner_brief && (
            <BriefEnvelope
              role={state.partner_brief.role}
              title={state.partner_brief.title}
              rules={state.partner_brief.rules}
              defaultOpen
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-3">
          <PrototypeOverlay
            prototype={state.prototype}
            complexity={complexity}
          />

          <div className="relative">
            <InteractiveCanvas
              pieces={visiblePieces}
              complexity={complexity}
              selectedShape={selectedShape}
              selectedColor={selectedColor}
              selectedRotation={selectedRotation}
              editingId={editingId}
              showCoords={showCoords}
              onPlace={place}
              onPieceClick={onPieceClick}
              onMoveTo={moveEditingTo}
            />
            {editingPiece && (
              <EditingActionBar
                piece={editingPiece}
                onRotate={rotateEditing}
                onDelete={deleteEditing}
                onDone={stopEditing}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="t-mono text-[11px] text-[var(--color-ink-3)]">
              {editingPiece
                ? `editing ${SHAPE_LABEL[editingPiece.shape]} at ${cellLabel(
                    editingPiece.q,
                    editingPiece.r,
                  )} · click an empty cell to move it · press R to rotate`
                : selectedShape
                  ? "click a cell to place · click any piece to swap it"
                  : "pick a shape from the tray, or click an existing piece to edit it"}
            </p>
            {state.goal_count > 0 && (
              <span
                className="t-mono rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background: "var(--color-paper-2)",
                  color: "var(--color-ink-2)",
                }}
                aria-label={`${visiblePieces.length} of ${state.goal_count} placed`}
              >
                ◉ {visiblePieces.length} / {state.goal_count} placed
              </span>
            )}
            {state.test_enabled && state.accuracy && (
              <span className="t-mono rounded-full bg-[var(--color-paper-2)] px-3 py-1 text-[11px] font-bold">
                ✓ {state.accuracy.correct} / {state.accuracy.total} correct
              </span>
            )}
            {state.shares_remaining > 0 && (
              <button
                type="button"
                onClick={shareProgress}
                disabled={sharingProgress}
                className="t-mono rounded-full bg-[var(--color-tint-orange)] px-3 py-1 text-[11px] font-bold text-[var(--color-t-orange)] disabled:opacity-50"
                style={{
                  boxShadow: "inset 0 0 0 1.5px var(--color-t-orange)",
                }}
              >
                {sharingProgress
                  ? "Sharing…"
                  : `↻ Share progress (${state.shares_remaining})`}
              </button>
            )}
            {visiblePieces.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing}
                className="t-mono rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50"
                style={{
                  background: clearArmed
                    ? "var(--color-t-red)"
                    : "var(--color-paper-2)",
                  color: clearArmed
                    ? "#fff"
                    : "var(--color-ink-2)",
                  boxShadow: clearArmed
                    ? "inset 0 0 0 1.5px var(--color-t-red)"
                    : "inset 0 0 0 1.5px var(--color-line)",
                }}
                aria-label="Clear all placements"
              >
                {clearing
                  ? "Clearing…"
                  : clearArmed
                    ? "✕ Tap again to clear"
                    : "✕ Clear all"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ModeBanner({
  shape,
  color,
  rotation,
  editing,
  onClearAdd,
  onStopEditing,
}: {
  shape: TileShape | null;
  color: TileColor;
  rotation: number;
  editing: PlacedPiece | null;
  onClearAdd: () => void;
  onStopEditing: () => void;
}) {
  if (editing) {
    return (
      <div
        className="flex items-center gap-2 rounded-[12px] border-[1.5px] px-3 py-2"
        style={{
          background: "var(--color-tint-orange)",
          borderColor: "var(--color-t-orange)",
        }}
      >
        <span
          className="t-mono text-[10px] font-bold uppercase tracking-wide"
          style={{ color: "var(--color-t-orange)" }}
        >
          Edit mode
        </span>
        <span className="text-[12px] font-semibold text-[var(--color-ink)]">
          {SHAPE_LABEL[editing.shape]} at {cellLabel(editing.q, editing.r)}
        </span>
        <button
          type="button"
          onClick={onStopEditing}
          className="t-mono ml-auto rounded-full px-2 py-0.5 text-[10px] underline"
          style={{ color: "var(--color-t-orange)" }}
        >
          done
        </button>
      </div>
    );
  }
  if (shape) {
    return (
      <div
        className="flex items-center gap-2 rounded-[12px] border-[1.5px] px-3 py-2"
        style={{
          background: "var(--color-tint-blue)",
          borderColor: "var(--color-t-blue)",
        }}
      >
        <span
          className="t-mono text-[10px] font-bold uppercase tracking-wide"
          style={{ color: "var(--color-t-blue)" }}
        >
          Add mode
        </span>
        <span className="text-[12px] font-semibold text-[var(--color-ink)]">
          {color} {SHAPE_LABEL[shape]}{rotation > 0 ? ` · ${rotation * 90}°` : ""}
        </span>
        <button
          type="button"
          onClick={onClearAdd}
          className="t-mono ml-auto rounded-full px-2 py-0.5 text-[10px] underline"
          style={{ color: "var(--color-t-blue)" }}
        >
          clear
        </button>
      </div>
    );
  }
  return (
    <div
      className="rounded-[12px] border border-[var(--color-line)] px-3 py-2 text-[12px] text-[var(--color-ink-3)]"
      style={{ background: "#fff" }}
    >
      Pick a shape to add, or click a piece to move it.
    </div>
  );
}

function EditingActionBar({
  piece,
  onRotate,
  onDelete,
  onDone,
}: {
  piece: PlacedPiece;
  onRotate: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  return (
    <div
      className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full bg-white px-1 py-1 shadow-md-soft"
      style={{ border: "1.5px solid var(--color-t-orange)" }}
    >
      <span
        className="t-mono px-2 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--color-t-orange)" }}
      >
        editing
      </span>
      <button
        type="button"
        onClick={onRotate}
        title="Rotate (R)"
        className="grid h-7 w-7 place-items-center rounded-full text-[14px] hover:bg-[var(--color-paper-2)]"
      >
        ↻
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Delete"
        className="grid h-7 w-7 place-items-center rounded-full text-[14px] hover:bg-[var(--color-tint-red)]"
        style={{ color: "var(--color-t-red)" }}
      >
        ⌫
      </button>
      <button
        type="button"
        onClick={onDone}
        title="Done (Esc)"
        className="grid h-7 w-7 place-items-center rounded-full text-[14px] hover:bg-[var(--color-paper-2)]"
      >
        ✕
      </button>
      <span className="t-mono px-1 text-[10px] text-[var(--color-ink-3)]">
        {SHAPE_LABEL[piece.shape]} {cellLabel(piece.q, piece.r)}
      </span>
    </div>
  );
}

function Tray({
  selected,
  onSelect,
  color,
  rotation,
}: {
  selected: TileShape | null;
  onSelect: (shape: TileShape | null) => void;
  color: TileColor;
  rotation: number;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Tray · pieces
        </span>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="t-mono text-[10px] text-[var(--color-ink-3)] underline"
          >
            clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {BUILDER_SHAPES.map((shape) => {
          const isSelected = shape === selected;
          return (
            <button
              key={shape}
              type="button"
              onClick={() => onSelect(isSelected ? null : shape)}
              className="relative grid place-items-center"
              style={{
                aspectRatio: "1",
                background: "#fff",
                borderRadius: 12,
                border: `1.5px solid ${isSelected ? "var(--color-ink)" : "var(--color-line)"}`,
                cursor: "pointer",
                boxShadow: isSelected
                  ? "0 2px 0 rgba(0,0,0,.10)"
                  : "0 1px 0 rgba(0,0,0,.04)",
              }}
              aria-pressed={isSelected}
              aria-label={shape}
            >
              <Tile
                kind={shape}
                color={color}
                x={10}
                y={10}
                size={48}
                rotate={rotation * 90}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Palette({
  selected,
  onSelect,
  colors,
}: {
  selected: TileColor;
  onSelect: (color: TileColor) => void;
  colors: TileColor[];
}) {
  const cols = Math.min(colors.length, 3);
  return (
    <div>
      <div className="mb-2.5">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Colour palette
        </span>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            className="rounded-[10px] border-2"
            style={{
              aspectRatio: "1",
              background: `var(--color-t-${c})`,
              borderColor: selected === c ? "var(--color-ink)" : "#fff",
              boxShadow:
                selected === c
                  ? "0 2px 0 rgba(0,0,0,.20), 0 0 0 2px var(--color-ink) inset"
                  : "0 2px 0 rgba(0,0,0,.10)",
              cursor: "pointer",
            }}
            aria-pressed={selected === c}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

function Tools({
  rotation,
  setRotation,
  deselect,
  hasSelection,
}: {
  rotation: number;
  setRotation: (r: number) => void;
  deselect: () => void;
  hasSelection: boolean;
}) {
  const tools: {
    icon: string;
    label: string;
    k: string;
    onClick?: () => void;
    enabled: boolean;
  }[] = [
    {
      icon: "↺",
      label: `Rotate · ${rotation * 90}°`,
      k: "R",
      onClick: () => setRotation((rotation + 1) % 4),
      enabled: hasSelection,
    },
    {
      icon: "⊘",
      label: "Deselect",
      k: "Esc",
      onClick: deselect,
      enabled: hasSelection,
    },
  ];
  return (
    <div>
      <div className="mb-2.5">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Tools
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.onClick}
            disabled={!t.enabled}
            className="flex items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2 text-left text-[13px] font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            <span className="w-5 text-center text-[16px]">{t.icon}</span>
            <span className="flex-1">{t.label}</span>
            <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
              {t.k}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PrototypeOverlay({
  prototype,
  complexity,
}: {
  prototype: PlayState["prototype"];
  complexity: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!prototype) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [prototype]);

  if (!prototype) return null;
  const endsMs = new Date(prototype.ends_at).getTime();
  const remaining = Math.max(0, Math.ceil((endsMs - now) / 1000));
  if (remaining === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="t-mono inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
        style={{
          background: "var(--color-tint-blue)",
          color: "var(--color-t-blue)",
          boxShadow: "inset 0 0 0 1.5px var(--color-t-blue)",
        }}
      >
        🔮 Prototype glimpse · {remaining}s
      </span>
      <div
        className="rounded-[var(--radius-lg)]"
        style={{
          filter: "saturate(0.55) opacity(0.85)",
          border: "2px dashed var(--color-t-blue)",
          padding: 4,
        }}
      >
        <PlayCanvas pieces={prototype.goal} complexity={complexity} />
      </div>
      <span
        className="t-mono text-[10px] text-[var(--color-ink-3)]"
        style={{ letterSpacing: ".1em" }}
      >
        approximate · expect ~25% wrong
      </span>
    </div>
  );
}

function WaitingForRound({ state }: { state: PlayState }) {
  return (
    <section className="m-auto flex max-w-[520px] flex-col items-center gap-5 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        BUILDER · WAITING
      </div>
      <h1 className="t-display text-3xl">Hop on the call.</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        Your guider has the goal pattern. As soon as the facilitator hits
        Start, your canvas comes alive — and you&apos;ll need the call open to
        hear the descriptions.
      </p>
      <JoinCallCta
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
    </section>
  );
}
