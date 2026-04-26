import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import type { PlayState } from "./PlayContent";

export interface BuilderViewProps {
  state: PlayState;
}

/**
 * Builder canvas — empty board until milestone 3.2 wires up drag/drop.
 * The tile tray + colour palette already render so the GM can see what
 * the layout will look like, but interaction is a no-op for now.
 */
export function BuilderView({ state }: BuilderViewProps) {
  if (!state.round || state.round.status !== "running") {
    return <WaitingForRound />;
  }
  return (
    <div className="grid w-full" style={{ gridTemplateColumns: "280px 1fr" }}>
      <aside className="flex flex-col gap-5 border-r border-[var(--color-line)] bg-[var(--color-paper-2)] p-5">
        <Tray />
        <ColorPalette />
        <Tools />
      </aside>
      <section className="flex items-center justify-center overflow-hidden p-6">
        <div className="flex flex-col items-center gap-3">
          <PlayCanvas pieces={[]} />
          <p className="t-mono text-[11px] text-[var(--color-ink-3)]">
            empty canvas · drag-and-drop lands in the next milestone
          </p>
        </div>
      </section>
    </div>
  );
}

function Tray() {
  const samples: { kind: "tri-up" | "sq" | "hex" | "rhomb" | "trap"; color: string }[] = [
    { kind: "tri-up", color: "red" },
    { kind: "sq", color: "yellow" },
    { kind: "hex", color: "green" },
    { kind: "rhomb", color: "orange" },
    { kind: "trap", color: "purple" },
    { kind: "tri-up", color: "blue" },
  ];
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Tray · pieces
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {samples.map((s, i) => (
          <div
            key={i}
            className="t-card relative grid place-items-center"
            style={{ aspectRatio: "1", padding: 8, opacity: 0.55, cursor: "not-allowed" }}
          >
            <span className="t-mono text-[9px] text-[var(--color-ink-3)]">
              {s.kind}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorPalette() {
  const colors = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "teal"];
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Colour palette
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {colors.map((c) => (
          <div
            key={c}
            className="rounded-[10px] border-2 border-white shadow-md-soft"
            style={{
              aspectRatio: "1",
              background: `var(--color-t-${c})`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Tools() {
  const tools = [
    { icon: "↺", label: "Rotate", k: "R" },
    { icon: "⤢", label: "Resize", k: "S" },
    { icon: "⌫", label: "Remove", k: "⌫" },
    { icon: "⎌", label: "Undo", k: "⌘Z" },
  ];
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Tools
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            disabled
            className="flex items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2 text-left text-[13px] font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            <span className="w-5 text-center text-[16px]">{t.icon}</span>
            <span className="flex-1">{t.label}</span>
            <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
              {t.k}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WaitingForRound() {
  return (
    <section className="m-auto flex max-w-[480px] flex-col items-center gap-3 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        BUILDER
      </div>
      <h1 className="t-display text-3xl">Waiting for the round to start</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        Your guider has the goal. As soon as the facilitator hits Start, your
        canvas comes alive.
      </p>
    </section>
  );
}
