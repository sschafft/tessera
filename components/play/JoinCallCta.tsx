"use client";

import { usableCallUrl } from "@/lib/util/url";

export interface JoinCallCtaProps {
  /**
   * Workshop-level "main room" link from game create. When a pair-
   * level breakout URL is also set, this demotes to a small secondary
   * link beneath the primary breakout CTA.
   */
  videoCallUrl: string | null;
  whiteboardUrl: string | null;
  /**
   * Per-pair breakout Meet URL (set by the GM via the Google
   * Calendar API path). When present, becomes the primary CTA and
   * is labelled as the pair's breakout — the workshop-level link
   * stays available as "main room" for cross-pair conversation.
   */
  breakoutCallUrl?: string | null;
  /** Larger primary style (default) on waiting screens; smaller for inline use. */
  size?: "lg" | "md";
}

/**
 * "Join the call" surface. Three modes, picked off the props:
 *   1. Pair breakout URL set → primary CTA points at the breakout,
 *      labelled as such; the workshop "main room" demotes to a
 *      smaller secondary link beneath.
 *   2. Only the workshop URL is set → single primary CTA, original
 *      behaviour.
 *   3. Neither → renders the whiteboard fallback (or null).
 */
export function JoinCallCta({
  videoCallUrl,
  whiteboardUrl,
  breakoutCallUrl,
  size = "lg",
}: JoinCallCtaProps) {
  const big = size === "lg";
  const breakout = usableCallUrl(breakoutCallUrl);
  const main = usableCallUrl(videoCallUrl);

  if (!breakout && !main) {
    if (whiteboardUrl) {
      return (
        <a
          href={whiteboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-mono text-[12px] underline"
          style={{ color: "var(--color-ink-3)" }}
        >
          Open the whiteboard ↗
        </a>
      );
    }
    return null;
  }

  // Pair-breakout mode: primary CTA = breakout, with main-room +
  // whiteboard demoted to small secondary links.
  if (breakout) {
    return (
      <div className="flex flex-col items-center gap-2.5">
        <a
          href={breakout}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 rounded-full font-semibold transition-transform"
          style={{
            background: "var(--color-t-blue)",
            color: "#fff",
            padding: big ? "16px 28px" : "12px 20px",
            fontSize: big ? 18 : 14,
            boxShadow:
              "0 4px 0 rgb(0 0 0 / 0.10), 0 10px 22px rgb(60 40 10 / 0.10)",
            textDecoration: "none",
          }}
        >
          <span
            aria-hidden="true"
            className="grid place-items-center rounded-full"
            style={{
              width: big ? 32 : 24,
              height: big ? 32 : 24,
              background: "rgba(255,255,255,0.22)",
              fontSize: big ? 16 : 12,
            }}
          >
            ▶
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span>Join your pair&apos;s call</span>
            <span
              className="t-mono text-[10px] font-normal"
              style={{ opacity: 0.85, letterSpacing: ".05em" }}
            >
              breakout · just you + your partner
            </span>
          </span>
        </a>
        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
          style={{ color: "var(--color-ink-3)" }}
        >
          {main && (
            <a
              href={main}
              target="_blank"
              rel="noopener noreferrer"
              className="t-mono text-[12px] underline"
            >
              ↗ Main room
            </a>
          )}
          {whiteboardUrl && (
            <a
              href={whiteboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="t-mono text-[12px] underline"
            >
              ↗ Whiteboard
            </a>
          )}
        </div>
      </div>
    );
  }

  // Workshop-only mode: original single-CTA behaviour.
  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={main!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 rounded-full font-semibold transition-transform"
        style={{
          background: "var(--color-t-blue)",
          color: "#fff",
          padding: big ? "16px 28px" : "12px 20px",
          fontSize: big ? 18 : 14,
          boxShadow: "0 4px 0 rgb(0 0 0 / 0.10), 0 10px 22px rgb(60 40 10 / 0.10)",
          textDecoration: "none",
        }}
      >
        <span
          aria-hidden="true"
          className="grid place-items-center rounded-full"
          style={{
            width: big ? 32 : 24,
            height: big ? 32 : 24,
            background: "rgba(255,255,255,0.22)",
            fontSize: big ? 16 : 12,
          }}
        >
          ▶
        </span>
        Join the video call
      </a>
      {whiteboardUrl && (
        <a
          href={whiteboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-mono text-[12px] underline"
          style={{ color: "var(--color-ink-3)" }}
        >
          (or open the whiteboard)
        </a>
      )}
    </div>
  );
}
