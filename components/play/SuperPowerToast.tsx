"use client";

import { useEffect, useState } from "react";
import {
  useGameEvents,
  type GameEventDetail,
} from "@/lib/realtime/useGameEvents";

/**
 * Tiny transient toast that surfaces every super-power + round
 * trigger as it fires. Playtest #6 found that observers (and the
 * pair players themselves) often couldn't tell when a super-power
 * had been triggered on their pair — the GM clicked, something
 * changed in the underlying state, but the player just saw the
 * downstream visual effect without any cause attribution.
 *
 * Lives at the top of the play viewport across all three role
 * views. Pure passive surface — no input, no state mutation.
 */
const KIND_COPY: Record<string, { icon: string; label: string; tint: string }> =
  {
    superpower_triggered: { icon: "⚡", label: "Super-power fired", tint: "purple" },
    round_started: { icon: "▶", label: "Round started", tint: "green" },
    round_extended: { icon: "+", label: "Time added", tint: "blue" },
    snapshot_shared: { icon: "↻", label: "Builder shared progress", tint: "orange" },
    scoring_changed: { icon: "★", label: "Scoring updated", tint: "yellow" },
    allocation_changed: { icon: "⇋", label: "Roles updated", tint: "blue" },
  };

const SUPER_POWER_KINDS: Record<string, string> = {
  prototype: "🔮 Prototype unlock",
  reveal_briefs: "📖 Reveal briefs",
  test_build: "✓ Test build enabled",
  agile_share: "↻ Agile share",
  time_pressure: "⏱ Time pressure",
  vocab_swap: "✦ Change guider brief",
  change_builder_brief: "✦ Change builder brief",
  randomizer: "🎲 Randomizer",
  requirement_change: "✎ Requirement change",
  harder: "▲ Harder",
  easier: "▼ Easier",
};

interface ToastEntry {
  id: number;
  icon: string;
  label: string;
  tint: string;
}

export interface SuperPowerToastProps {
  gameId: string | null;
}

export function SuperPowerToast({ gameId }: SuperPowerToastProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const onDetail = (detail: GameEventDetail) => {
    const meta = KIND_COPY[detail.kind];
    if (!meta) return;
    let label = meta.label;
    if (detail.kind === "superpower_triggered") {
      const kind = (detail.payload.kind as string | undefined) ?? "";
      const sub = SUPER_POWER_KINDS[kind];
      if (sub) label = sub;
    }
    if (detail.kind === "round_extended") {
      const delta = (detail.payload.delta_seconds as number | undefined) ?? 0;
      label = `+${Math.round(delta)}s added to the round`;
    }
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, icon: meta.icon, label, tint: meta.tint }]);
  };

  // Subscribe with a no-op refetch + the detail callback. PlayContent
  // already has its own useGameEvents subscription that triggers
  // refetch; this one is purely for the transient banner so we don't
  // double-refetch.
  useGameEvents(gameId, () => {}, onDetail);

  // Auto-dismiss each toast after 3.2s.
  useEffect(() => {
    if (toasts.length === 0) return;
    const ids = toasts.map((t) => t.id);
    const timer = window.setTimeout(() => {
       
      setToasts((prev) => prev.filter((t) => !ids.includes(t.id)));
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 flex-col gap-1.5"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="t-card pointer-events-auto flex items-center gap-2 px-3.5 py-2 text-[13px] font-bold"
          style={{
            background: `var(--color-tint-${t.tint})`,
            color: `var(--color-t-${t.tint})`,
            border: `1.5px solid var(--color-t-${t.tint})`,
            boxShadow: "0 4px 0 rgba(0,0,0,.08)",
            animation: "tessera-toast-in 220ms ease-out",
          }}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </div>
      ))}
      <style>{`
        @keyframes tessera-toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
