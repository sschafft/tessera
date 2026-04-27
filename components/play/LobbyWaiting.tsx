import { JoinCallCta } from "./JoinCallCta";

export interface LobbyWaitingProps {
  workshopName: string;
  videoCallUrl: string;
  whiteboardUrl: string | null;
  /** Whether a round is currently in flight without this player. */
  roundInFlight?: boolean;
}

export function LobbyWaiting({
  workshopName,
  videoCallUrl,
  whiteboardUrl,
  roundInFlight = false,
}: LobbyWaitingProps) {
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-5 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        {roundInFlight ? "ROUND ALREADY IN FLIGHT" : "WAITING IN THE LOBBY"}
      </div>
      <h1 className="t-display text-3xl">{workshopName}</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        {roundInFlight ? (
          <>
            A round is already underway. Hop on the call — your facilitator
            will pull you in for the next one.
          </>
        ) : (
          <>
            Your facilitator will assign you a role any moment.
            <br />
            Hop on the call so you&apos;re ready when the round starts.
          </>
        )}
      </p>
      <JoinCallCta
        videoCallUrl={videoCallUrl}
        whiteboardUrl={whiteboardUrl}
      />
    </section>
  );
}
