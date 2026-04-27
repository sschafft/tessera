"use client";

import { useState } from "react";

export interface BriefEnvelopeProps {
  role: "builder" | "guider";
  title: string;
  rules: string[];
  /** Default open / closed state; defaults to closed (sealed). */
  defaultOpen?: boolean;
  /** Called the first time the envelope is opened. */
  onOpen?: () => void;
  /** When true, the envelope pulses to draw attention (used by the gate). */
  emphasize?: boolean;
}

/**
 * Sealed envelope for a player's secret brief. Click to peel open;
 * click × to seal again. Visual style ports the .t-envelope utility
 * defined in styles/tessera.css.
 *
 * Per the locked decisions, the brief content is plain text — no
 * dangerouslySetInnerHTML — so even GM-authored free-text briefs in M5.6
 * can't introduce XSS.
 */
export function BriefEnvelope({
  role,
  title,
  rules,
  defaultOpen = false,
  onOpen,
  emphasize = false,
}: BriefEnvelopeProps) {
  const [open, setOpen] = useState(defaultOpen);
  const roleLabel = role === "builder" ? "Builder" : "Guider";
  const colorVar =
    role === "builder" ? "var(--color-t-red)" : "var(--color-t-blue)";

  const handleOpen = () => {
    setOpen(true);
    onOpen?.();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="t-envelope text-left"
        style={{
          width: 280,
          paddingTop: 36,
          cursor: "pointer",
          border: emphasize
            ? "2px solid var(--color-t-red)"
            : "1.5px solid var(--color-ink)",
          animation: emphasize
            ? "tessera-attention 1100ms ease-in-out infinite"
            : "none",
          boxShadow: emphasize
            ? "0 0 0 6px rgba(238, 58, 58, 0.12), 0 4px 0 rgba(0,0,0,.10)"
            : undefined,
        }}
      >
        <div className="t-envelope__seal">{role[0]?.toUpperCase()}</div>
        <div style={{ marginTop: 6 }}>
          <div
            className="t-mono"
            style={{
              fontSize: 10,
              color: "var(--color-ink-3)",
              letterSpacing: ".12em",
            }}
          >
            SEALED
          </div>
          <div
            className="t-display"
            style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}
          >
            {roleLabel}&apos;s brief
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-ink-2)",
              marginTop: 4,
            }}
          >
            Tap to open · keep secret
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="t-card relative" style={{ width: 320, padding: 18 }}>
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="t-mono"
          style={{
            fontSize: 10,
            color: colorVar,
            fontWeight: 700,
            letterSpacing: ".12em",
          }}
        >
          ● {roleLabel.toUpperCase()} · CONFIDENTIAL
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Seal envelope"
          className="grid h-7 w-7 place-items-center rounded-md text-[18px] text-[var(--color-ink-2)]"
        >
          ×
        </button>
      </div>
      <div
        className="t-display mb-2.5"
        style={{ fontSize: 17, lineHeight: 1.3 }}
      >
        {title}
      </div>
      <ul
        className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-[var(--color-ink-2)]"
        style={{ lineHeight: 1.4 }}
      >
        {rules.map((rule, i) => (
          <li key={i}>· {rule}</li>
        ))}
      </ul>
      <div
        className="mt-3.5 rounded-[10px] px-3 py-2.5 text-[12px]"
        style={{
          background: "var(--color-tint-yellow)",
          color: "#7a5b00",
        }}
      >
        Your partner has a <b>different brief</b>. <b>Don&apos;t read this
        aloud or paraphrase it.</b> They can ask you yes / no questions about
        it — answer honestly, like 20 questions.
      </div>
    </div>
  );
}
