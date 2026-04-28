"use client";

import { useEffect, useRef, useState } from "react";

export interface BriefEnvelopeProps {
  role: "builder" | "guider";
  title: string;
  rules: string[];
  /** Default open / closed state; defaults to closed (sealed). */
  defaultOpen?: boolean;
  /** Called the first time the envelope is opened. */
  onOpen?: () => void;
  /** Called when the player minimises the open card to the seal circle. */
  onMinimize?: () => void;
  /** Called when the player closes the open card (× or minimise). Useful
   *  for one-shot follow-ups that should fire only after the brief has
   *  actually been read, e.g. the pair-name nudge. */
  onClose?: () => void;
  /** When true, the envelope pulses to draw attention (used by the gate). */
  emphasize?: boolean;
}

type View = "sealed" | "open" | "minimized";

/**
 * Sealed envelope for a player's secret brief. Three views:
 *   - sealed    : full envelope card with the seal seam (first impression)
 *   - open      : full card with title + rules
 *   - minimized : just the seal circle, parked off the canvas
 *
 * Once peeled open, the player can either re-seal (× → back to sealed)
 * or minimise (− → just the seal circle so the canvas isn't blocked).
 * Clicking the minimised circle re-expands straight to the open card.
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
  onMinimize,
  onClose,
  emphasize = false,
}: BriefEnvelopeProps) {
  const [view, setView] = useState<View>(defaultOpen ? "open" : "sealed");
  const roleLabel = role === "builder" ? "Builder" : "Guider";
  const colorVar =
    role === "builder" ? "var(--color-t-red)" : "var(--color-t-blue)";

  const handleOpen = () => {
    setView("open");
    onOpen?.();
  };
  // Minimise: collapses to seal circle. Does NOT trigger onClose —
  // playtests showed the pair-name nudge popping when players just
  // wanted to get the brief out of the way, which felt unrelated.
  // onClose only fires on the explicit × re-seal action OR an outside
  // click on the open card (treated as the same gesture — see effect
  // below).
  const handleMinimize = () => {
    setView("minimized");
    onMinimize?.();
  };
  const handleSeal = () => {
    setView("sealed");
    onClose?.();
  };

  // Outside-click sealing: when the open card is up AND this envelope
  // owns an onClose callback (i.e. it's the player's own brief, not a
  // partner brief revealed by the accelerant), treat a click anywhere
  // outside it as a re-seal. Mirrors the × button so the pair-name
  // nudge that GuiderView/BuilderView wire onto onClose fires on
  // either gesture. Playtest 2026-04-27 surfaced the gap — players
  // closed by clicking the canvas behind the envelope and never saw
  // the naming prompt. Partner briefs intentionally don't get this
  // behaviour (no onClose to fire) so glancing at the canvas while
  // a partner brief is up doesn't snap it shut.
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (view !== "open") return;
    if (!onClose) return;
    const onPointerDown = (e: PointerEvent) => {
      const card = cardRef.current;
      if (!card) return;
      if (e.target instanceof Node && card.contains(e.target)) return;
      handleSeal();
    };
    // Microtask delay so the click that opened the envelope (if it
    // happened in the same tick) doesn't immediately fire the
    // outside-click and re-seal it.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointerDown);
    };
    // handleSeal closes over view + onClose; since we only attach the
    // listener while view==='open', re-running on view change is the
    // correct semantic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, onClose]);

  if (view === "minimized") {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Re-open ${roleLabel.toLowerCase()}'s brief`}
        title={`${roleLabel}'s brief — click to reopen`}
        className="t-envelope__seal"
        style={{
          width: 56,
          height: 56,
          fontSize: 24,
          position: "static",
          cursor: "pointer",
          border: "none",
        }}
      >
        {role[0]?.toUpperCase()}
      </button>
    );
  }

  if (view === "sealed") {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="t-envelope text-left"
        style={{
          width: 320,
          paddingTop: 60,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 18,
          cursor: "pointer",
          border: emphasize
            ? "2px solid var(--color-t-red)"
            : "1.5px solid var(--color-ink)",
          // Pulse 5 times then settle. We deliberately don't use
          // `infinite` here: continuous motion blocks Playwright's
          // click stability check, surfaces real a11y issues for
          // vestibular sensitivity, and stops drawing the eye after
          // the first few pulses anyway. PR #3 tried capping via a
          // global rule but inline shorthand wins specificity, so the
          // count is set inline now.
          animation: emphasize
            ? "tessera-attention 1100ms ease-in-out 5"
            : "none",
          boxShadow: emphasize
            ? "0 0 0 6px rgba(238, 58, 58, 0.12), 0 4px 0 rgba(0,0,0,.10)"
            : undefined,
        }}
      >
        <div
          className="t-envelope__seal"
          style={{
            // Bigger, more legible seal — was ~32px, now 56px to match
            // the chunky brand mark and read across the canvas.
            width: 56,
            height: 56,
            fontSize: 24,
            top: -16,
            left: -16,
          }}
        >
          {role[0]?.toUpperCase()}
        </div>
        <div style={{ marginTop: 6 }}>
          <div
            className="t-mono"
            style={{
              fontSize: 11,
              color: "var(--color-ink-3)",
              letterSpacing: ".12em",
            }}
          >
            SEALED
          </div>
          <div
            className="t-display"
            style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}
          >
            {roleLabel}&apos;s brief
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-ink-2)",
              marginTop: 6,
            }}
          >
            Tap to open · keep secret
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      ref={cardRef}
      className="t-card relative"
      style={{ width: 320, padding: 18 }}
    >
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
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleMinimize}
            aria-label="Minimise envelope to the seal"
            title="Minimise"
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]"
          >
            <span
              aria-hidden="true"
              style={{
                display: "block",
                width: 12,
                height: 2,
                background: "currentColor",
                borderRadius: 1,
              }}
            />
          </button>
          <button
            type="button"
            onClick={handleSeal}
            aria-label="Seal envelope"
            title="Re-seal"
            className="grid h-7 w-7 place-items-center rounded-md text-[18px] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]"
          >
            ×
          </button>
        </div>
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
