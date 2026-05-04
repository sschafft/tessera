"use client";

import { useEffect } from "react";

export interface EndRoundModalProps {
  open: boolean;
  busy: boolean;
  /** True only when the room has at least 2 pairs — gates the survey CTA. */
  surveyAvailable: boolean;
  /** End the round AND ask the players for the reflection survey. */
  onConfirmWithSurvey: () => void;
  /** End the round without a reflection prompt. */
  onConfirmSkip: () => void;
  onCancel: () => void;
}

/**
 * GM-side prompt at "End round" time. Two paths:
 *
 *   - **Skip** — just end the round. Default for solo-pair rooms
 *     (where the survey would have nowhere to anonymise) and for
 *     facilitators who don't need a reflection beat this round.
 *   - **End + ask** — flips `rounds.reflection_survey_requested`
 *     before the round ends so the player-side `RoundSurvey` card
 *     mounts with the friction-attribution sliders. The aggregate
 *     surfaces in `GameEndedView` once the game wraps.
 *
 * Esc + backdrop click both cancel; nothing fires until the GM
 * picks one of the two CTAs explicitly.
 */
export function EndRoundModal({
  open,
  busy,
  surveyAvailable,
  onConfirmWithSurvey,
  onConfirmSkip,
  onCancel,
}: EndRoundModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-round-title"
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
        <div className="flex flex-col gap-1.5">
          <h2 id="end-round-title" className="t-display text-[22px] font-bold">
            End the round?
          </h2>
          <p
            className="text-[14px] text-[var(--color-ink-2)]"
            style={{ lineHeight: 1.5 }}
          >
            {surveyAvailable
              ? "We can ask each builder + guider a 30-second reflection survey before the debrief — three sliders splitting where the friction landed (self / partner / system). Aggregates show up at game-end, anonymised across pairs."
              : "Reflection survey is available only when at least two pairs are in the room — there's not enough cover to anonymise responses below that floor."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
            onClick={onConfirmSkip}
            disabled={busy}
            className="t-btn t-btn--sm"
            style={{
              background: "var(--color-paper-2)",
              color: "var(--color-ink-2)",
              border: "1.5px solid var(--color-line)",
            }}
          >
            {busy ? "Ending…" : "End round"}
          </button>
          {surveyAvailable && (
            <button
              type="button"
              onClick={onConfirmWithSurvey}
              disabled={busy}
              className="t-btn t-btn--sm"
              style={{
                background: "var(--color-t-blue)",
                color: "#fff",
                boxShadow:
                  "0 2px 0 rgba(0,0,0,.10), inset 0 -1px 0 rgba(0,0,0,.10)",
              }}
            >
              {busy ? "Ending…" : "End + ask reflection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
