import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import type { PlayState } from "./PlayContent";

export interface GuiderViewProps {
  state: PlayState;
}

export function GuiderView({ state }: GuiderViewProps) {
  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound />;
  }
  return (
    <section className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="relative">
        <span
          className="t-stamp absolute -left-2 -top-4 z-10"
          style={{
            color: "var(--color-t-red)",
            background: "#fffaf0",
            padding: "5px 12px",
          }}
        >
          ● THE GOAL · only you see this
        </span>
        <PlayCanvas pieces={state.goal} />
      </div>
      <p
        className="t-mono max-w-[520px] text-center text-[12px] text-[var(--color-ink-3)]"
        style={{ lineHeight: 1.5 }}
      >
        Talk through the picture on your call. Your builder is rebuilding it
        without seeing this.
      </p>
    </section>
  );
}

function WaitingForRound() {
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-3 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        GUIDER
      </div>
      <h1 className="t-display text-3xl">Waiting for the round to start</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        You&apos;ll see the goal pattern as soon as the facilitator hits Start.
      </p>
    </section>
  );
}
