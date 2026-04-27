"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import { InteractiveCanvas } from "@/components/canvas/InteractiveCanvas";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { JoinCallCta } from "./JoinCallCta";
import { BUILDER_SHAPES, paletteColorsFor } from "@/lib/pattern/palette";
import { playTestSolution } from "@/lib/sound";
import { BriefGate } from "./BriefGate";
import { PairNameBadge } from "./PairNameBadge";
import type { PlacedPiece, PlayState } from "./PlayContent";

interface TestResult {
  correct: number;
  wrong: number;
  total: number;
  score: number;
  penaltyApplied: boolean;
  correctPts: number;
  wrongPts: number;
  /** ms timestamp — used to drive the celebration animation. */
  at: number;
}

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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  /**
   * Per-placement correctness map keyed by id. Populated from the
   * /test-solution response so the green/red marks fire instantly
   * (no realtime-broadcast latency). Cleared on any mutation so
   * pieces placed AFTER the last test stay neutral until the builder
   * tests again — fixes the "everything I add is shown as wrong"
   * confusion.
   */
  const [localCorrect, setLocalCorrect] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const clearLocalCorrect = useCallback(() => {
    setLocalCorrect((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

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
  // deletes, with optimistic patches merged on top. The server's
  // `correct` flag is intentionally ignored — we use the local
  // localCorrect map (populated only by the latest Test solution)
  // so pieces added after testing stay neutral until re-tested.
  // Memoised so re-renders triggered by unrelated state (cursor
  // position inside InteractiveCanvas, etc.) don't churn the
  // placements array and cascade through every Tile.
  const visiblePieces = useMemo(
    () =>
      [...state.placements, ...optimistic]
        .filter((p) => !pendingDeletes.has(p.id))
        .map((p) => {
          const patch = optimisticPatches.get(p.id);
          const merged = patch ? { ...p, ...patch } : p;
          const localFlag = localCorrect.get(merged.id);
          return { ...merged, correct: localFlag };
        }),
    [state.placements, optimistic, pendingDeletes, optimisticPatches, localCorrect],
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
      clearLocalCorrect();
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
      clearLocalCorrect();
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
    clearLocalCorrect();
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
      clearLocalCorrect();
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
    clearLocalCorrect();
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
    clearLocalCorrect();
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

  const testSolution = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${state.code}/test-solution`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      const j = (await res.json()) as {
        correct: number;
        wrong: number;
        total: number;
        score: number;
        penalty_applied: boolean;
        correct_pts: number;
        wrong_pts: number;
        correctness?: Record<string, boolean>;
        tested_at?: string;
      };
      setTestResult({
        correct: j.correct,
        wrong: j.wrong,
        total: j.total,
        score: j.score,
        penaltyApplied: j.penalty_applied,
        correctPts: j.correct_pts,
        wrongPts: j.wrong_pts,
        at: Date.now(),
      });
      // Apply per-piece highlights instantly from the response. The
      // realtime broadcast also fires but this avoids the visible
      // wait.
      if (j.correctness) {
        setLocalCorrect(new Map(Object.entries(j.correctness)));
      }
      if (state.sound_on) playTestSolution(j.correct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "test failed");
    } finally {
      setTesting(false);
    }
  }, [state.code, state.sound_on, testing]);

  const showCoords = (state.round?.complexity ?? 5) <= 4;

  // Brief-open gate: if the builder has a brief, dim the canvas + tray
  // until they open it. Resets when the brief changes (super-power
  // re-roll, new round, etc).
  const briefSignature =
    state.brief?.title ?? (state.brief ? "(present)" : null);
  const [briefOpened, setBriefOpened] = useState(briefSignature === null);
  useEffect(() => {
    setBriefOpened(briefSignature === null);
  }, [briefSignature]);

  const partnerName = state.partner?.display_name ?? "guider";
  const meName = state.me.display_name;
  const defaultPairName = `${meName} ↔ ${partnerName}`;

  return (
    <div className="grid w-full relative" style={{ gridTemplateColumns: "280px 1fr" }}>
      <aside className="flex flex-col gap-5 border-r border-[var(--color-line)] bg-[var(--color-paper-2)] p-5">
        {state.pair && (
          <PairNameBadge
            code={state.code}
            pairId={state.pair.id}
            displayName={state.pair.display_name}
            defaultName={defaultPairName}
          />
        )}
        <ModeBanner
          shape={selectedShape}
          color={selectedColor}
          rotation={selectedRotation}
          editing={editingPiece}
          onPickAdd={() => {
            setEditingId(null);
            if (!selectedShape) setSelectedShape(BUILDER_SHAPES[0]!);
          }}
          onPickEdit={() => {
            setSelectedShape(null);
          }}
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
        <div className="absolute right-6 top-6 z-30 flex flex-col gap-3">
          {state.brief && state.brief.role === "builder" && (
            <BriefEnvelope
              role="builder"
              title={state.brief.title}
              rules={state.brief.rules}
              onOpen={() => setBriefOpened(true)}
              emphasize={!briefOpened}
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

        {!briefOpened && <BriefGate role="builder" />}
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
            {state.live_score && (
              <span
                className="t-mono rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background:
                    state.live_score.score > 0
                      ? "var(--color-tint-green)"
                      : "var(--color-paper-2)",
                  color:
                    state.live_score.score > 0
                      ? "var(--color-t-green)"
                      : "var(--color-ink-2)",
                  boxShadow:
                    state.live_score.score > 0
                      ? "inset 0 0 0 1.5px var(--color-t-green)"
                      : "inset 0 0 0 1.5px var(--color-line)",
                }}
                aria-label={`Score ${state.live_score.score}, ${state.live_score.correct} of ${state.live_score.total} correct`}
              >
                ★ {state.live_score.score} pts · {state.live_score.correct} /{" "}
                {state.live_score.total}
              </span>
            )}
            {state.shares_remaining > 0 && (
              <button
                type="button"
                onClick={shareProgress}
                disabled={sharingProgress}
                className="rounded-full px-4 py-1.5 text-[12px] font-bold disabled:opacity-50"
                style={{
                  background: "var(--color-t-orange)",
                  color: "#fff",
                  boxShadow:
                    "0 2px 0 rgba(0,0,0,.10), inset 0 -1px 0 rgba(0,0,0,.10)",
                }}
                title="Snap your current canvas to the guider so they can spot mistakes."
              >
                {sharingProgress
                  ? "Sharing…"
                  : `↻ Share progress with guider · ${state.shares_remaining} left`}
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

          <TestSolutionCTA
            disabled={visiblePieces.length === 0}
            testing={testing}
            result={testResult}
            onTest={testSolution}
          />
        </div>
      </section>
    </div>
  );
}

function TestSolutionCTA({
  disabled,
  testing,
  result,
  onTest,
}: {
  disabled: boolean;
  testing: boolean;
  result: TestResult | null;
  onTest: () => void;
}) {
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (result) setPulseKey((k) => k + 1);
  }, [result]);
  const anyCorrect = (result?.correct ?? 0) > 0;
  return (
    <div className="mt-2 flex w-full max-w-[640px] flex-col items-center gap-3">
      {result && (
        <div
          key={pulseKey}
          className="t-card flex w-full items-center gap-3 px-4 py-3"
          style={{
            background: anyCorrect
              ? "var(--color-tint-green)"
              : "var(--color-paper-2)",
            borderColor: anyCorrect
              ? "var(--color-t-green)"
              : "var(--color-line)",
            animation: "tessera-pulse 600ms ease-out",
          }}
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-[20px]"
            style={{
              background: anyCorrect ? "var(--color-t-green)" : "#fff",
              color: anyCorrect ? "#fff" : "var(--color-ink-3)",
              boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,.10)",
            }}
          >
            {anyCorrect ? "✓" : "—"}
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span
              className="t-display text-[18px] font-bold"
              style={{
                color: anyCorrect
                  ? "var(--color-t-green)"
                  : "var(--color-ink)",
              }}
            >
              {result.score >= 0 ? `+${result.score}` : `${result.score}`}{" "}
              point{Math.abs(result.score) === 1 ? "" : "s"}
            </span>
            <span className="text-[12px] text-[var(--color-ink-2)]">
              {result.correct} right · {result.wrong} wrong
              {result.penaltyApplied
                ? ` · penalty ${result.wrongPts} applied`
                : ""}
            </span>
          </div>
          <span className="t-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-3)]">
            tap test again any time
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onTest}
        disabled={disabled || testing}
        className="t-btn t-btn--primary w-full disabled:opacity-50"
        style={{ padding: "16px 22px", fontSize: 16 }}
        title={
          disabled
            ? "Place at least one piece to test."
            : "Score the current placements against the goal."
        }
      >
        {testing ? "Testing…" : "✓ Test solution"}
      </button>

      <style>{`
        @keyframes tessera-pulse {
          0% { transform: scale(0.96); opacity: 0; }
          60% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ModeBanner({
  shape,
  color,
  rotation,
  editing,
  onPickAdd,
  onPickEdit,
  onStopEditing,
}: {
  shape: TileShape | null;
  color: TileColor;
  rotation: number;
  editing: PlacedPiece | null;
  /** Switch to add mode — caller picks a default shape if none active. */
  onPickAdd: () => void;
  /** Switch to edit-prep mode (no shape selected, click a piece to edit). */
  onPickEdit: () => void;
  onStopEditing: () => void;
}) {
  const inAdd = shape !== null;
  const inEdit = editing !== null;
  const detail = inEdit
    ? `${SHAPE_LABEL[editing.shape]} at ${cellLabel(editing.q, editing.r)}`
    : inAdd
      ? `${color} ${SHAPE_LABEL[shape!]}${rotation > 0 ? ` · ${rotation * 90}°` : ""}`
      : "tap Add to place a shape · tap Edit then a piece to tweak it";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="grid grid-cols-2 gap-1 rounded-[14px] p-1"
        style={{ background: "var(--color-paper-2)" }}
      >
        <ModeButton
          active={inAdd}
          colorVar="blue"
          icon="+"
          label="Add"
          sub={inAdd ? "placing" : "place a shape"}
          onClick={onPickAdd}
        />
        <ModeButton
          active={inEdit}
          colorVar="orange"
          icon="✎"
          label="Edit"
          sub={inEdit ? "editing" : "tap a piece"}
          onClick={() => {
            if (inEdit) onStopEditing();
            else onPickEdit();
          }}
        />
      </div>
      <p
        className="t-mono px-1 text-[11px] leading-tight text-[var(--color-ink-3)]"
        aria-live="polite"
      >
        {detail}
      </p>
    </div>
  );
}

function ModeButton({
  active,
  colorVar,
  icon,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  colorVar: "blue" | "orange";
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors"
      style={{
        background: active ? "#fff" : "transparent",
        color: active ? `var(--color-t-${colorVar})` : "var(--color-ink-2)",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,.10)" : "none",
        border: active
          ? `1.5px solid var(--color-t-${colorVar})`
          : "1.5px solid transparent",
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[14px] font-bold"
        style={{
          background: active
            ? `var(--color-tint-${colorVar})`
            : "var(--color-paper)",
          color: `var(--color-t-${colorVar})`,
        }}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] font-bold">{label}</span>
        <span
          className="t-mono text-[10px]"
          style={{ color: active ? "inherit" : "var(--color-ink-3)" }}
        >
          {sub}
        </span>
      </span>
    </button>
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
