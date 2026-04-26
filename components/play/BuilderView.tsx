"use client";

import { useCallback, useState } from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import { InteractiveCanvas } from "@/components/canvas/InteractiveCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import type { PlacedPiece, PlayState } from "./PlayContent";

export interface BuilderViewProps {
  state: PlayState;
}

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
  const [optimistic, setOptimistic] = useState<PlacedPiece[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Server placements + local optimistic adds, minus locally-pending deletes.
  const visiblePieces = [...state.placements, ...optimistic].filter(
    (p) => !pendingDeletes.has(p.id),
  );

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
        // Drop the optimistic copy; the next poll will surface the
        // real row from the server.
        setOptimistic((prev) => prev.filter((p) => p.id !== tempId));
      } catch (err) {
        setOptimistic((prev) => prev.filter((p) => p.id !== tempId));
        setError(err instanceof Error ? err.message : "place failed");
      }
    },
    [selectedShape, selectedColor, selectedRotation, state.code],
  );

  const remove = useCallback(
    async (piece: PlacedPiece) => {
      if (piece.id.startsWith("temp-")) return; // not yet committed
      setPendingDeletes((prev) => new Set(prev).add(piece.id));
      setError(null);
      try {
        const res = await fetch(
          `/api/games/${state.code}/placements/${piece.id}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
      } catch (err) {
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          next.delete(piece.id);
          return next;
        });
        setError(err instanceof Error ? err.message : "delete failed");
      }
    },
    [state.code],
  );

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: "280px 1fr" }}>
      <aside className="flex flex-col gap-5 border-r border-[var(--color-line)] bg-[var(--color-paper-2)] p-5">
        <Tray
          selected={selectedShape}
          onSelect={setSelectedShape}
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
        {state.brief && state.brief.role === "builder" && (
          <div className="absolute right-6 top-6 z-10">
            <BriefEnvelope
              role="builder"
              title={state.brief.title}
              rules={state.brief.rules}
            />
          </div>
        )}
        <div className="flex flex-col items-center gap-3">
          <InteractiveCanvas
            pieces={visiblePieces}
            selectedShape={selectedShape}
            selectedColor={selectedColor}
            selectedRotation={selectedRotation}
            onPlace={place}
            onPieceClick={remove}
          />
          <p className="t-mono text-[11px] text-[var(--color-ink-3)]">
            {selectedShape
              ? "click a cell to place · click an existing piece to remove"
              : "pick a shape from the tray, then click on the canvas"}
          </p>
        </div>
      </section>
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
