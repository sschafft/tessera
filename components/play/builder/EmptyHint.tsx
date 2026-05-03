"use client";

import { memo } from "react";
import { CELL, PADDING } from "@/lib/grid/coords";

/**
 * Builder UX foundation (R1): empty-board first-step affordance.
 * Pulses a dashed orange target on cell A1 with a "↖ start here" pill
 * pointing at it, until the player interacts with the canvas. Shows
 * only when `pieces.length === 0` AND no target is active.
 *
 * Pure overlay, zero state. No re-render churn — the parent renders
 * this once and unmounts it after the first cell tap.
 */
function EmptyHintImpl() {
  return (
    <>
      <style>{`
        @keyframes tessera-empty-hint-pulse {
          0%, 100% { transform: scale(1); opacity: .85; }
          50%      { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: PADDING + 4,
          top: PADDING + 4,
          width: CELL - 8,
          height: CELL - 8,
          border: "2px dashed var(--color-t-orange)",
          borderRadius: 8,
          background: "rgba(217, 119, 87, 0.08)",
          pointerEvents: "none",
          animation:
            "tessera-empty-hint-pulse 2.6s ease-in-out infinite",
          transformOrigin: "center",
        }}
      />
      <span
        className="t-mono"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: PADDING + CELL + 8,
          top: PADDING + 12,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".08em",
          color: "var(--color-t-orange)",
          textTransform: "uppercase",
          background: "#fff",
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid var(--color-t-orange)",
          pointerEvents: "none",
          boxShadow: "0 2px 0 rgba(217, 119, 87, .15)",
        }}
      >
        ↖ start here
      </span>
    </>
  );
}

export const EmptyHint = memo(EmptyHintImpl);
