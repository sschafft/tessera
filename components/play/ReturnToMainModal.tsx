"use client";

import { useEffect, useState } from "react";
import { useGameEvents } from "@/lib/realtime/useGameEvents";

const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "127.0.0.1",
]);

function isUsableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return ![...PLACEHOLDER_HOSTS].some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

/**
 * Listens for the GM-fired `return_to_main` realtime event and
 * surfaces a modal asking the player to head back to the workshop's
 * main video room. The GM uses this when pairs have wandered into
 * their breakouts and they want to regroup. The modal is one-shot —
 * dismissable, doesn't auto-close, and doesn't re-pop on refetch.
 */
export function ReturnToMainModal({ gameId }: { gameId: string | null }) {
  const [active, setActive] = useState<{ url: string | null } | null>(null);

  // Track refetch (no-op) + per-event detail (the trigger).
  useGameEvents(gameId, noop, (detail) => {
    if (detail.kind !== "return_to_main") return;
    const raw = detail.payload?.video_call_url;
    const url = typeof raw === "string" ? raw : null;
    setActive({ url });
  });

  // Dismiss on Esc.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!active) return null;
  const usableUrl = isUsableUrl(active.url) ? active.url! : null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your facilitator wants you back in the main room"
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{
        background: "rgba(31,26,20,0.62)",
        animation: "tessera-overlay-fade 220ms ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setActive(null);
      }}
    >
      <div
        className="t-card flex w-full flex-col gap-4 p-6 text-center"
        style={{ background: "#fff", maxWidth: 440 }}
      >
        <span
          aria-hidden
          className="mx-auto grid h-12 w-12 place-items-center rounded-full"
          style={{
            background: "var(--color-tint-yellow)",
            color: "#7a5b00",
            fontSize: 22,
          }}
        >
          📣
        </span>
        <div className="flex flex-col gap-1.5">
          <span
            className="t-mono text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#7a5b00", letterSpacing: ".15em" }}
          >
            Facilitator says
          </span>
          <h2 className="t-display text-[22px] leading-tight">
            Come back to the main room.
          </h2>
          <p
            className="text-[13px]"
            style={{ color: "var(--color-ink-2)", lineHeight: 1.45 }}
          >
            Your facilitator wants the whole room together — head back to the
            workshop call so they can run the next move.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {usableUrl ? (
            <a
              href={usableUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setActive(null)}
              className="t-btn t-btn--primary"
            >
              Open the main room ↗
            </a>
          ) : (
            <p className="text-[12px] text-[var(--color-ink-3)]">
              No main-room link configured — head back to wherever your
              facilitator is.
            </p>
          )}
          <button
            type="button"
            onClick={() => setActive(null)}
            className="t-btn t-btn--ghost t-btn--sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function noop() {}
