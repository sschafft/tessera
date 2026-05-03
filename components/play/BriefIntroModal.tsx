"use client";

import { useEffect } from "react";

export interface BriefIntroModalProps {
  open: boolean;
  role: "builder" | "guider";
  title: string;
  rules: string[];
  onDismiss: () => void;
}

/**
 * One-shot intro overlay shown the first time a player sees their brief
 * for a given game + role. Without this, playtesters land in the
 * builder/guider UI and the side-rail brief reads as decoration —
 * they don't know it's their secret constraint, that the partner has
 * a different one, or that it should stay open all round.
 *
 * Once dismissed, the brief panel keeps it visible in the sidebar (PR
 * #74 made the panel always-on; this modal just frames *why* it's
 * there). Dismissal persists in localStorage keyed by game + role so
 * the explainer doesn't re-fire round-over-round.
 */
export function BriefIntroModal({
  open,
  role,
  title,
  rules,
  onDismiss,
}: BriefIntroModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;
  const roleLabel = role === "builder" ? "Builder" : "Guider";
  const colorVar =
    role === "builder" ? "var(--color-t-red)" : "var(--color-t-blue)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="brief-intro-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(31,26,20,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="t-card flex w-full max-w-[460px] flex-col gap-4 p-6"
        style={{ background: "#fff" }}
      >
        <div className="flex flex-col gap-2">
          <span
            className="t-mono"
            style={{
              fontSize: 10,
              color: colorVar,
              fontWeight: 700,
              letterSpacing: ".12em",
            }}
          >
            ● {roleLabel.toUpperCase()} · CONFIDENTIAL BRIEF
          </span>
          <h2
            id="brief-intro-title"
            className="t-display text-[24px] font-bold"
            style={{ lineHeight: 1.2 }}
          >
            {title}
          </h2>
        </div>

        <ul
          className="m-0 flex list-none flex-col gap-2 p-0 text-[14px] text-[var(--color-ink-2)]"
          style={{ lineHeight: 1.45 }}
        >
          {rules.map((rule, i) => (
            <li key={i}>· {rule}</li>
          ))}
        </ul>

        <div
          className="rounded-[10px] px-3.5 py-3 text-[13px]"
          style={{
            background: "var(--color-tint-yellow)",
            color: "#7a5b00",
            lineHeight: 1.5,
          }}
        >
          <p className="m-0">
            This is <b>your</b> brief. Your partner has a{" "}
            <b>different one</b> — don&apos;t read this aloud or paraphrase
            it. They can ask yes / no questions about it; answer honestly,
            like 20 questions.
          </p>
          <p className="m-0 pt-2 text-[12px] text-[var(--color-ink-3)]">
            We&apos;ll keep it visible in the sidebar so you can refer back
            to it any time.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="t-btn t-btn--sm"
            style={{
              background: colorVar,
              color: "#fff",
              boxShadow:
                "0 2px 0 rgba(0,0,0,.10), inset 0 -1px 0 rgba(0,0,0,.10)",
            }}
            autoFocus
          >
            Got it — show my brief →
          </button>
        </div>
      </div>
    </div>
  );
}

/** localStorage key for the per-game, per-role intro dismissal flag. */
export function briefIntroSeenKey(gameCode: string, role: "builder" | "guider") {
  return `tessera_brief_intro_seen_${gameCode}_${role}`;
}
