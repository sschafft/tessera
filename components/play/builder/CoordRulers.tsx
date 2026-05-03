"use client";

import { memo } from "react";
import { CELL, PADDING } from "@/lib/grid/coords";

const LETTERS = "ABCDEFGHI";

export interface CoordRulersProps {
  /** Grid width in cells. */
  cols: number;
  /** Grid height in cells. */
  rows: number;
  /** Highlighted column index (active target / hover). 0-based. */
  highlightCol?: number | null;
  /** Highlighted row index. 0-based. */
  highlightRow?: number | null;
}

/**
 * Builder UX foundation (R5): always-visible A–E / 1–N rulers around
 * the canvas. Highlights the active target's row + column so the
 * dock's `B3 · placing` callout has a visual anchor. Static otherwise
 * — recomputes only when grid size changes or highlight moves.
 *
 * Designed to render INSIDE the canvas wrapper (which is
 * `position: relative`) at negative offsets so the rulers sit just
 * outside the frame without blowing the layout.
 */
function CoordRulersImpl({
  cols,
  rows,
  highlightCol = null,
  highlightRow = null,
}: CoordRulersProps) {
  return (
    <>
      {/* Column letters (top) */}
      <div
        aria-hidden="true"
        className="t-mono pointer-events-none absolute flex"
        style={{
          left: PADDING,
          top: -22,
          width: cols * CELL,
        }}
      >
        {Array.from({ length: cols }, (_, i) => {
          const isHighlight = highlightCol === i;
          return (
            <span
              key={`col-${i}`}
              className="text-center text-[10px] font-bold uppercase"
              style={{
                width: CELL,
                letterSpacing: ".1em",
                color: isHighlight
                  ? "var(--color-ink)"
                  : "var(--color-ink-3)",
                opacity: isHighlight ? 1 : 0.7,
                transition: "color .15s ease, opacity .15s ease",
              }}
            >
              {LETTERS[i] ?? "?"}
            </span>
          );
        })}
      </div>
      {/* Row numbers (left) */}
      <div
        aria-hidden="true"
        className="t-mono pointer-events-none absolute flex flex-col"
        style={{
          left: -20,
          top: PADDING,
          height: rows * CELL,
        }}
      >
        {Array.from({ length: rows }, (_, i) => {
          const isHighlight = highlightRow === i;
          return (
            <span
              key={`row-${i}`}
              className="flex items-center justify-center text-[10px] font-bold"
              style={{
                height: CELL,
                color: isHighlight
                  ? "var(--color-ink)"
                  : "var(--color-ink-3)",
                opacity: isHighlight ? 1 : 0.7,
                transition: "color .15s ease, opacity .15s ease",
              }}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
    </>
  );
}

export const CoordRulers = memo(CoordRulersImpl);

/** Convert (q, r) cell coords into a human label like "B3". Exported
 *  so `Dock` and the wrong-because tooltip share one canonical label
 *  derivation. */
export function cellLabel(q: number, r: number): string {
  return `${LETTERS[q] ?? "?"}${r + 1}`;
}
