"use client";

import { memo } from "react";

export interface ProgressBarProps {
  correct: number;
  wrong: number;
  /** Pieces placed but not yet evaluated (e.g. optimistic temp). */
  placedNeutral?: number;
  /** Goal piece count — denominator for the bar. */
  total: number;
}

/**
 * Builder UX foundation (R8): tri-colour progress bar that sits above
 * the canvas. Green for correct placements, red for wrong, gray for
 * placed-but-still-being-evaluated. Reads straight from
 * `state.live_score` so it costs nothing extra — same data the score
 * chip uses.
 *
 * Replaces the bottom status footer ("X / Y placed", separate score
 * chip, separate clear button) by giving the player a single
 * always-glanceable bar that captures progress + correctness in one
 * read.
 */
function ProgressBarImpl({
  correct,
  wrong,
  placedNeutral = 0,
  total,
}: ProgressBarProps) {
  const safeTotal = Math.max(1, total);
  const cPct = (correct / safeTotal) * 100;
  const wPct = (wrong / safeTotal) * 100;
  const nPct = (placedNeutral / safeTotal) * 100;
  const placed = correct + wrong + placedNeutral;

  return (
    <div
      className="flex w-full items-center gap-3 rounded-[12px] border px-3.5 py-2"
      style={{
        background: "#fff",
        borderColor: "var(--color-line)",
        boxShadow: "0 1px 0 rgba(0,0,0,.03)",
      }}
      aria-label={`${correct} of ${total} correct, ${placed} placed`}
    >
      <span
        className="t-mono text-[10px] font-bold uppercase"
        style={{
          letterSpacing: ".1em",
          color: "var(--color-ink-3)",
        }}
      >
        {placed} / {total}
      </span>
      <div
        className="flex h-2 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--color-paper-2)" }}
        aria-hidden="true"
      >
        <div
          style={{
            width: `${cPct}%`,
            background: "var(--color-t-green)",
            transition: "width .25s ease",
          }}
        />
        <div
          style={{
            width: `${wPct}%`,
            background: "var(--color-t-red)",
            transition: "width .25s ease",
          }}
        />
        <div
          style={{
            width: `${nPct}%`,
            background: "var(--color-ink-3)",
            opacity: 0.4,
            transition: "width .25s ease",
          }}
        />
      </div>
      <span
        className="t-mono text-[10px] font-bold"
        style={{
          letterSpacing: ".05em",
          color: "var(--color-t-green)",
        }}
      >
        {correct} ✓
      </span>
      {wrong > 0 && (
        <span
          className="t-mono text-[10px] font-bold"
          style={{
            letterSpacing: ".05em",
            color: "var(--color-t-red)",
          }}
        >
          {wrong} ✗
        </span>
      )}
    </div>
  );
}

export const ProgressBar = memo(ProgressBarImpl);
