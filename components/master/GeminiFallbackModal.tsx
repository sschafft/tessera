"use client";

export interface GeminiFallbackModalProps {
  open: boolean;
  busy: boolean;
  /** Which side of the brief failed first ('builder' | 'guider'). */
  failedRole: "builder" | "guider" | null;
  /** Start the round again with brief_source_override='library'. */
  onUseLibrary: () => void;
  onCancel: () => void;
}

/**
 * Shown when /rounds/start returns 502 gemini_failed. Tells the GM
 * Gemini misfired and gives them a one-tap path to start with preset
 * library briefs instead — or cancel and set custom briefs / try
 * again later.
 */
export function GeminiFallbackModal({
  open,
  busy,
  failedRole,
  onUseLibrary,
  onCancel,
}: GeminiFallbackModalProps) {
  if (!open) return null;
  const sideLabel =
    failedRole === "builder"
      ? "the builder brief"
      : failedRole === "guider"
        ? "the guider brief"
        : "a brief";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-fallback-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,26,20,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="t-card flex w-full max-w-[480px] flex-col gap-4 p-6"
        style={{ background: "#fff" }}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[18px]"
            style={{
              background: "var(--color-tint-yellow)",
              color: "var(--color-t-yellow)",
            }}
          >
            ✦
          </span>
          <div className="flex flex-col gap-1.5">
            <h2
              id="gemini-fallback-title"
              className="t-display text-[22px] font-bold"
            >
              Gemini didn&apos;t come through.
            </h2>
            <p
              className="text-[14px] text-[var(--color-ink-2)]"
              style={{ lineHeight: 1.5 }}
            >
              We tried to spin up {sideLabel} on the fly and couldn&apos;t
              reach the model. No worries — we have a stack of preset briefs
              ready to go. You can re-roll any of them mid-round if you want
              a different flavour, or cancel and set custom briefs in your
              game settings.
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
            onClick={onUseLibrary}
            disabled={busy}
            className="t-btn t-btn--primary t-btn--sm"
          >
            {busy ? "Starting…" : "Use preset briefs"}
          </button>
        </div>
      </div>
    </div>
  );
}
