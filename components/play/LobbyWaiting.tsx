import { JoinCallCta } from "./JoinCallCta";

export interface LobbyWaitingProps {
  workshopName: string;
  videoCallUrl: string | null;
  whiteboardUrl: string | null;
  /** Per-pair breakout link, when one has been minted. */
  breakoutCallUrl?: string | null;
  /** Whether a round is currently in flight without this player. */
  roundInFlight?: boolean;
}

export function LobbyWaiting({
  workshopName,
  videoCallUrl,
  whiteboardUrl,
  breakoutCallUrl,
  roundInFlight = false,
}: LobbyWaitingProps) {
  const hasCall = Boolean(breakoutCallUrl || videoCallUrl);
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-5 px-6 text-center">
      <LiveStatusBadge
        label={roundInFlight ? "ROUND IN FLIGHT" : "YOU'RE IN · WAITING"}
      />
      <h1 className="t-display text-3xl">{workshopName}</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        {roundInFlight ? (
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
            yourself — your partner is probably joining too.
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
