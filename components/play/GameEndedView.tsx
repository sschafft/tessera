"use client";

import { Tile } from "@/components/canvas/Tile";

export interface GameEndedViewProps {
  workshopName: string;
}

export function GameEndedView({ workshopName }: GameEndedViewProps) {
  return (
    <section className="m-auto flex max-w-[520px] flex-col items-center gap-4 px-6 text-center">
      <div className="relative" style={{ width: 110, height: 110 }}>
        <Tile kind="hex" color="yellow" x={0} y={5} size={100} rotate={-8} />
        <Tile kind="tri-up" color="red" x={20} y={-2} size={60} rotate={12} />
        <Tile kind="sq" color="green" x={70} y={70} size={40} rotate={6} />
      </div>
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        GAME OVER
      </div>
      <h1 className="t-display text-[36px]">Thanks for playing.</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]" style={{ lineHeight: 1.5 }}>
        <b>{workshopName}</b> is complete. Hop back on the call to debrief —
        what did the briefs reveal? Where did the picture diverge? What
        surprised you?
      </p>
    </section>
  );
}
