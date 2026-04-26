import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import type { PlayState } from "./PlayContent";

export interface ObserverViewProps {
  state: PlayState;
}

export function ObserverView({ state }: ObserverViewProps) {
  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound />;
  }
  return (
    <section className="grid w-full" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="flex flex-col items-center justify-center border-r border-[var(--color-line)] p-6">
        <PaneHeader title="Builder" subtitle="placing pieces" colorVar="orange" />
        <div className="mt-3">
          <PlayCanvas pieces={[]} />
        </div>
        <p className="t-mono mt-3 text-[11px] text-[var(--color-ink-3)]">
          live placement view lands in 3.2
        </p>
      </div>
      <div className="flex flex-col items-center justify-center p-6">
        <PaneHeader title="Goal" subtitle="what they're aiming for" colorVar="blue" />
        <div className="relative mt-3">
          <span
            className="t-stamp absolute -left-2 -top-4 z-10"
            style={{
              color: "var(--color-t-red)",
              background: "#fffaf0",
              padding: "5px 12px",
            }}
          >
            ● THE GOAL
          </span>
          <PlayCanvas pieces={state.goal} />
        </div>
      </div>
    </section>
  );
}

function PaneHeader({
  title,
  subtitle,
  colorVar,
}: {
  title: string;
  subtitle: string;
  colorVar: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: `var(--color-t-${colorVar})` }}
      />
      <span className="text-[13px] font-bold">{title}</span>
      <span className="text-[12px] text-[var(--color-ink-3)]">· {subtitle}</span>
    </div>
  );
}

function WaitingForRound() {
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-3 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        OBSERVER
      </div>
      <h1 className="t-display text-3xl">Waiting for the round to start</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        Once the facilitator hits Start, you&apos;ll see your pair&apos;s
        builder canvas alongside the goal.
      </p>
    </section>
  );
}
