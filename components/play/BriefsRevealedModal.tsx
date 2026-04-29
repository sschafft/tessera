"use client";

import { useEffect, useState } from "react";
import type { BriefSummary } from "./PlayContent";

export interface BriefsRevealedModalProps {
  /** Round id used as the dedupe key — modal pops at most once per round. */
  roundId: string;
  /** This player's own brief. Null if their side has briefs off. */
  myBrief: BriefSummary | null;
  /** The partner's brief, surfaced by the Reveal-briefs super-power. */
  partnerBrief: BriefSummary;
}

/**
 * Pops once per round the moment Reveal-briefs surfaces the partner's
 * brief. Renders both briefs side-by-side with role-tinted backgrounds:
 * builder = orange (the warm "doing" side), guider = blue (the cool
 * "describing" side). Players close it explicitly; the briefs stay
 * available in the side rail afterwards.
 */
export function BriefsRevealedModal({
  roundId,
  myBrief,
  partnerBrief,
}: BriefsRevealedModalProps) {
  const [visible, setVisible] = useState(true);
  // Dedupe per-round in sessionStorage so a refetch / realtime event
  // doesn't re-pop the modal after the player's already dismissed it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `tessera_briefs_revealed_seen_${roundId}`;
    if (window.sessionStorage.getItem(key) === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot dedupe; if already seen this round, don't render.
      setVisible(false);
      return;
    }
    window.sessionStorage.setItem(key, "1");
  }, [roundId]);

  if (!visible) return null;

  // Pair the two briefs in builder-then-guider order so the layout
  // is stable regardless of which role this player is.
  const briefs: Array<{
    role: "builder" | "guider";
    title: string;
    rules: string[];
    isMine: boolean;
  }> = [];
  if (myBrief) briefs.push({ ...myBrief, isMine: true });
  briefs.push({ ...partnerBrief, isMine: false });
  briefs.sort((a, b) => (a.role === "builder" ? -1 : b.role === "builder" ? 1 : 0));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Briefs revealed"
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{
        background: "rgba(31,26,20,0.62)",
        animation: "tessera-overlay-fade 220ms ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setVisible(false);
      }}
    >
      <div
        className="t-card flex w-full flex-col gap-4 p-6"
        style={{ background: "#fff", maxWidth: 720 }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            className="t-mono text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "var(--color-t-purple)", letterSpacing: ".15em" }}
          >
            📖 Briefs revealed
          </span>
          <h2 className="t-display text-[22px] leading-tight">
            Now you can both see what the other was working with.
          </h2>
          <p className="text-[13px] text-[var(--color-ink-2)]">
            Talk about it on the call: what would you have asked if you&apos;d
            known? Which part of the misunderstanding was language vs. the
            constraints in your brief?
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {briefs.map((brief) => (
            <BriefCard key={brief.role} brief={brief} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setVisible(false)}
          className="t-btn t-btn--primary self-center"
        >
          Got it · back to the canvas
        </button>
      </div>
      <style>{`
        @keyframes tessera-overlay-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function BriefCard({
  brief,
}: {
  brief: {
    role: "builder" | "guider";
    title: string;
    rules: string[];
    isMine: boolean;
  };
}) {
  const isBuilder = brief.role === "builder";
  // Builder = orange tint (the warm "doing" side), guider = blue
  // tint (the cool "describing" side). Distinct enough that you
  // don't mix them up at a glance.
  const tint = isBuilder ? "orange" : "blue";
  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] px-4 py-4"
      style={{
        background: `var(--color-tint-${tint})`,
        border: `1.5px solid var(--color-t-${tint})`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="t-mono text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: `var(--color-t-${tint})`,
            letterSpacing: ".12em",
          }}
        >
          ● {brief.role.toUpperCase()}
        </span>
        {brief.isMine && (
          <span
            className="t-mono rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ color: "var(--color-ink-2)" }}
          >
            yours
          </span>
        )}
      </div>
      <div
        className="t-display text-[16px] font-bold leading-tight"
        style={{ color: "var(--color-ink)" }}
      >
        {brief.title}
      </div>
      <ul
        className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12px]"
        style={{ color: "var(--color-ink-2)", lineHeight: 1.4 }}
      >
        {brief.rules.map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>
    </div>
  );
}
