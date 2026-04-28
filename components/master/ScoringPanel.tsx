"use client";

import { useCallback, useEffect, useState } from "react";

const PENALTY_PRESETS: ReadonlyArray<{
  value: number;
  label: string;
  sub: string;
}> = [
  { value: 0, label: "Off", sub: "no penalty" },
  { value: -1, label: "Light", sub: "−1" },
  { value: -3, label: "Med", sub: "−3" },
  { value: -5, label: "Hard", sub: "−5" },
];

export interface ScoringPanelProps {
  correctPts: number;
  wrongPts: number;
  busy: boolean;
  /**
   * When true, a wrong-pts change will recompute existing pair
   * scores in place (round is running and pairs have placements).
   * Drives a confirm modal so a tap on Hard during a live round
   * doesn't silently slam scores into the negatives.
   */
  retroactive: boolean;
  onChange: (patch: { correct_pts?: number; wrong_pts?: number }) => void;
}

/**
 * Game-wide scoring config tile. Lets the GM bump the per-correct
 * value (stepper) and pick the wrong-attempt penalty from a labelled
 * preset row (Off / Light / Med / Hard). Sits at the top of the
 * super-powers panel so it's always visible.
 *
 * Optimistic local state: each click immediately updates the visible
 * value while the API call resolves. A transient "✓ saved" pip
 * confirms the write. Earlier passes used live props directly which
 * meant the value flickered through the polling round-trip — GMs
 * tapped twice thinking the first didn't take.
 */
export function ScoringPanel({
  correctPts,
  wrongPts,
  busy,
  retroactive,
  onChange,
}: ScoringPanelProps) {
  const [optCorrect, setOptCorrect] = useState<number | null>(null);
  const [optWrong, setOptWrong] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [savedVisible, setSavedVisible] = useState(false);
  const [pendingWrong, setPendingWrong] = useState<number | null>(null);

  // Drop optimistic overrides once the server-side state catches up.
  useEffect(() => {
    if (optCorrect !== null && optCorrect === correctPts) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic-GC: server caught up.
      setOptCorrect(null);
    }
  }, [correctPts, optCorrect]);
  useEffect(() => {
    if (optWrong !== null && optWrong === wrongPts) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic-GC: server caught up.
      setOptWrong(null);
    }
  }, [wrongPts, optWrong]);
  // Show "✓ saved" pip for ~1.4s after each click. Schedule the
  // hide via a fresh timer keyed off savedAt so back-to-back clicks
  // keep the pip visible.
  useEffect(() => {
    if (savedAt === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot pip toggle off a per-save sentinel; the cleanup timer handles auto-hide.
    setSavedVisible(true);
    const id = window.setTimeout(() => setSavedVisible(false), 1400);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  const visibleCorrect = optCorrect ?? correctPts;
  const visibleWrong = optWrong ?? wrongPts;

  const bumpCorrect = useCallback(
    (delta: number) => {
      const next = Math.max(1, Math.min(100, visibleCorrect + delta));
      if (next === visibleCorrect) return;
      setOptCorrect(next);
      setSavedAt(Date.now());
      onChange({ correct_pts: next });
    },
    [visibleCorrect, onChange],
  );
  const commitWrong = useCallback(
    (next: number) => {
      setOptWrong(next);
      setSavedAt(Date.now());
      onChange({ wrong_pts: next });
    },
    [onChange],
  );
  const setWrong = useCallback(
    (next: number) => {
      if (next === visibleWrong) return;
      // Mid-round penalty changes recompute every pair's existing
      // score the next time /play, /test-solution, or /summary fires
      // — so a tap on Hard while pairs are mid-build can drop them
      // from 0 pts to −Nx pts in one click. Confirm before
      // committing when the change is retroactive.
      if (retroactive) {
        setPendingWrong(next);
        return;
      }
      commitWrong(next);
    },
    [visibleWrong, retroactive, commitWrong],
  );

  const pendingPreset =
    pendingWrong !== null
      ? PENALTY_PRESETS.find((p) => p.value === pendingWrong)
      : null;

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[14px] bg-white p-3.5"
      style={{
        border: "1.5px solid var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.06)",
      }}
    >
      {pendingPreset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm scoring change"
          // z-[70] so we sit above the rail's own fullscreen modal
          // (z-50). Playtest #7 caught the GM clicking Light → no
          // visible change because this confirm modal opened
          // *under* the fullscreen rail and stayed unseen.
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          style={{ background: "rgba(31,26,20,0.62)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingWrong(null);
          }}
        >
          <div
            className="t-card flex flex-col gap-3 p-5"
            style={{
              background: "var(--color-tint-yellow)",
              border: "2px solid var(--color-t-yellow)",
              maxWidth: 440,
              boxShadow:
                "0 24px 60px rgba(122,91,0,0.35), 0 6px 0 rgba(0,0,0,.12)",
            }}
          >
            <div
              className="t-mono text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "#7a5b00", letterSpacing: ".15em" }}
            >
              ⚠ Mid-round scoring change
            </div>
            <h3
              className="t-display text-[20px] leading-tight"
              style={{ color: "var(--color-ink)" }}
            >
              Apply <b>{pendingPreset.label}</b> ({pendingPreset.sub}) penalty
              now?
            </h3>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: "#7a5b00" }}
            >
              This recomputes every pair&apos;s score in place — pairs with
              wrong placements right now will drop immediately, before they
              get another chance to test. Generally safer to tune scoring
              between rounds.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  commitWrong(pendingPreset.value);
                  setPendingWrong(null);
                }}
                className="t-btn t-btn--primary"
                disabled={busy}
                autoFocus
              >
                Apply now →
              </button>
              <button
                type="button"
                onClick={() => setPendingWrong(null)}
                className="t-btn t-btn--ghost"
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-[38px] w-[38px] flex-shrink-0 place-items-center rounded-[10px] text-[18px]"
          style={{
            background: "var(--color-tint-yellow)",
            color: "var(--color-t-yellow)",
            boxShadow: "inset 0 0 0 1.5px var(--color-t-yellow)",
          }}
        >
          ★
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold">Scoring</span>
            {savedVisible && (
              <span
                className="t-mono rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  background: "var(--color-tint-green)",
                  color: "var(--color-t-green)",
                }}
                role="status"
                aria-live="polite"
              >
                ✓ saved
              </span>
            )}
          </div>
          <span
            className="block text-[12px] leading-tight"
            style={{ color: "var(--color-ink-3)" }}
          >
            Live across every pair. Changes apply on the next Test
            solution and recompute existing scores.
          </span>
        </div>
      </div>

      {/* Per-correct stepper */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">
          Per correct piece
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bumpCorrect(-1)}
            disabled={busy || visibleCorrect <= 1}
            className="t-mono grid h-7 w-7 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[14px] font-bold disabled:opacity-50"
            aria-label="Decrease points per correct"
          >
            −
          </button>
          <span
            className="t-mono w-10 text-center text-[14px] font-bold"
            style={{ color: "var(--color-ink)" }}
            aria-live="polite"
          >
            +{visibleCorrect}
          </span>
          <button
            type="button"
            onClick={() => bumpCorrect(+1)}
            disabled={busy || visibleCorrect >= 100}
            className="t-mono grid h-7 w-7 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[14px] font-bold disabled:opacity-50"
            aria-label="Increase points per correct"
          >
            +
          </button>
        </div>
      </div>

      {/* Wrong-attempt penalty preset row. Was a +/- stepper which
          had inverted semantics on negative numbers and read
          identically to "Per correct" — GMs reported it as
          "not feasible to trigger". Discrete labelled presets make
          the choice explicit. */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">
          Wrong-attempt penalty
        </span>
        <div
          className="flex gap-0.5 rounded-[10px] bg-[var(--color-paper-2)] p-1"
          role="radiogroup"
          aria-label="Wrong-attempt penalty"
        >
          {PENALTY_PRESETS.map((p) => {
            const active = visibleWrong === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => setWrong(p.value)}
                className="flex-1 cursor-pointer rounded-[8px] border-none px-2 py-1.5 text-center transition-colors disabled:opacity-50"
                style={{
                  background: active ? "#fff" : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                  color: active
                    ? p.value < 0
                      ? "var(--color-t-red)"
                      : "var(--color-ink)"
                    : "var(--color-ink-3)",
                }}
              >
                <span className="block text-[11px] font-bold leading-none">
                  {p.label}
                </span>
                <span
                  className="t-mono mt-0.5 block text-[10px]"
                  style={{ opacity: active ? 1 : 0.7 }}
                >
                  {p.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
