"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";

export interface BreakoutsPanelProps {
  /** Total number of pairs allocated. */
  pairCount: number;
  /** Number of pairs that already have a breakout_call_url set. */
  withBreakouts: number;
  /** Server-confirmed: Clerk session has an active Google connection. */
  googleConnected: boolean;
  /** Mid-flight indicator from the parent (POST in flight). */
  busy: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

/**
 * GM-side surface for the per-pair Google Meet breakouts feature.
 * Renders as Step 4 in the master setup flow. Two lifecycle states:
 *
 *   - Google not connected → "Sign in with Google" CTA. Uses Clerk's
 *     `signIn.sso()` with the Google OAuth strategy. The
 *     `calendar.events` scope is configured once in the Clerk
 *     Dashboard (SSO Connections → Google → Additional OAuth scopes)
 *     so every sign-in inherits it without us having to pass it
 *     per-call. After consent, Clerk redirects through /sso-callback
 *     back to /master, and the next lobby poll flips
 *     `googleConnected` to true.
 *   - Connected → "Generate breakout calls" CTA, gated by a
 *     confirmation modal that explains the calendar-event side
 *     effect. Once links exist, "Clear breakouts" is available for
 *     re-shuffles.
 */
export function BreakoutsPanel({
  pairCount,
  withBreakouts,
  googleConnected,
  busy,
  onGenerate,
  onClear,
}: BreakoutsPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const missing = Math.max(0, pairCount - withBreakouts);
  const { signIn, fetchStatus } = useSignIn();

  const startSignIn = async () => {
    if (!signIn) return;
    await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectCallbackUrl: window.location.href,
    });
  };

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      {!googleConnected ? (
        <SignInState
          onSignIn={startSignIn}
          disabled={fetchStatus === "fetching"}
        />
      ) : (
        <ReadyState
          pairCount={pairCount}
          withBreakouts={withBreakouts}
          missing={missing}
          busy={busy}
          onGenerate={() => setConfirming(true)}
          onClear={onClear}
        />
      )}

      {confirming && (
        <ConfirmGenerateModal
          missing={missing}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onGenerate();
          }}
        />
      )}
    </div>
  );
}

function SignInState({
  onSignIn,
  disabled,
}: {
  onSignIn: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p
        className="text-[12px] leading-snug"
        style={{ color: "var(--color-ink-2)" }}
      >
        Optional. Sign in with Google so Tessera can mint a private
        Meet link per pair via the Calendar API. We only ask for the
        <span className="t-mono mx-1 rounded bg-[var(--color-paper-2)] px-1 py-0.5 text-[11px]">
          calendar.events
        </span>
        scope; you can revoke access anytime from your Clerk account
        settings or your Google account.
      </p>
      <button
        type="button"
        onClick={onSignIn}
        disabled={disabled}
        className="t-btn t-btn--primary t-btn--sm self-start disabled:opacity-50"
      >
        Sign in with Google →
      </button>
    </div>
  );
}

function ReadyState({
  pairCount,
  withBreakouts,
  missing,
  busy,
  onGenerate,
  onClear,
}: {
  pairCount: number;
  withBreakouts: number;
  missing: number;
  busy: boolean;
  onGenerate: () => void;
  onClear: () => void;
}) {
  const allReady = pairCount > 0 && missing === 0;
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ color: "var(--color-ink-2)" }}
      >
        {pairCount === 0 ? (
          <span style={{ color: "var(--color-ink-3)" }}>
            Allocate pairs above first — breakout calls are minted per
            pair.
          </span>
        ) : allReady ? (
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--color-t-green)" }}
          >
            <span aria-hidden>✓</span>
            <b>{withBreakouts} of {pairCount}</b> breakout calls ready.
          </span>
        ) : withBreakouts > 0 ? (
          <span>
            <b>{withBreakouts} of {pairCount}</b> ready · {missing} pair
            {missing === 1 ? "" : "s"} still need a link.
          </span>
        ) : (
          <span>
            {pairCount} pair{pairCount === 1 ? "" : "s"} allocated · no
            breakouts minted yet.
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {missing > 0 && pairCount > 0 && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="t-btn t-btn--primary t-btn--sm"
          >
            {busy
              ? "Working…"
              : withBreakouts > 0
                ? `Generate the missing ${missing} →`
                : `Generate breakout calls →`}
          </button>
        )}
        {withBreakouts > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="t-btn t-btn--ghost t-btn--sm"
            title="Delete every breakout calendar event and clear the per-pair links."
          >
            Clear breakouts
          </button>
        )}
      </div>
    </div>
  );
}


function ConfirmGenerateModal({
  missing,
  onCancel,
  onConfirm,
}: {
  missing: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm breakout call creation"
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: "rgba(31,26,20,0.62)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="t-card flex w-full flex-col gap-3 p-5"
        style={{ background: "#fff", maxWidth: 480 }}
      >
        <div
          className="t-mono text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "var(--color-t-purple)", letterSpacing: ".15em" }}
        >
          Heads up — this touches your Google Calendar
        </div>
        <h3
          className="t-display text-[20px] leading-tight"
          style={{ color: "var(--color-ink)" }}
        >
          Create {missing} breakout call{missing === 1 ? "" : "s"} on
          your calendar?
        </h3>
        <ul
          className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]"
          style={{ color: "var(--color-ink-2)", lineHeight: 1.45 }}
        >
          <li>
            · Tessera creates <b>one short calendar event per pair</b>{" "}
            on your primary Google Calendar.
          </li>
          <li>
            · Each event is anchored <b>1 hour in the past, 5 minutes
            long</b>, so it doesn&apos;t pollute your upcoming agenda or
            send invitations.
          </li>
          <li>
            · Visibility is set to <b>private</b> — only you can see them.
            Each event has a Google Meet link auto-attached, which
            becomes the pair&apos;s breakout call.
          </li>
          <li>
            · When you end the game, Tessera <b>deletes every event
            automatically</b> and revokes its Google access.
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="t-btn t-btn--primary"
            autoFocus
          >
            Create {missing} breakout call{missing === 1 ? "" : "s"} →
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="t-btn t-btn--ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export interface BreakoutsCleanupModalProps {
  /** True while DELETE requests are firing, false once /end resolves. */
  active: boolean;
  /** Total breakouts at start of cleanup. */
  total: number;
  /** Successfully deleted so far (final count from /end response). */
  deleted: number;
  /** Warning string from /end (e.g. "google_session_lost") — surfaced
   *  but doesn't block the modal from closing. */
  warning: string | null;
}

/**
 * Modal that pops up while the /end route is running its calendar
 * cleanup. The /end POST blocks until cleanup finishes, so this is
 * mostly a "we're working on it" state — but a visible one, since
 * the user explicitly asked for the calendar wipe to be observable.
 */
export function BreakoutsCleanupModal({
  active,
  total,
  deleted,
  warning,
}: BreakoutsCleanupModalProps) {
  if (!active && total === 0) return null;
  const done = !active && deleted >= 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cleaning up breakout calendar events"
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: "rgba(31,26,20,0.62)" }}
    >
      <div
        className="t-card flex w-full flex-col gap-3 p-5 text-center"
        style={{ background: "#fff", maxWidth: 420 }}
      >
        <div
          className="t-mono mx-auto text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "var(--color-t-purple)", letterSpacing: ".15em" }}
        >
          {active ? "Cleaning up…" : done ? "Calendar cleaned" : ""}
        </div>
        <h3
          className="t-display text-[20px] leading-tight"
          style={{ color: "var(--color-ink)" }}
        >
          {active
            ? `Deleting ${total} breakout calendar event${total === 1 ? "" : "s"}…`
            : warning
              ? `${deleted} of ${total} events deleted`
              : `Done — ${total} event${total === 1 ? "" : "s"} removed from your calendar.`}
        </h3>
        <p
          className="text-[13px] leading-snug"
          style={{ color: "var(--color-ink-2)" }}
        >
          {active
            ? "Tessera is deleting every breakout calendar event we created for this game and revoking its Google access on your behalf."
            : warning === "google_session_lost"
              ? "Your Google session expired before we finished. The remaining events are still on your calendar — search for \"Tessera breakout\" to remove them."
              : warning
                ? "Some events couldn't be deleted automatically. Search your calendar for \"Tessera breakout\" to clean up any leftovers."
                : "Per-pair breakout links are gone, the calendar events are deleted, and Tessera no longer has access to your Google account."}
        </p>
      </div>
    </div>
  );
}
