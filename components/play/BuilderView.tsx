"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import { InteractiveCanvas } from "@/components/canvas/InteractiveCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { Confetti } from "./Confetti";
import { BUILDER_SHAPES, paletteColorsFor } from "@/lib/pattern/palette";
import { playSolved } from "@/lib/sound";
import { PairNameBadge } from "./PairNameBadge";
import { SolvedBanner } from "./SolvedBanner";
import { WaitingForRound } from "./builder/WaitingForRound";
import { PrototypeOverlay } from "./builder/PrototypeOverlay";
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- snaps a stale selection back into the active palette after a complexity change.
      setSelectedColor(palette[0] ?? "blue");
    }
  }, [palette, selectedColor]);

  // GC: any optimistic patch whose values now match state.placements
  // can be dropped — the server caught up. design_patterns.md >
  // "Optimistic UI with server reconciliation": GC by content match.
  useEffect(() => {
    if (optimisticPatches.size === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical optimistic-GC; no cascading-render risk because we early-return when nothing changes.
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

  // GC optimistic adds once the server-confirmed piece appears at the
  // same cell with matching shape/colour. Dropping the temp piece on
  // POST success used to leave a flicker gap before the realtime
  // broadcast caught up; keeping it until state.placements actually
  // contains the new piece eliminates the visible stutter.
  useEffect(() => {
    if (optimistic.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical optimistic-add GC; same reason as the optimisticPatches GC above.
    setOptimistic((prev) => {
      const next = prev.filter((opt) => {
        const matched = state.placements.some(
          (sp) =>
            sp.q === opt.q &&
            sp.r === opt.r &&
            sp.shape === opt.shape &&
            sp.color === opt.color,
        );
        return !matched;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [state.placements, optimistic.length]);

  // Server placements + local optimistic adds, minus locally-pending
  // deletes, with optimistic patches merged on top. v1.3 made testing
  // live by default — `correct` flows from the server's per-placement
  // computation (test_enabled defaults to true), so pieces light up
  // green / red as they're placed without an explicit Test solution
  // step. Optimistic temp pieces (id startsWith "temp-") have no
  // server correct flag yet — they read as null until the GC effect
  // swaps them for the server-confirmed row.
  const visiblePieces = useMemo(
    () =>
      [...state.placements, ...optimistic]
        .filter((p) => !pendingDeletes.has(p.id))
        .map((p) => {
          const patch = optimisticPatches.get(p.id);
          return patch ? { ...p, ...patch } : p;
        }),
    [state.placements, optimistic, pendingDeletes, optimisticPatches],
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

  // Forward-declared via ref so the Esc/R keydown effect (further
  // down) can call rotateEditing without TS hoisting the function
  // identifier out of scope. The ref is updated synchronously after
  // every render via the useLayoutEffect below.
  const rotateEditingRef = useRef<(() => Promise<void>) | null>(null);

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
        // Leave the optimistic piece in place — the GC effect drops it
        // once state.placements echoes the same q/r/shape/colour back,
        // which avoids the flicker between POST success and broadcast.
      } catch (err) {
        setOptimistic((prev) => prev.filter((p) => p.id !== tempId));
        setError(err instanceof Error ? err.message : "place failed");
      }
    },
    [selectedShape, selectedColor, selectedRotation, state.code],
  );

  /**
   * Apply an optimistic patch to an existing placement, fire the PATCH,
   * roll back the same fields if the server rejects. Single helper so
   * move / rotate / convert all share identical error semantics — a
   * failed PATCH never leaves an orphan patch that GC can't clean up
   * (the GC effect can only drop patches when server state catches up;
   * a 4xx means it never will). See `design/design_patterns.md` →
   * "Optimistic UI with server reconciliation".
   */
  const applyOptimisticPatch = useCallback(
    async (
      id: string,
      patch: Partial<PlacedPiece>,
      formatError: (raw: string) => string = (s) => s,
    ) => {
      setError(null);
      const patchedKeys = Object.keys(patch) as Array<keyof PlacedPiece>;
      setOptimisticPatches((prev) => {
        const next = new Map(prev);
        next.set(id, { ...next.get(id), ...patch });
        return next;
      });
      if (id.startsWith("temp-")) return; // POST will sync the new fields.
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
        // Roll back exactly the fields we patched. Preserve any other
        // in-flight patches on the same piece (e.g. a rotate landed
        // while a move was racing).
        setOptimisticPatches((prev) => {
          const next = new Map(prev);
          const cur = next.get(id);
          if (!cur) return next;
          const rolled: Partial<PlacedPiece> = { ...cur };
          for (const key of patchedKeys) delete rolled[key];
          if (Object.keys(rolled).length === 0) next.delete(id);
          else next.set(id, rolled);
          return next;
        });
        const reason = err instanceof Error ? err.message : "operation failed";
        setError(formatError(reason));
      }
    },
    [state.code],
  );

  const moveEditingTo = useCallback(
    async (q: number, r: number) => {
      if (!editingPiece) return;
      await applyOptimisticPatch(editingPiece.id, { q, r }, (raw) =>
        raw === "cell_taken" ? "That cell already has a piece." : raw,
      );
    },
    [editingPiece, applyOptimisticPatch],
  );

  // Esc cancels whichever mode is active; R rotates the editing piece
  // (or rotates the next-drop selection when in add mode). The actual
  // rotateEditing function is defined just below and tracked via
  // rotateEditingRef so the effect can call it without a forward-ref
  // hazard.
  useEffect(() => {
    if (selectedShape === null && editingId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedShape(null);
        setEditingId(null);
      } else if (e.key === "r" || e.key === "R") {
        if (editingPiece) {
          void rotateEditingRef.current?.();
        } else if (selectedShape !== null) {
          setSelectedRotation((p) => (p + 1) % 4);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedShape, editingId, editingPiece]);

  const rotateEditing = useCallback(async () => {
    if (!editingPiece) return;
    const newRot = (editingPiece.rot + 1) % 4;
    await applyOptimisticPatch(editingPiece.id, { rot: newRot });
  }, [editingPiece, applyOptimisticPatch]);

  // Mirror rotateEditing into the forward-ref so the keydown effect
  // above can call it. useLayoutEffect runs synchronously after render
  // commit and before the next paint, so the ref is up-to-date by the
  // time any keydown fires.
  useLayoutEffect(() => {
    rotateEditingRef.current = rotateEditing;
  });

  /**
   * Tap-occupied-cell-with-selection: convert the existing piece to
   * the currently selected shape/color/rotation in place. Single
   * PATCH; piece identity is preserved so stay-on-cell mutations
   * don't churn through new IDs.
   */
  const convertPiece = useCallback(
    async (target: PlacedPiece) => {
      if (!selectedShape) return;
      await applyOptimisticPatch(target.id, {
        shape: selectedShape,
        color: selectedColor,
        rot: selectedRotation,
      });
    },
    [selectedShape, selectedColor, selectedRotation, applyOptimisticPatch],
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

  // SolvedBanner plumbing — fires the first time live_score reports
  // correct === total > 0 in the current round. v1.3 dropped the
  // builder-side test-solution celebration in favour of the always-on
  // live correctness — confetti per partial-correct moment now lives
  // on the rising edge of `live_score.correct` rather than a Test
  // submission count.
  const [partialCelebrationKey, setPartialCelebrationKey] = useState(0);
  const [solvedShown, setSolvedShown] = useState(false);
  const solvedFiredForRoundRef = useRef<string | null>(null);
  const liveCorrect = state.live_score?.correct ?? 0;
  const liveTotal = state.live_score?.total ?? 0;
  const liveScoreVal = state.live_score?.score ?? 0;
  const prevLiveCorrectRef = useRef(0);
  useEffect(() => {
    const prev = prevLiveCorrectRef.current;
    if (liveCorrect > prev && liveCorrect < liveTotal) {
      setPartialCelebrationKey((k) => k + 1);
    }
    prevLiveCorrectRef.current = liveCorrect;
  }, [liveCorrect, liveTotal]);
  useEffect(() => {
    const roundId = state.round?.id ?? null;
    if (!roundId) return;
    if (
      liveTotal > 0 &&
      liveCorrect === liveTotal &&
      solvedFiredForRoundRef.current !== roundId
    ) {
      solvedFiredForRoundRef.current = roundId;
      setSolvedShown(true);
      if (state.sound_on) playSolved();
    }
  }, [liveCorrect, liveTotal, state.round?.id, state.sound_on]);

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
            showRenameTip
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
          setRotation={setSelectedRotation}
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
          editing={editingPiece}
          rotateEditing={rotateEditing}
          stopEditing={stopEditing}
        />
        {error && (
          <p className="text-[12px] text-[var(--color-t-red)]" role="alert">
            {error}
          </p>
        )}
      </aside>
      <section className="relative flex items-start gap-4 overflow-auto p-6">
        <div className="flex flex-1 flex-col items-center gap-3">
          <PrototypeOverlay
            prototype={state.prototype}
            complexity={complexity}
          />

          <div className="relative">
            {/* Partial-success confetti anchored over the canvas, fired
                on the rising edge of correct count (live testing). */}
            {partialCelebrationKey > 0 && (
              <Confetti key={partialCelebrationKey} intensity="small" />
            )}
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
                style={(() => {
                  const s = state.live_score.score;
                  const tint =
                    s > 0
                      ? "green"
                      : s < 0
                        ? "red"
                        : null;
                  if (tint === null) {
                    return {
                      background: "var(--color-paper-2)",
                      color: "var(--color-ink-2)",
                      boxShadow: "inset 0 0 0 1.5px var(--color-line)",
                    };
                  }
                  return {
                    background: `var(--color-tint-${tint})`,
                    color: `var(--color-t-${tint})`,
                    boxShadow: `inset 0 0 0 1.5px var(--color-t-${tint})`,
                  };
                })()}
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
                disabled={sharingProgress || visiblePieces.length === 0}
                className="rounded-full px-4 py-1.5 text-[12px] font-bold disabled:opacity-50"
                style={{
                  background: "var(--color-t-orange)",
                  color: "#fff",
                  boxShadow:
                    "0 2px 0 rgba(0,0,0,.10), inset 0 -1px 0 rgba(0,0,0,.10)",
                }}
                title={
                  visiblePieces.length === 0
                    ? "Place at least one piece before sharing — empty shares burn your share count."
                    : "Snap your current canvas to the guider so they can spot mistakes."
                }
              >
                {sharingProgress
                  ? "Sharing…"
                  : state.shares_remaining === 1
                    ? "↻ Share progress with guider"
                    : `↻ Share progress with guider · ${state.shares_remaining} available`}
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
        <aside
          className="relative flex flex-shrink-0 flex-col items-end gap-3 self-start"
          style={{ width: 320, zIndex: 30 }}
        >
          {state.brief && state.brief.role === "builder" && (
            // Key on the brief title so a super-power-driven brief
            // swap (Change builder brief) remounts the envelope and
            // surfaces the new content cleanly.
            <BriefEnvelope
              key={state.brief.title}
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
              revealedPartner
            />
          )}
        </aside>
      </section>
      {solvedShown && (
        <SolvedBanner
          pairName={state.pair?.display_name ?? null}
          builderName={state.me.display_name}
          guiderName={state.partner?.display_name ?? null}
          correct={liveCorrect}
          score={liveScoreVal}
          role="builder"
          onDismiss={() => setSolvedShown(false)}
        />
      )}
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
        // Active = tinted background (not white) so the selected mode
        // pops against the paper-2 sidebar. Pre-orchestrator-#5 the
        // active state was background:#fff which on top of paper-2
        // (#f5efe2) was almost invisible; agents reported "clicking
        // Add does nothing" because the visual feedback was too soft.
        background: active
          ? `var(--color-tint-${colorVar})`
          : "transparent",
        color: active ? `var(--color-t-${colorVar})` : "var(--color-ink-2)",
        boxShadow: active
          ? `0 1px 3px rgba(0,0,0,.10), inset 0 0 0 1.5px var(--color-t-${colorVar})`
          : "none",
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
  setRotation,
}: {
  selected: TileShape | null;
  onSelect: (shape: TileShape | null) => void;
  color: TileColor;
  rotation: number;
  setRotation: (r: number) => void;
}) {
  const cycleRotation = () => setRotation((rotation + 1) % 4);
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
              {/* Inline rotation chip on the selected tile — Figma-
                  pattern affordance. Same control as the Tools panel
                  below and the keyboard `R`, but right next to the
                  preview the user is looking at. e.stopPropagation so
                  clicking the chip doesn't deselect the shape. */}
              {isSelected && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleRotation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      cycleRotation();
                    }
                  }}
                  className="t-mono absolute -right-1.5 -top-1.5 inline-flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide hover:bg-[var(--color-paper-2)]"
                  style={{
                    border: "1.5px solid var(--color-ink)",
                    color: "var(--color-ink)",
                    boxShadow: "0 1px 0 rgba(0,0,0,.10)",
                  }}
                  aria-label={`Rotate, currently ${rotation * 90}°`}
                  title={`Rotate · ${rotation * 90}° (R)`}
                >
                  ↻ {rotation * 90}°
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Inline rotation row — shows whenever a shape is in the tray
          (regardless of selection) so the affordance is discoverable
          before the user has picked. Tap the row to cycle the
          rotation that the next placement will use. */}
      <button
        type="button"
        onClick={cycleRotation}
        className="mt-2 flex w-full items-center justify-between rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2 text-left text-[12px] font-medium hover:bg-[var(--color-paper-2)]"
        title="Rotate the next-placed piece (cycles 0° / 90° / 180° / 270°)"
        aria-label={`Rotate next-placed piece, currently ${rotation * 90}°`}
      >
        <span className="flex items-center gap-2">
          <span className="text-[16px]" aria-hidden="true">
            ↻
          </span>
          <span>
            Rotate{" "}
            <span className="t-mono text-[var(--color-ink-2)]">
              {rotation * 90}°
            </span>
          </span>
        </span>
        <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
          R
        </span>
      </button>
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
  editing,
  rotateEditing,
  stopEditing,
}: {
  rotation: number;
  setRotation: (r: number) => void;
  deselect: () => void;
  hasSelection: boolean;
  editing: PlacedPiece | null;
  rotateEditing: () => void | Promise<void>;
  stopEditing: () => void;
}) {
  // Tools panel reflects the active mode:
  //   - Add (hasSelection): rotate the next-drop selection.
  //   - Edit (editing != null): rotate the piece being edited.
  //   - Idle: both buttons disabled.
  // Pre-fix the Rotate button only worked in Add mode, so editing a
  // piece left the sidebar Rotate stuck disabled even though the
  // floating EditingActionBar's ↻ button worked. Players who looked
  // at the sidebar first read it as "rotate is broken".
  const inEdit = editing !== null;
  const editRotLabel = inEdit ? `${editing!.rot * 90}°` : `${rotation * 90}°`;
  const tools: {
    icon: string;
    label: string;
    k: string;
    onClick?: () => void;
    enabled: boolean;
  }[] = [
    {
      icon: "↺",
      label: inEdit
        ? `Rotate piece · ${editRotLabel}`
        : `Rotate · ${editRotLabel}`,
      k: "R",
      onClick: inEdit
        ? () => void rotateEditing()
        : () => setRotation((rotation + 1) % 4),
      enabled: inEdit || hasSelection,
    },
    {
      icon: "⊘",
      label: inEdit ? "Stop editing" : "Deselect",
      k: "Esc",
      onClick: inEdit ? stopEditing : deselect,
      enabled: inEdit || hasSelection,
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


