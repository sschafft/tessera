"use client";

import { useEffect } from "react";
import { Confetti } from "./Confetti";

export interface SolvedBannerProps {
  /** Pair self-chosen name. Falls back to "your pair" copy. */
  pairName: string | null;
  builderName: string | null;
  guiderName: string | null;
  /** Pieces correct (will equal goal total when this banner shows). */
  correct: number;
  /** Final score for this attempt — uses the GM's correct/wrong points. */
  score: number;
  /** "builder" | "guider" — affects the second-line copy. */
  role: "builder" | "guider";
  onDismiss: () => void;
}

/**
 * Full-screen "you did it" celebration. Fires on both builder and
 * guider tabs the moment correct === total > 0 (driven off the live
 * score that the play API broadcasts to both roles via realtime).
 * Dismissable so the players can keep watching the round wind down
 * or wait for the GM to end the round / start the next one.
 *
 * Confetti burst is keyed off the banner's mount so it only plays
 * once per mount; consumers re-mount via a state-flag flip in
 * BuilderView / GuiderView.
 */
export function SolvedBanner({
  pairName,
  builderName,
  guiderName,
  correct,
  score,
  role,
  onDismiss,
}: SolvedBannerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const headline = pairName ? `${pairName} solved it!` : "You did it!";
  const meName = role === "builder" ? builderName : guiderName;
  const partnerName = role === "builder" ? guiderName : builderName;
  const partnerLabel = role === "builder" ? "guider" : "builder";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solved-banner-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,26,20,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <Confetti intensity="large" />
      <div
        className="t-card relative flex flex-col items-center gap-4 px-10 py-12 text-center"
        style={{
          background: "var(--color-tint-green)",
          border: "2.5px solid var(--color-t-green)",
          maxWidth: "min(560px, 92vw)",
          boxShadow:
            "0 8px 0 rgba(0,0,0,.10), 0 24px 60px rgba(70,184,106,0.35)",
        }}
      >
        <span
          className="t-mono text-[11px] font-bold tracking-widest"
          style={{ color: "var(--color-t-green)", letterSpacing: ".18em" }}
        >
          ★ ROUND SOLVED ★
        </span>
        <h1
          id="solved-banner-title"
          className="t-display text-[44px] leading-[1.05]"
          style={{ color: "var(--color-ink)" }}
        >
          {headline}
        </h1>
        <p
          className="text-[15px]"
          style={{ color: "var(--color-ink-2)", lineHeight: 1.5 }}
        >
          {correct} placement{correct === 1 ? "" : "s"} perfect ·{" "}
          <b style={{ color: "var(--color-t-green)" }}>+{score} points</b>
        </p>
        {meName && partnerName && (
          <p
            className="t-mono text-[12px]"
            style={{ color: "var(--color-ink-3)" }}
          >
            {meName} (you) ↔ {partnerName} ({partnerLabel})
          </p>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="t-btn t-btn--primary"
          style={{ marginTop: 8 }}
          autoFocus
        >
          ↳ Keep watching
        </button>
        <span
          className="t-mono text-[10px]"
          style={{ color: "var(--color-ink-3)" }}
        >
          Esc / click outside to dismiss
        </span>
      </div>
    </div>
  );
}
