"use client";

import { useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { JoinCallCta } from "./JoinCallCta";
import type { PlayState } from "./PlayContent";

export interface ObserverViewProps {
  state: PlayState;
}

export function ObserverView({ state }: ObserverViewProps) {
  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound state={state} />;
  }
  const showCoords = (state.round.complexity ?? 5) <= 4;
  const briefs = state.observer_briefs ?? [];
  return (
    <section className="flex w-full flex-col">
      {briefs.length > 0 && (
        // Inline strip of brief seals at the top of the observer view.
        // Earlier this was an absolute-positioned 320px column at
        // right-6 — that overflowed the viewport at 1024px wide,
        // clipping text and pushing the close button off-screen.
        // Inline + minimised by default keeps the goal/builder canvases
        // unobstructed; click a seal to expand the card.
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-[var(--color-line)] bg-white px-4 py-3">
          <span className="t-mono mr-auto text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
            Pair briefs
          </span>
          {briefs.map((b) => (
            <BriefEnvelope
              key={b.role}
              role={b.role}
              title={b.title}
              rules={b.rules}
            />
          ))}
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {/* Builder + goal panes stack vertically below ~960px so the
            full goal canvas stays readable on a 768px / 1024px laptop
            sidebar. Above 960px we go side-by-side. The previous
            grid-template-columns: 1fr 1fr clipped ~33% of the goal
            canvas at 768px because each pane couldn't shrink below
            its canvas's intrinsic width (≈432px at c=5 + paddings). */}
        <div className="flex flex-1 flex-wrap">
          <div className="flex min-w-[320px] flex-1 flex-col items-center justify-center overflow-x-auto border-r border-[var(--color-line)] p-6">
            <PaneHeader
              title="Builder"
              subtitle={`${state.placements.length} piece${state.placements.length === 1 ? "" : "s"} placed`}
              colorVar="orange"
            />
            <div className="mt-3">
              <PlayCanvas
                pieces={state.placements}
                complexity={state.round.complexity}
                showCoords={showCoords}
              />
            </div>
            <p className="t-mono mt-3 text-[11px] text-[var(--color-ink-3)]">
              live · updates every 2 seconds
            </p>
          </div>
          <div className="flex min-w-[320px] flex-1 flex-col items-center justify-center overflow-x-auto p-6">
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
              <PlayCanvas
                pieces={state.goal}
                complexity={state.round.complexity}
                showCoords={showCoords}
              />
            </div>
          </div>
        </div>

        {state.available_pairs && state.available_pairs.length > 1 && (
          <div className="flex items-center gap-3 border-t border-[var(--color-line)] bg-white px-6 py-3">
            <PairSwitcher state={state} />
          </div>
        )}
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

function WaitingForRound({ state }: { state: PlayState }) {
  const myPair = state.pair?.id
    ? state.available_pairs?.find((p) => p.id === state.pair?.id)
    : null;
  const pairLabel =
    myPair && myPair.builder_name && myPair.guider_name
      ? `${myPair.builder_name} ↔ ${myPair.guider_name}`
      : null;
  return (
    <section className="m-auto flex max-w-[520px] flex-col items-center gap-5 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        OBSERVER · READY
      </div>
      <h1 className="t-display text-3xl">Hop on the call.</h1>
      {pairLabel && (
        <div
          className="t-mono flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
          style={{
            background: "var(--color-tint-blue)",
            color: "var(--color-t-blue)",
            boxShadow: "inset 0 0 0 1.5px var(--color-t-blue)",
          }}
        >
          <span aria-hidden="true">👁</span>
          <span>watching {pairLabel}</span>
        </div>
      )}
      <p className="text-[15px] text-[var(--color-ink-2)]">
        {pairLabel
          ? `When the facilitator hits Start, the builder + goal canvases for ${pairLabel} appear here. Switch between pairs from the strip below.`
          : "Once the facilitator hits Start, you'll see your pair's builder canvas alongside the goal — and overhear the conversation that drives it on the call."}
      </p>
      <JoinCallCta
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
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
