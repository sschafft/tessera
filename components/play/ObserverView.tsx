"use client";

import { useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import type { PlayState } from "./PlayContent";

export interface ObserverViewProps {
  state: PlayState;
}

export function ObserverView({ state }: ObserverViewProps) {
  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound state={state} />;
  }
  return (
    <section className="grid w-full" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr auto" }}>
      {state.observer_briefs && state.observer_briefs.length > 0 && (
        <div className="absolute right-6 top-20 z-20 flex flex-col gap-2">
          {state.observer_briefs.map((b) => (
            <BriefEnvelope
              key={b.role}
              role={b.role}
              title={b.title}
              rules={b.rules}
              defaultOpen
            />
          ))}
        </div>
      )}
      <div className="flex flex-col items-center justify-center border-r border-[var(--color-line)] p-6">
        <PaneHeader
          title="Builder"
          subtitle={`${state.placements.length} piece${state.placements.length === 1 ? "" : "s"} placed`}
          colorVar="orange"
        />
        <div className="mt-3">
          <PlayCanvas pieces={state.placements} />
        </div>
        <p className="t-mono mt-3 text-[11px] text-[var(--color-ink-3)]">
          live · updates every 2 seconds
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

      {state.available_pairs && state.available_pairs.length > 1 && (
        <div
          className="col-span-2 flex items-center gap-3 border-t border-[var(--color-line)] bg-white px-6 py-3"
        >
          <PairSwitcher state={state} />
        </div>
      )}
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

function WaitingForRound({ state }: { state: PlayState }) {
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
      {state.available_pairs && state.available_pairs.length > 1 && (
        <PairSwitcher state={state} />
      )}
    </section>
  );
}

function PairSwitcher({ state }: { state: PlayState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pairs = state.available_pairs ?? [];

  const switchTo = async (pairId: string) => {
    if (pairId === state.pair?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${state.code}/observe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pair_id: pairId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "switch failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="t-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-3)]">
        Other pairs
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {pairs.map((p) => {
          const active = p.id === state.pair?.id;
          const label =
            p.builder_name && p.guider_name
              ? `${p.builder_name} ↔ ${p.guider_name}`
              : "(empty)";
          return (
            <button
              key={p.id}
              type="button"
              disabled={busy || active}
              onClick={() => switchTo(p.id)}
              className="rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
              style={{
                borderColor: active ? "var(--color-ink)" : "var(--color-line)",
                background: active ? "var(--color-ink)" : "transparent",
                color: active ? "var(--color-paper)" : "var(--color-ink)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {error && (
        <span className="text-[11px] text-[var(--color-t-red)]">{error}</span>
      )}
    </div>
  );
}
