import { usableCallUrl } from "@/lib/util/url";
import { JoinCallCta } from "./JoinCallCta";

export interface LobbyWaitingProps {
  workshopName: string;
  videoCallUrl: string | null;
  whiteboardUrl: string | null;
  /** Per-pair breakout link, when one has been minted. */
  breakoutCallUrl?: string | null;
  /** Whether a round is currently in flight without this player. */
  roundInFlight?: boolean;
  /**
   * Rounds left AFTER the currently running one wraps. Drives the
   * roundInFlight copy: > 0 ⇒ "you'll be seated in the next one";
   * 0 ⇒ "this is the last round, you'll join the debrief instead",
   * so single-round late-joiners aren't promised a next round that
   * doesn't exist. Falls back to ≥1 when unknown to preserve
   * pre-fix wording.
   */
  roundsRemainingAfterCurrent?: number;
}

export function LobbyWaiting({
  workshopName,
  videoCallUrl,
  whiteboardUrl,
  breakoutCallUrl,
  roundInFlight = false,
  roundsRemainingAfterCurrent = 1,
}: LobbyWaitingProps) {
  const hasCall = Boolean(
    usableCallUrl(breakoutCallUrl) || usableCallUrl(videoCallUrl),
  );
  const noNextRound = roundInFlight && roundsRemainingAfterCurrent <= 0;
  let label: string;
  if (noNextRound) {
    label = "WAITING FOR DEBRIEF";
  } else if (roundInFlight) {
    label = "ROUND IN FLIGHT";
  } else {
    label = "YOU'RE IN · WAITING";
  }
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-5 px-6 text-center">
      <LiveStatusBadge label={label} />
      <h1 className="t-display text-3xl">{workshopName}</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        {noNextRound ? (
          hasCall ? (
            <>
              This workshop&apos;s last round is already running. Hop on
              the call now — you&apos;ll join the group when the round
              wraps and the debrief begins.
            </>
          ) : (
            <>
              This workshop&apos;s last round is already running.
              You&apos;ll join the group when the round wraps and the
              debrief begins.
            </>
          )
        ) : roundInFlight ? (
          hasCall ? (
            <>
              A round&apos;s already running. Hop on the call now —
              your facilitator will seat you in the next one.
            </>
          ) : (
            <>
              A round&apos;s already running. Your facilitator will seat
              you in the next one.
            </>
          )
        ) : hasCall ? (
          <>
            You&apos;re seated. The facilitator will pair you up and the
            screen will flip into your role on its own — no need to refresh.
            <br />
            <b>While you wait:</b> hop on the call below and introduce
            yourself — everyone else is probably joining too.
          </>
        ) : (
          <>
            You&apos;re seated. The facilitator will pair you up and the
            screen will flip into your role on its own — no need to refresh.
          </>
        )}
      </p>
      <JoinCallCta
        videoCallUrl={videoCallUrl}
        whiteboardUrl={whiteboardUrl}
        breakoutCallUrl={breakoutCallUrl ?? null}
      />
    </section>
  );
}

function LiveStatusBadge({ label }: { label: string }) {
  return (
    <div className="t-mono inline-flex items-center gap-2 text-[11px] tracking-widest text-[var(--color-ink-3)]">
      <span className="relative inline-flex h-2 w-2" aria-hidden="true">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: "var(--color-t-green)" }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: "var(--color-t-green)" }}
        />
      </span>
      {label}
    </div>
  );
}
