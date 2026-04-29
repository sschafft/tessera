"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * One-shot welcome toast surfaced when /play is loaded with
 * ?welcome=1 (set by JoinForm after a successful join). Confirms
 * the seat is saved on this device and points the player at the
 * home page as the cookie-based reconnect path. Non-blocking, fades
 * out after ~7s, dismissable.
 *
 * The recovery URL itself is stashed in localStorage by JoinForm —
 * this toast doesn't surface it to keep the welcome moment calm.
 * Players who actually need the cross-device URL can find it via
 * the home page's Resume Games pill (cookie-based, covers ~95% of
 * reconnects) or the GM can release a stuck seat from the lobby.
 */
export function WelcomeToast({ code }: { code: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const isWelcome = params.get("welcome") === "1";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isWelcome) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot welcome toast triggered by a query param the parent route owns; we surface state, then strip the param so a refresh doesn't replay.
    setVisible(true);
    // Strip the query param so a refresh / navigation doesn't replay
    // the toast.
    const url = `/g/${code}/play`;
    router.replace(url, { scroll: false });
    const id = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(id);
  }, [isWelcome, code, router]);

  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 items-start gap-3 rounded-[14px] px-4 py-3.5 shadow-md-soft"
      style={{
        background: "var(--color-tint-green)",
        border: "1.5px solid var(--color-t-green)",
        animation:
          "tessera-welcome-in 240ms ease-out both, tessera-welcome-out 320ms ease-in 6500ms forwards",
      }}
    >
      <span aria-hidden style={{ fontSize: 18 }}>
        ✓
      </span>
      <div className="flex-1 text-[13px]" style={{ color: "var(--color-t-green)", lineHeight: 1.45 }}>
        <b>You&apos;re in.</b>{" "}Your seat is saved on this device — close the
        tab and you&apos;ll see it on the home page&apos;s{" "}
        <i>Resume game</i> pill if you ever need to come back.
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="t-mono text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-t-green)" }}
      >
        ×
      </button>
      <style>{`
        @keyframes tessera-welcome-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes tessera-welcome-out {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, 8px); pointer-events: none; }
        }
      `}</style>
    </div>
  );
}
