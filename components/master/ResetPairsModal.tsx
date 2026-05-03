"use client";

import { useEffect } from "react";

export interface ResetPairsModalProps {
  open: boolean;
  busy: boolean;
  /** How many pairs will be wiped — surfaced in the modal copy. */
  pairCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled confirm dialog for the GM's "Reset all pairs" action.
 * Replaces the browser-native confirm() so the experience matches
 * the rest of the Tessera surface (EndGameModal etc.). Destructive
 * action — orange tint + red CTA so the GM doesn't fire it
 * accidentally on a working roster.
 */
export function ResetPairsModal({
  open,
  busy,
  pairCount,
  onConfirm,
  onCancel,
}: ResetPairsModalProps) {
  // Esc closes (mirrors the other Master modals).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const pluralise = pairCount === 1 ? "pair" : "pairs";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pairs-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,26,20,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="t-card flex w-full max-w-[460px] flex-col gap-4 p-6"
        style={{ background: "#fff" }}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[18px]"
            style={{
              background: "var(--color-tint-orange)",
              color: "var(--color-t-orange)",
            }}
          >
            ↺
          </span>
          <div className="flex flex-col gap-1.5">
            <h2
              id="reset-pairs-title"
              className="t-display text-[22px] font-bold"
            >
              Reset all {pluralise}?
            </h2>
            <p
              className="text-[14px] text-[var(--color-ink-2)]"
              style={{ lineHeight: 1.5 }}
            >
              All <b>{pairCount}</b>{" "}{pluralise}{" "}will be wiped and every
              participant returned to the lobby. You&apos;ll re-pair from
              scratch — useful when you accidentally pair the wrong
              people, or want a fresh allocation.
            </p>
            <p className="text-[12px] text-[var(--color-ink-3)]">
              Pre-round only. Observers stay seated and keep watching
              their previous pair until you re-allocate.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="t-btn t-btn--ghost t-btn--sm"
          >
            Keep pairs
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="t-btn t-btn--sm"
            style={{
              background: "var(--color-t-red)",
              color: "#fff",
              boxShadow:
                "0 2px 0 rgba(0,0,0,.10), inset 0 -1px 0 rgba(0,0,0,.10)",
            }}
          >
            {busy ? "Resetting…" : "↺ Reset all pairs"}
          </button>
        </div>
      </div>
    </div>
  );
}
