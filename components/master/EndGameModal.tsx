"use client";

export interface EndGameModalProps {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled confirm dialog for the GM's "End game" action. Replaces the
 * browser-native confirm() so the experience matches the rest of the
 * Tessera surface.
 */
export function EndGameModal({
  open,
  busy,
  onConfirm,
  onCancel,
}: EndGameModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-game-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,26,20,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="t-card flex w-full max-w-[440px] flex-col gap-4 p-6"
        style={{ background: "#fff" }}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[18px]"
            style={{
              background: "var(--color-tint-red)",
              color: "var(--color-t-red)",
            }}
          >
            ⚠
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 id="end-game-title" className="t-display text-[22px] font-bold">
              End the game now?
            </h2>
            <p
              className="text-[14px] text-[var(--color-ink-2)]"
              style={{ lineHeight: 1.5 }}
            >
              All players will see a debrief screen with the goal pattern,
              their final builds, and both briefs. You can&apos;t restart a
              round once the game has ended.
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
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="t-btn t-btn--primary t-btn--sm"
          >
            {busy ? "Ending…" : "End game"}
          </button>
        </div>
      </div>
    </div>
  );
}
