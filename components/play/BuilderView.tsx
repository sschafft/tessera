"use client";

import { useCallback, useEffect, useState } from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import { InteractiveCanvas } from "@/components/canvas/InteractiveCanvas";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import type { PlacedPiece, PlayState } from "./PlayContent";

const TRAY_SHAPES: TileShape[] = [
  "tri-up",
  "tri-dn",
  "sq",
  "rhomb",
  "trap",
  "hex",
];

const PALETTE: TileColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "teal",
];

const SHAPE_LABEL: Record<TileShape, string> = {
  "tri-up": "triangle ▲",
  "tri-dn": "triangle ▼",
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
    return <WaitingForRound />;
  }
  return <BuilderInteractive state={state} />;
}

function BuilderInteractive({ state }: { state: PlayState }) {
  const [selectedShape, setSelectedShape] = useState<TileShape | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileColor>("blue");
  const [selectedRotation, setSelectedRotation] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<PlacedPiece[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sharingProgress, setSharingProgress] = useState(false);

  // Server placements + local optimistic adds, minus locally-pending deletes.
  const visiblePieces = [...state.placements, ...optimistic].filter(
    (p) => !pendingDeletes.has(p.id),
  );
  const editingPiece =
    editingId === null
      ? null
      : (visiblePieces.find((p) => p.id === editingId) ?? null);

  // Selecting a tray shape exits edit mode (and vice versa).
  const pickShape = (shape: TileShape | null) => {
    setSelectedShape(shape);
    if (shape !== null) setEditingId(null);
  };
  const startEditing = (piece: PlacedPiece) => {
    setEditingId(piece.id);
    setSelectedShape(null);
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
          setSelectedRotation((p) => (p + 1) % 6);
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
      // Optimistic: update the local view immediately.
      const original = { q: editingPiece.q, r: editingPiece.r };
      setOptimistic((prev) => [
        ...prev,
        { ...editingPiece, id: `move-${editingPiece.id}`, q, r },
      ]);
      setPendingDeletes((prev) => new Set(prev).add(editingPiece.id));

      try {
        const res = await fetch(
          `/api/games/${state.code}/placements/${editingPiece.id}`,
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
        setOptimistic((prev) =>
          prev.filter((p) => p.id !== `move-${editingPiece.id}`),
        );
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          next.delete(editingPiece.id);
          return next;
        });
      } catch (err) {
        // Roll back optimistic move.
        setOptimistic((prev) =>
          prev.filter((p) => p.id !== `move-${editingPiece.id}`),
        );
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          next.delete(editingPiece.id);
          return next;
        });
        const reason = err instanceof Error ? err.message : "move failed";
        setError(
          reason === "cell_taken" ? "That cell already has a piece." : reason,
        );
        // Restore "editing at original cell" state by ensuring editingId stays
        // pointed at the same id; PlayContent's poll will resync.
        void original; // appease lint when we don't use it
      }
    },
    [editingPiece, state.code],
  );

  const rotateEditing = useCallback(async () => {
    if (!editingPiece) return;
    const newRot = (editingPiece.rot + 1) % 6;
    setError(null);
    try {
      const res = await fetch(
        `/api/games/${state.code}/placements/${editingPiece.id}`,
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
        <Palette selected={selectedColor} onSelect={setSelectedColor} />
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
          <PrototypeOverlay prototype={state.prototype} />

          <div className="relative">
            <InteractiveCanvas
              pieces={visiblePieces}
              selectedShape={selectedShape}
              selectedColor={selectedColor}
              selectedRotation={selectedRotation}
              editingId={editingId}
              showCoords={showCoords}
              onPlace={place}
              onPieceClick={startEditing}
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
                  ? "click a cell to place · click any piece to edit it"
                  : "pick a shape from the tray, or click an existing piece to move it"}
            </p>
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
          {color} {SHAPE_LABEL[shape]}{rotation > 0 ? ` · ${rotation * 60}°` : ""}
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
      <div className="grid grid-cols-3 gap-2">
        {TRAY_SHAPES.map((shape) => {
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
                rotate={rotation * 60}
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
}: {
  selected: TileColor;
  onSelect: (color: TileColor) => void;
}) {
  return (
    <div>
      <div className="mb-2.5">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Colour palette
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PALETTE.map((c) => (
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
      label: `Rotate · ${rotation * 60}°`,
      k: "R",
      onClick: () => setRotation((rotation + 1) % 6),
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
}: {
  prototype: PlayState["prototype"];
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
        <PlayCanvas pieces={prototype.goal} />
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

function WaitingForRound() {
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-3 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        BUILDER
      </div>
      <h1 className="t-display text-3xl">Waiting for the round to start</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        Your guider has the goal. As soon as the facilitator hits Start, your
        canvas comes alive.
      </p>
    </section>
  );
}
