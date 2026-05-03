"use client";

import { memo } from "react";
import { cellLabel } from "./CoordRulers";

export interface WrongTooltipProps {
  q: number;
  r: number;
  /** Anchor pixel coordinates within the canvas. */
  x: number;
  y: number;
  /**
   * Per-attribute breakdown. `null` when the placement is "extra"
   * (no goal piece in this cell — see scorePlacements). The component
   * shows nothing in that case so the goal layout can't be reverse-
   * engineered.
   */
  reasons: { shape: boolean; color: boolean; rotation: boolean } | null;
}

/**
 * Builder UX foundation (R3): hover-only callout that explains *why*
 * a wrong piece is wrong. Per-attribute breakdown for shape / colour /
 * rotation; position is intentionally always shown as ✓ (or omitted)
 * because flagging a wrong cell would leak the goal layout to the
 * builder. Driven by the server-computed `wrong_reasons` on each
 * placement — see lib/scoring/score.ts.
 *
 * Anchored to the piece's top-centre via absolute positioning relative
 * to the canvas wrapper. `pointer-events: none` so the callout itself
 * never steals hover from the piece.
 */
function WrongTooltipImpl({ q, r, x, y, reasons }: WrongTooltipProps) {
  if (!reasons) {
    return (
      <div
        role="tooltip"
        className="t-mono pointer-events-none absolute z-50 rounded-md px-2.5 py-1.5"
        style={{
          left: x,
          top: y,
          transform: "translate(-50%, calc(-100% - 10px))",
          background: "var(--color-ink)",
          color: "#fff",
          fontSize: 10,
          letterSpacing: ".06em",
          boxShadow: "0 6px 14px rgba(0,0,0,.20)",
          whiteSpace: "nowrap",
        }}
      >
        WRONG · {cellLabel(q, r)} · extra piece
        <Pointer />
      </div>
    );
  }
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-50 rounded-md px-3 py-2"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, calc(-100% - 10px))",
        background: "var(--color-ink)",
        color: "#fff",
        fontSize: 11,
        lineHeight: 1.45,
        boxShadow: "0 6px 14px rgba(0,0,0,.20)",
        whiteSpace: "nowrap",
      }}
    >
      <div
        className="t-mono mb-1"
        style={{
          fontSize: 8,
          letterSpacing: ".12em",
          opacity: 0.6,
        }}
      >
        WRONG · {cellLabel(q, r)}
      </div>
      <div className="flex gap-3">
        <Item label="Shape" ok={!reasons.shape} />
        <Item label="Colour" ok={!reasons.color} />
        <Item label="Rotation" ok={!reasons.rotation} />
      </div>
      <Pointer />
    </div>
  );
}

function Item({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        style={{
          color: ok ? "#9be3b6" : "#ffb3a8",
          fontWeight: 700,
        }}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span style={{ opacity: 0.9 }}>{label}</span>
    </span>
  );
}

function Pointer() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        bottom: -6,
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderTop: "6px solid var(--color-ink)",
      }}
    />
  );
}

export const WrongTooltip = memo(WrongTooltipImpl);
