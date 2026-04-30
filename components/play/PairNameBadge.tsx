"use client";

import { useEffect, useState } from "react";
import { PairNameModal } from "./PairNameModal";

export interface PairNameBadgeProps {
  code: string;
  pairId: string;
  /** Current display_name from server, null = unnamed. */
  displayName: string | null;
  /** Fallback when displayName is null. */
  defaultName: string;
  /** Called after a successful save so the parent can refetch. */
  onSaved?: () => void;
  /**
   * When true and the pair is unnamed, surface a one-shot fly-out
   * tip pointing at the badge so players notice the rename
   * affordance during a running round. Auto-dismisses after ~9s
   * and remembers dismissal in sessionStorage so it never re-pops
   * for the same pair in the same tab.
   */
  showRenameTip?: boolean;
}

/**
 * Inline badge that opens the PairNameModal on click. The modal carries
 * the actual rename UX — random suggestion + 🎲 again re-roll, plus a
 * skip path. Naming is intentionally a modal moment (not an inline
 * form) because the team-name pick is a small ritual the pair does
 * together, and the random suggestion is the warm hook.
 */
export function PairNameBadge({
  code,
  pairId,
  displayName,
  defaultName,
  onSaved,
  showRenameTip = false,
}: PairNameBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tipVisible, setTipVisible] = useState(false);

  // One-shot fly-out tip: surfaces only when (a) the parent asked for
  // it (via showRenameTip), (b) the pair is unnamed, (c) we haven't
  // shown it for this pair in this tab. Auto-fades after 9s.
  useEffect(() => {
    if (!showRenameTip) return;
    if (displayName && displayName.length > 0) return;
    if (typeof window === "undefined") return;
    const key = `tessera_rename_tip_seen_${pairId}`;
    if (window.sessionStorage.getItem(key) === "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot tip surface; intentionally lifted into state on mount with a fixed timeout that clears it.
    setTipVisible(true);
    window.sessionStorage.setItem(key, "1");
    const id = window.setTimeout(() => setTipVisible(false), 9000);
    return () => window.clearTimeout(id);
  }, [showRenameTip, displayName, pairId]);

  const named = displayName !== null && displayName.length > 0;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setTipVisible(false);
          setModalOpen(true);
        }}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors hover:bg-white"
        style={{
          background: named ? "var(--color-paper-2)" : "var(--color-tint-yellow)",
          border: named
            ? "1.5px solid var(--color-line)"
            : "1.5px dashed var(--color-t-yellow)",
        }}
        aria-label={named ? "Rename pair" : "Name this pair"}
      >
        <span
          className="t-mono text-[10px] uppercase tracking-widest"
          style={{
            letterSpacing: ".12em",
            color: named ? "var(--color-ink-3)" : "#7a5b00",
          }}
        >
          {named ? "pair" : "name your pair"}
        </span>
        <span
          className="text-[12px] font-bold"
          style={{ color: named ? "var(--color-ink)" : "#7a5b00" }}
        >
          {named ? displayName : defaultName}
        </span>
        <span
          className="t-mono text-[10px]"
          style={{ color: named ? "var(--color-ink-3)" : "#7a5b00" }}
          aria-hidden="true"
        >
          ✎
        </span>
      </button>
      {tipVisible && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-2 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px] shadow-md"
          style={{
            background: "var(--color-ink)",
            color: "#fff",
            maxWidth: 260,
            animation:
              "tessera-tip-in 240ms ease-out both, tessera-tip-out 320ms ease-in 8500ms forwards",
          }}
        >
          <span aria-hidden style={{ marginTop: 2 }}>
            👋
          </span>
          <span style={{ lineHeight: 1.4 }}>
            <b>Name your pair?</b> Tap the badge — funnier on the
            leaderboard than &ldquo;{defaultName}&rdquo;.
          </span>
          <span
            aria-hidden
            className="absolute -top-1.5 left-5 h-3 w-3 rotate-45"
            style={{ background: "var(--color-ink)" }}
          />
          <style>{`
            @keyframes tessera-tip-in {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes tessera-tip-out {
              from { opacity: 1; transform: translateY(0); }
              to { opacity: 0; transform: translateY(-4px); pointer-events: none; }
            }
          `}</style>
        </div>
      )}
      {modalOpen && (
        <PairNameModal
          code={code}
          pairId={pairId}
          initialName={named ? (displayName ?? undefined) : undefined}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
