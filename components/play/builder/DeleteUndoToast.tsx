"use client";

import { useEffect, useState } from "react";

export interface DeleteUndoToastProps {
  /**
   * Wallclock ms when the deletion will commit. Toast renders a
   * countdown bar that drains from `expiresAt - durationMs` to
   * `expiresAt`. Becomes null when there's nothing pending.
   */
  expiresAt: number | null;
  /** Total countdown window in ms — drives the bar fill ratio. */
  durationMs: number;
  /** Short label, e.g. "Piece removed". */
  label: string;
  onUndo: () => void;
}

/**
 * Bottom-anchored undo affordance for destructive actions. Pairs
 * with deferred-delete: the action is held in-memory for the
 * duration window, and only flushed to the server if the user
 * doesn't click Undo. Drains a thin bar so the window is visible
 * (uncertainty avoidance — the user knows how much time is left).
 *
 * Esc also undoes — same chord as cancel-target elsewhere in the
 * builder, so the keypress is muscle-memory consistent.
 */
export function DeleteUndoToast({
  expiresAt,
  durationMs,
  label,
  onUndo,
}: DeleteUndoToastProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (expiresAt == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expiresAt, onUndo]);

  if (expiresAt == null) return null;
  const remainingMs = Math.max(0, expiresAt - now);
  const ratio = Math.min(1, Math.max(0, remainingMs / durationMs));
  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <div
        className="t-card pointer-events-auto flex flex-col gap-1.5 px-4 pb-2.5 pt-3"
        style={{
          background: "var(--color-ink)",
          color: "#fff",
          minWidth: 280,
          boxShadow: "0 6px 16px rgba(0,0,0,.18)",
          animation: "tessera-toast-in 200ms ease-out",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold">
            {label}
            <span
              className="t-mono ml-2 text-[11px] font-normal opacity-70"
              aria-hidden="true"
            >
              · {remainingSec}s
            </span>
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="t-mono rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: "var(--color-t-yellow)",
              color: "var(--color-ink)",
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,.18)",
            }}
          >
            ↶ Undo
          </button>
        </div>
        <div
          aria-hidden="true"
          style={{
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,.18)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${ratio * 100}%`,
              background: "var(--color-t-yellow)",
              transition: "width 100ms linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}
