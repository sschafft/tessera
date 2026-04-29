"use client";

import { JoinCallCta } from "../JoinCallCta";
import type { PlayState } from "../PlayContent";

/**
 * Pre-round screen shown to the builder once they've been paired but
 * the GM hasn't started the round yet. Encourages them to hop on the
 * call (so the round doesn't open in dead air) and shows a "guider
 * ready" chip if their partner has joined.
 */
export function WaitingForRound({ state }: { state: PlayState }) {
  const partnerName = state.partner?.display_name;
  return (
    <section className="m-auto flex max-w-[520px] flex-col items-center gap-5 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        BUILDER · READY
      </div>
      <h1 className="t-display text-3xl">Hop on the call.</h1>
      {partnerName ? (
        <PartnerReadyChip name={partnerName} role="guider" />
      ) : null}
      <p className="text-[15px] text-[var(--color-ink-2)]">
        {partnerName
          ? `${partnerName} can see the goal pattern. As soon as the facilitator hits Start, your canvas + brief unlock and you'll be rebuilding from their descriptions.`
          : "Your guider has the goal pattern. As soon as the facilitator hits Start, your canvas comes alive — and you'll need the call open to hear the descriptions."}
      </p>
      <JoinCallCta
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
    </section>
  );
}

export function PartnerReadyChip({
  name,
  role,
}: {
  name: string;
  role: "builder" | "guider";
}) {
  return (
    <div
      className="t-mono flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
      style={{
        background: "var(--color-tint-green)",
        color: "var(--color-t-green)",
        boxShadow: "inset 0 0 0 1.5px var(--color-t-green)",
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: "var(--color-t-green)",
          animation: "tessera-pulse-dot 1400ms ease-in-out infinite",
        }}
      />
      <span>
        {name} <span style={{ opacity: 0.7 }}>· {role} ready</span>
      </span>
      <style>{`
        @keyframes tessera-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
