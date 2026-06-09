"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type TileColor, type TileShape } from "@/components/canvas/Tile";
import { BriefEnvelope } from "./BriefEnvelope";
import { BriefIntroModal, briefIntroSeenKey } from "./BriefIntroModal";
import { Confetti } from "./Confetti";
import { BUILDER_SHAPES, paletteColorsFor } from "@/lib/pattern/palette";
import { canvasSizeFor } from "@/lib/grid/coords";
import { playSolved } from "@/lib/sound";
import { PairNameBadge } from "./PairNameBadge";
import { SolvedBanner } from "./SolvedBanner";
import { WaitingForRound } from "./builder/WaitingForRound";
import { PrototypeOverlay } from "./builder/PrototypeOverlay";
import { BuilderCanvas, type BuilderTarget } from "./builder/BuilderCanvas";
import { DeleteUndoToast } from "./builder/DeleteUndoToast";
import { Dock, type DockTargetKind } from "./builder/Dock";
import { ProgressBar } from "./builder/ProgressBar";
import { cellLabel } from "./builder/CoordRulers";
import type { PlacedPiece, PlayState } from "./PlayContent";

export interface BuilderViewProps {
  state: PlayState;
}

export function BuilderView({ state }: BuilderViewProps) {
  if (!state.round || state.round.status !== "running") {
    return <WaitingForRound state={state} />;
  }
  return <BuilderInteractive state={state} />;
}

/**
 * Builder view, single-target model (Variation E from the 2026-05-03
 * design pass). One continuous interaction — there is no "Add mode"
 * vs "Edit mode" toggle. At any moment, exactly one thing is the
 * `target`:
 *
 *   - phantom : armed at a cell, ready to commit a placement
 *   - piece   : a placed piece, in edit mode
 *   - null    : idle (the dock controls just update the next-piece
 *               defaults)
 *
 * The left dock always controls whatever the target is. Same control
 * surface, no mental shift.
 *
 * Latency notes:
 *  - Optimistic adds + applyOptimisticPatch (PR #70 helper) preserved
 *    end-to-end; phantom commits go through the same place() flow.
 *  - The dock + canvas + brief panel are all React.memo'd atoms; only
 *    the surface whose props change re-renders on any given action.
 *  - Cell hit-targets re-render cheaply (button-only, no children);
 *    Tile inside placements is independently memo'd against
 *    layout-only props. Correctness wash + badges sit in their own
 *    overlay layers so test feedback flips never re-render the SVG
 *    paths.
 *  - Realtime placement events ride the 50ms fast-lane debounce
 *    (PR #72); the temp→real swap is below the perception threshold.
 */
function BuilderInteractive({ state }: { state: PlayState }) {
  const complexity = state.round?.complexity ?? 5;
  const palette = useMemo(() => paletteColorsFor(complexity), [complexity]);

  // ── Single-target model ────────────────────────────────────────────
  const [target, setTarget] = useState<BuilderTarget>(null);
  // "Next-piece defaults" — the shape/color/rot the next phantom will
  // be armed with. Persists from the previous phantom commit so a
  // builder placing a row of identical tiles doesn't have to re-pick
  // every tap.
  const [nextShape, setNextShape] = useState<TileShape>(BUILDER_SHAPES[0]!);
  const [nextColor, setNextColor] = useState<TileColor>(palette[0] ?? "blue");
  const [nextRotation, setNextRotation] = useState(0);

  // ── Optimistic state (preserved from prior impl) ───────────────────
  const [optimistic, setOptimistic] = useState<PlacedPiece[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(
    new Set(),
  );
  const [optimisticPatches, setOptimisticPatches] = useState<
    Map<string, Partial<PlacedPiece>>
  >(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const [sharingProgress, setSharingProgress] = useState(false);

  // Brief intro modal — first-time-per-(game, role) explainer that
  // frames *why* the brief sidebar is there. Gated by localStorage so
  // the modal doesn't re-fire on round 2/3 or after a tab refresh.
  const [briefIntroOpen, setBriefIntroOpen] = useState(false);
  useEffect(() => {
    if (!state.brief || state.brief.role !== "builder") return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(briefIntroSeenKey(state.code, "builder"))) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage read is client-only and runs once per (game, role); SSR can't seed this.
    setBriefIntroOpen(true);
  }, [state.brief, state.code]);
  const dismissBriefIntro = useCallback(() => {
    setBriefIntroOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        briefIntroSeenKey(state.code, "builder"),
        "1",
      );
    }
  }, [state.code]);

  // Snap next-color into the active palette if complexity shrinks
  // (super-power side effect).
  useEffect(() => {
    if (!palette.includes(nextColor)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- snaps a stale colour selection back into the active palette after a complexity change.
      setNextColor(palette[0] ?? "blue");
    }
  }, [palette, nextColor]);

  // GC: drop optimistic patches whose values now match server state.
  useEffect(() => {
    if (optimisticPatches.size === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical optimistic-patch GC; early-returns when nothing changes.
    setOptimisticPatches((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, patch] of prev.entries()) {
        const server = state.placements.find((p) => p.id === id);
        if (!server) continue;
        const stillNeeded = (
          Object.keys(patch) as (keyof PlacedPiece)[]
        ).some((k) => patch[k] !== undefined && patch[k] !== server[k]);
        if (!stillNeeded) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state.placements, optimisticPatches]);

  // GC: drop optimistic adds once the server-confirmed piece appears at
  // the same cell with matching shape + colour. Holding until the
  // server echoes back avoids the temp→real flicker gap.
  useEffect(() => {
    if (optimistic.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical optimistic-add GC.
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

  // ── Visible pieces — server placements + optimistic, minus deletes,
  //    with patches merged on top. Dedupes by id so a piece that's
  //    been promoted from temp → real (POST returned correctness +
  //    we swapped the optimistic entry's id) doesn't render twice
  //    when /play eventually echoes the same placement back into
  //    state.placements.
  const visiblePieces = useMemo(() => {
    const seen = new Set<string>();
    const out: PlacedPiece[] = [];
    for (const p of state.placements) {
      if (seen.has(p.id) || pendingDeletes.has(p.id)) continue;
      seen.add(p.id);
      const patch = optimisticPatches.get(p.id);
      out.push(patch ? { ...p, ...patch } : p);
    }
    for (const p of optimistic) {
      if (seen.has(p.id) || pendingDeletes.has(p.id)) continue;
      seen.add(p.id);
      const patch = optimisticPatches.get(p.id);
      out.push(patch ? { ...p, ...patch } : p);
    }
    return out;
  }, [state.placements, optimistic, pendingDeletes, optimisticPatches]);

  // The piece currently being edited (target.kind === "piece"). Derived
  // — no separate state. Auto-cleared when the piece disappears (e.g.
  // server-side delete echo).
  const editingPiece = useMemo(() => {
    if (target?.kind !== "piece") return null;
    return visiblePieces.find((p) => p.id === target.id) ?? null;
  }, [target, visiblePieces]);

  useEffect(() => {
    if (target?.kind === "piece" && !editingPiece) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- target points at a piece that no longer exists; clearing here keeps the dock state consistent.
      setTarget(null);
    }
  }, [target, editingPiece]);

  // Resolve dock attrs from the active target. The dock surface is
  // identical across phantom + piece + idle — only the data source
  // shifts.
  const dockShape: TileShape =
    target?.kind === "piece"
      ? (editingPiece?.shape ?? nextShape)
      : target?.kind === "phantom"
        ? target.shape
        : nextShape;
  const dockColor: TileColor =
    target?.kind === "piece"
      ? (editingPiece?.color ?? nextColor)
      : target?.kind === "phantom"
        ? target.color
        : nextColor;
  const dockRotation: number =
    target?.kind === "piece"
      ? (editingPiece?.rot ?? 0)
      : target?.kind === "phantom"
        ? target.rot
        : nextRotation;

  // ── Server actions ─────────────────────────────────────────────────

  /**
   * Optimistic add + POST /placements. Used by phantom commit.
   *
   * Latency-aware response handling: the POST response now carries
   * `correct` + `wrong_reasons` (annotated server-side after the
   * insert — see /api/games/[code]/placements/route.ts). On success
   * we swap the optimistic temp for the real placement with
   * correctness attached so the wash + badge appear in one paint
   * after the POST RTT, instead of waiting another ~50–100ms for the
   * realtime broadcast → /play refetch round-trip. The visiblePieces
   * memo dedupes by id, so when /play eventually echoes the same
   * piece back into state.placements, we don't render it twice.
   */
  const place = useCallback(
    async (
      q: number,
      r: number,
      shape: TileShape,
      color: TileColor,
      rot: number,
    ) => {
      const tempId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 5)}`;
      const optimisticPiece: PlacedPiece = {
        id: tempId,
        shape,
        color,
        q,
        r,
        rot,
      };
      setOptimistic((prev) => [...prev, optimisticPiece]);
      setError(null);
      try {
        const res = await fetch(`/api/games/${state.code}/placements`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shape, color, rot, q, r }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        const j = (await res.json()) as {
          ok: boolean;
          placement?: {
            id: string;
            shape: TileShape;
            color: TileColor;
            q: number;
            r: number;
            rot: number;
            correct?: boolean;
            wrong_reasons?: {
              shape: boolean;
              color: boolean;
              rotation: boolean;
            } | null;
          };
        };
        const real = j.placement;
        if (real?.id) {
          // Swap the temp for the real placement so the wash + badge
          // can render this paint. The id swap also means the GC
          // effect won't try to drop us — content matches now sit in
          // optimistic with the real id, deduped against
          // state.placements when /play echoes it back.
          setOptimistic((prev) =>
            prev
              .filter((p) => p.id !== tempId)
              .concat({
                id: real.id,
                shape: real.shape,
                color: real.color,
                q: real.q,
                r: real.r,
                rot: real.rot,
                correct: real.correct,
                wrong_reasons: real.wrong_reasons ?? null,
              }),
          );
          // Re-anchor the target if the user clicked into edit mode
          // on the temp piece before the POST returned. Without this
          // the swap orphans target.id, editingPiece resolves to null,
          // and the cleanup effect immediately drops the target — so
          // the dock flips back to "no target" the instant the
          // network response lands. Jetty's c=8 playtest hit this
          // every time the agent clicked within ~POST RTT of placing.
          setTarget((t) =>
            t?.kind === "piece" && t.id === tempId
              ? { kind: "piece", id: real.id }
              : t,
          );
        }
        // If the response shape was unexpected, fall through — the
        // GC effect will eventually drop the temp once /play
        // catches up.
      } catch (err) {
        setOptimistic((prev) => prev.filter((p) => p.id !== tempId));
        setError(err instanceof Error ? err.message : "place failed");
      }
    },
    [state.code],
  );

  /**
   * Apply an optimistic patch to a placed piece, fire the PATCH, roll
   * back the patched fields if the server rejects. Same shape as the
   * helper from PR #70 — preserves consistent rollback semantics
   * across move / rotate / shape-change / colour-change.
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

  // ── Cell + piece interaction routing ──────────────────────────────

  const onCellClick = useCallback(
    (q: number, r: number) => {
      // We're guaranteed an empty cell here — BuilderCanvas branches
      // occupied clicks to onPieceClick instead.
      if (target?.kind === "piece") {
        // Editing a piece — move it to the clicked cell.
        applyOptimisticPatch(target.id, { q, r }, (raw) =>
          raw === "cell_taken" ? "That cell already has a piece." : raw,
        );
        return;
      }
      // Idle (or armed phantom from before this UX simplification) —
      // commit a placement immediately with the dock's current
      // shape/colour/rotation. Skipping the phantom arm-then-Place
      // step matches user feedback that any cell click should be
      // read as "place here"; the dock is now the only place to
      // pre-pick attrs before clicking.
      if (target?.kind === "phantom") {
        // Defensive — if a phantom is somehow lingering (e.g. legacy
        // keyboard arming path), commit it first so we don't drop
        // the user's queued placement.
        place(target.q, target.r, target.shape, target.color, target.rot);
      }
      place(q, r, nextShape, nextColor, nextRotation);
      setTarget(null);
    },
    [target, place, applyOptimisticPatch, nextShape, nextColor, nextRotation],
  );

  const onPieceClick = useCallback(
    (piece: PlacedPiece) => {
      // If a phantom was armed, commit it before entering edit mode —
      // the user intent is "place that, now look at this one".
      if (target?.kind === "phantom") {
        place(target.q, target.r, target.shape, target.color, target.rot);
        setNextShape(target.shape);
        setNextColor(target.color);
        setNextRotation(target.rot);
      }
      setTarget({ kind: "piece", id: piece.id });
    },
    [target, place],
  );

  // ── Dock-driven attribute changes ─────────────────────────────────

  const onDockShape = useCallback(
    (s: TileShape) => {
      if (target?.kind === "piece") {
        void applyOptimisticPatch(target.id, { shape: s });
      } else if (target?.kind === "phantom") {
        setTarget({ ...target, shape: s });
      } else {
        setNextShape(s);
      }
    },
    [target, applyOptimisticPatch],
  );

  const onDockColor = useCallback(
    (c: TileColor) => {
      if (target?.kind === "piece") {
        void applyOptimisticPatch(target.id, { color: c });
      } else if (target?.kind === "phantom") {
        setTarget({ ...target, color: c });
      } else {
        setNextColor(c);
      }
    },
    [target, applyOptimisticPatch],
  );

  const onDockRotation = useCallback(
    (r: number) => {
      if (target?.kind === "piece") {
        void applyOptimisticPatch(target.id, { rot: r });
      } else if (target?.kind === "phantom") {
        setTarget({ ...target, rot: r });
      } else {
        setNextRotation(r);
      }
    },
    [target, applyOptimisticPatch],
  );

  // ── Action callbacks ──────────────────────────────────────────────

  const cancelTarget = useCallback(() => setTarget(null), []);

  const onPlace = useCallback(() => {
    if (target?.kind !== "phantom") return;
    place(target.q, target.r, target.shape, target.color, target.rot);
    setNextShape(target.shape);
    setNextColor(target.color);
    setNextRotation(target.rot);
    setTarget(null);
  }, [target, place]);

  const onDoneEditing = useCallback(() => setTarget(null), []);

  // Deferred-delete: when a piece is removed, hold the network DELETE
  // for UNDO_WINDOW_MS so an UndoToast can offer a quick reversal.
  // Two collisions to think about:
  //   - Multiple deletes in quick succession: each new delete commits
  //     the previous one immediately (its window is already in flight,
  //     no need to keep waiting).
  //   - Component unmount: flush the pending delete so we don't orphan
  //     a local-only "removed" state that the server never sees.
  const undoTimerRef = useRef<number | null>(null);
  const undoTargetRef = useRef<string | null>(null);
  const [undoableDelete, setUndoableDelete] = useState<{
    pieceId: string;
    expiresAt: number;
  } | null>(null);

  const flushDelete = useCallback(
    async (pieceId: string) => {
      try {
        const res = await fetch(
          `/api/games/${state.code}/placements/${pieceId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
      } catch (err) {
        // Restore the piece optimistically — pendingDeletes was its only
        // hiding mechanism, so pulling it out brings the piece back.
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          next.delete(pieceId);
          return next;
        });
        setError(err instanceof Error ? err.message : "delete failed");
      }
    },
    [state.code],
  );

  const UNDO_WINDOW_MS = 5000;

  const onRemove = useCallback(() => {
    if (target?.kind !== "piece") return;
    const pieceId = target.id;
    if (pieceId.startsWith("temp-")) return;
    // If a previous delete is still pending its window, commit it now —
    // the user has moved on and shouldn't be able to undo two deletes.
    if (undoTimerRef.current !== null && undoTargetRef.current) {
      window.clearTimeout(undoTimerRef.current);
      flushDelete(undoTargetRef.current);
    }
    setTarget(null);
    setPendingDeletes((prev) => new Set(prev).add(pieceId));
    setError(null);
    const expiresAt = Date.now() + UNDO_WINDOW_MS;
    undoTargetRef.current = pieceId;
    setUndoableDelete({ pieceId, expiresAt });
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      undoTargetRef.current = null;
      setUndoableDelete((cur) => (cur?.pieceId === pieceId ? null : cur));
      flushDelete(pieceId);
    }, UNDO_WINDOW_MS);
  }, [target, flushDelete]);

  const onUndoDelete = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const pieceId = undoTargetRef.current;
    undoTargetRef.current = null;
    if (pieceId) {
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        next.delete(pieceId);
        return next;
      });
    }
    setUndoableDelete(null);
  }, []);

  // Flush any pending delete on unmount so we don't leave the server
  // showing a piece the player thought was gone.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null && undoTargetRef.current) {
        window.clearTimeout(undoTimerRef.current);
        flushDelete(undoTargetRef.current);
      }
    };
  }, [flushDelete]);

  // ── Share progress (preserved) ────────────────────────────────────
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

  // ── Clear all (preserved, two-tap arm pattern) ────────────────────
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
    setTarget(null);
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

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTarget(null);
      if (
        (e.key === "r" || e.key === "R") &&
        !e.metaKey &&
        !e.ctrlKey &&
        target !== null
      ) {
        onDockRotation((dockRotation + 1) % 4);
      }
      if (e.key === "Enter" && target?.kind === "phantom") onPlace();
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        target?.kind === "piece"
      ) {
        e.preventDefault();
        onRemove();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, dockRotation, onDockRotation, onPlace, onRemove]);

  // ── Solved celebration plumbing (preserved) ───────────────────────
  const [partialCelebrationKey, setPartialCelebrationKey] = useState(0);
  const [solvedShown, setSolvedShown] = useState(false);
  const solvedFiredForRoundRef = useRef<string | null>(null);
  const liveCorrect = state.live_score?.correct ?? 0;
  const liveTotal = state.live_score?.total ?? 0;
  const liveScoreVal = state.live_score?.score ?? 0;
  const liveWrong = state.live_score?.wrong ?? 0;
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

  // ── Render ────────────────────────────────────────────────────────

  const partnerName = state.partner?.display_name ?? "guider";
  const meName = state.me.display_name;
  const defaultPairName = `${meName} ↔ ${partnerName}`;

  const targetKind: DockTargetKind = target?.kind ?? null;
  const targetCellLabel: string | null = target
    ? target.kind === "phantom"
      ? cellLabel(target.q, target.r)
      : editingPiece
        ? cellLabel(editingPiece.q, editingPiece.r)
        : null
    : null;

  // Neutral = placed but the server hasn't echoed correctness yet
  // (optimistic temps + recently-mutated pieces). Drives the
  // "checking N" pill on the bar — only meaningful while live
  // scoring is on, otherwise the indicator would persist forever
  // (live_score is null until the GM turns testing on).
  const placedNeutral = state.live_score
    ? Math.max(0, visiblePieces.length - liveCorrect - liveWrong)
    : 0;

  return (
    <div
      // 3-column layout kicks in at 1280px — anything narrower than
      // that puts a 640px (c=8) canvas on a collision course with the
      // 320px asides, which `<main>`'s overflow:hidden then clips,
      // burying edge cells under the dock + brief panel. `minmax(640px,
      // 1fr)` on the centre column locks in the canvas footprint and
      // lets the asides absorb the surplus.
      className="relative grid w-full grid-cols-1 min-[1280px]:[grid-template-columns:288px_minmax(640px,1fr)_288px]"
    >
      {/* ── LEFT: Dock + secondary actions ── */}
      <aside
        className="flex flex-col items-center border-b border-[var(--color-line)] bg-[var(--color-paper-2)] p-5 min-[1280px]:border-b-0 min-[1280px]:border-r"
      >
        {/* The aside is a fixed-width column at the desktop breakpoint
            but stretches edge-to-edge below it. Without this cap the
            dock would balloon to 1100px wide in a stacked layout and
            its colour swatches would be unusably big. */}
        <div className="flex w-full max-w-[20rem] flex-col gap-4 min-[1280px]:max-w-none">
        {state.pair && (
          <PairNameBadge
            code={state.code}
            pairId={state.pair.id}
            displayName={state.pair.display_name}
            defaultName={defaultPairName}
            showRenameTip
          />
        )}
        <Dock
          targetKind={targetKind}
          targetLabel={targetCellLabel}
          shape={dockShape}
          color={dockColor}
          rotation={dockRotation}
          palette={palette}
          onShape={onDockShape}
          onColor={onDockColor}
          onRotation={onDockRotation}
          onCancel={cancelTarget}
          onPlace={onPlace}
          onDoneEditing={onDoneEditing}
          onRemove={onRemove}
        />

        {/* Secondary actions — share + clear. Demoted to small footer
            row so the dock stays the visual centre of the panel. */}
        <div className="flex flex-wrap gap-2 pt-1">
          {state.shares_remaining > 0 && (
            <button
              type="button"
              onClick={shareProgress}
              disabled={sharingProgress || visiblePieces.length === 0}
              className="t-mono rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide disabled:opacity-50"
              style={{
                background: "var(--color-t-orange)",
                color: "#fff",
                border: "none",
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
                  ? "↻ Share progress"
                  : `↻ Share · ${state.shares_remaining}`}
            </button>
          )}
          {visiblePieces.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={clearing}
              className="t-mono rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide disabled:opacity-50"
              style={{
                background: clearArmed
                  ? "var(--color-t-red)"
                  : "transparent",
                color: clearArmed ? "#fff" : "var(--color-ink-3)",
                border: clearArmed
                  ? "1.5px solid var(--color-t-red)"
                  : "1.5px solid var(--color-line)",
              }}
              aria-label="Clear all placements"
            >
              {clearing
                ? "Clearing…"
                : clearArmed
                  ? "Tap again to clear"
                  : "✕ Clear board"}
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="t-mono text-[11px]"
            style={{ color: "var(--color-t-red)" }}
          >
            {error}
          </p>
        )}
        </div>
      </aside>

      {/* ── CENTER: canvas + below-board progress bar + hint ──
          min-w-0 lets the column shrink correctly inside its grid
          track at the stacked breakpoint without flexbox bleeding the
          canvas's intrinsic 640px out into the gutter. The progress
          bar moved below the board so the % correct doesn't flicker
          in the player's peripheral vision while they're working at
          the canvas. */}
      <section className="relative flex min-w-0 flex-col items-center gap-4 p-6">
        <PrototypeOverlay
          prototype={state.prototype}
          complexity={complexity}
        />

        <div className="relative">
          {partialCelebrationKey > 0 && (
            <Confetti key={partialCelebrationKey} intensity="small" />
          )}
          <BuilderCanvas
            pieces={visiblePieces}
            complexity={complexity}
            target={target}
            defaultShape={nextShape}
            defaultColor={nextColor}
            defaultRotation={nextRotation}
            onCellClick={onCellClick}
            onPieceClick={onPieceClick}
          />
        </div>

        <p
          className="t-mono text-center text-[11px]"
          style={{ color: "var(--color-ink-3)", maxWidth: 540 }}
        >
          {target?.kind === "piece"
            ? "editing — change attrs at left, click an empty cell to move, ⌫ to remove"
            : "set shape · colour · rotation at left, then click a cell to place"}
        </p>

        {/* Width-matched progress bar anchors the score under the
            board it summarises. The hard width (canvasSizeFor.width)
            keeps the bar visually flush with the canvas at every
            complexity instead of stretching to the column edges. */}
        <div style={{ width: canvasSizeFor(complexity).width }}>
          <ProgressBar
            correct={liveCorrect}
            wrong={liveWrong}
            placedNeutral={placedNeutral}
            total={liveTotal > 0 ? liveTotal : state.goal_count || 8}
          />
        </div>
      </section>

      {/* ── RIGHT: Brief panel (always visible, per PR #74) ── */}
      <aside
        className="relative flex flex-col items-center p-5"
        style={{ zIndex: 30 }}
      >
        <div className="flex w-full max-w-[20rem] flex-col gap-3 min-[1280px]:max-w-none">
          {state.brief && state.brief.role === "builder" && (
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
        </div>
      </aside>

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
      {state.brief && state.brief.role === "builder" && (
        <BriefIntroModal
          open={briefIntroOpen}
          role="builder"
          title={state.brief.title}
          rules={state.brief.rules}
          onDismiss={dismissBriefIntro}
        />
      )}
      <DeleteUndoToast
        expiresAt={undoableDelete?.expiresAt ?? null}
        durationMs={UNDO_WINDOW_MS}
        label="Piece removed"
        onUndo={onUndoDelete}
      />
    </div>
  );
}
