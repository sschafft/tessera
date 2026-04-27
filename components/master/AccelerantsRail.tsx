"use client";

import { useState } from "react";
import {
  POLICIES,
  countPriorEvents,
  type AccelerantKind,
} from "@/lib/accelerants/policy";
import type { AccelerantEvent, LobbyPair } from "./MasterContent";

interface RailButtonSpec {
  kind: AccelerantKind;
  icon: string;
  color: TintColor;
  title: string;
  sub: string;
}

type TintColor = "blue" | "purple" | "green" | "orange" | "red" | "teal";

const BUTTONS: RailButtonSpec[] = [
  {
    kind: "prototype",
    icon: "🔮",
    color: "blue",
    title: "Prototype unlock",
    sub: "Show builder a 5-second glimpse of the goal.",
  },
  {
    kind: "reveal_briefs",
    icon: "📖",
    color: "purple",
    title: "Reveal briefs",
    sub: "Both players see each other's hidden brief.",
  },
  {
    kind: "test_build",
    icon: "✓",
    color: "green",
    title: "Test build",
    sub: "Auto-check % accuracy against goal.",
  },
  {
    kind: "agile_share",
    icon: "↻",
    color: "orange",
    title: "Agile share",
    sub: "Surface 3 builder previews to the guider.",
  },
  {
    kind: "time_pressure",
    icon: "⏱",
    color: "red",
    title: "Time pressure",
    sub: "−3:00 from the round timer.",
  },
  {
    kind: "vocab_swap",
    icon: "✦",
    color: "teal",
    title: "Vocab swap",
    sub: "Force the guider's brief to a new constraint.",
  },
  {
    kind: "randomizer",
    icon: "🎲",
    color: "orange",
    title: "Randomizer",
    sub: "Reset the pair's goal pattern.",
  },
  {
    kind: "requirement_change",
    icon: "✎",
    color: "blue",
    title: "Requirement change",
    sub: "Mutate one element in the goal pattern.",
  },
];

export interface AccelerantsRailProps {
  events: AccelerantEvent[];
  roundRunning: boolean;
  focusedPair: LobbyPair | null;
  busy: boolean;
  onTrigger: (
    kind: string,
    scope: "pair" | "all",
    pairId: string | null,
    payload?: Record<string, unknown>,
  ) => void;
}

export function AccelerantsRail({
  events,
  roundRunning,
  focusedPair,
  busy,
  onTrigger,
}: AccelerantsRailProps) {
  const [scope, setScope] = useState<"pair" | "all">("pair");

  const focusedName = focusedPair ? "this pair" : "—";
  const segmentOptions = [
    { value: "pair" as const, label: focusedName },
    { value: "all" as const, label: "All pairs" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-line)] px-5 pb-3 pt-5">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-md text-[14px] font-extrabold text-white"
            style={{ background: "var(--color-t-red)" }}
          >
            ⚡
          </span>
          <span className="t-display text-[14px] font-bold">Super powers</span>
        </div>
        <p className="text-[12px] leading-tight text-[var(--color-ink-3)]">
          Trigger mechanics on a pair (or all pairs) to nudge them past stuck
          moments.
        </p>
        <div
          className="mt-2.5 flex gap-0.5 rounded-[14px] bg-[var(--color-paper-2)] p-1"
          role="radiogroup"
        >
          {segmentOptions.map((o) => {
            const active = scope === o.value;
            const disabled = o.value === "pair" && !focusedPair;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => setScope(o.value)}
                className="flex-1 cursor-pointer border-none px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50"
                style={{
                  background: active ? "#fff" : "transparent",
                  borderRadius: "calc(var(--radius-md) - 4px)",
                  color: active ? "var(--color-ink)" : "var(--color-ink-3)",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5">
        {!roundRunning && (
          <p className="px-2 py-2 text-[12px] text-[var(--color-ink-3)]">
            Start the round and these light up.
          </p>
        )}
        {BUTTONS.map((b) => (
          <RailButton
            key={b.kind}
            spec={b}
            events={events}
            scope={scope}
            focusedPairId={focusedPair?.id ?? null}
            disabled={
              !roundRunning ||
              busy ||
              (scope === "pair" && !focusedPair) ||
              !POLICIES[b.kind].implemented
            }
            onTrigger={onTrigger}
          />
        ))}
      </div>
    </div>
  );
}

function RailButton({
  spec,
  events,
  scope,
  focusedPairId,
  disabled,
  onTrigger,
}: {
  spec: RailButtonSpec;
  events: AccelerantEvent[];
  scope: "pair" | "all";
  focusedPairId: string | null;
  disabled: boolean;
  onTrigger: (
    kind: string,
    scope: "pair" | "all",
    pairId: string | null,
    payload?: Record<string, unknown>,
  ) => void;
}) {
  const policy = POLICIES[spec.kind];
  const counts = countPriorEvents(
    events as { kind: AccelerantKind; scope: "pair" | "all"; pair_id: string | null; triggered_at: string }[],
    spec.kind,
    focusedPairId,
  );
  const usedForScope =
    scope === "pair" ? counts.perPair + counts.perAll : counts.perAll;
  const cap = policy.maxPerRound;
  const usageLabel = cap === null ? `${usedForScope} / ∞` : `${usedForScope} / ${cap}`;
  const reachedCap = cap !== null && usedForScope >= cap;
  const notImplemented = !policy.implemented;
  const finalDisabled = disabled || reachedCap;

  return (
    <button
      type="button"
      onClick={() =>
        onTrigger(
          spec.kind,
          scope,
          scope === "pair" ? focusedPairId : null,
        )
      }
      disabled={finalDisabled}
      className="relative flex w-full cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] bg-white p-3.5 text-left transition-transform disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: "var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.08)",
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-[38px] w-[38px] flex-shrink-0 place-items-center rounded-[10px] text-[18px]"
        style={{
          background: `var(--color-tint-${spec.color})`,
          color: `var(--color-t-${spec.color})`,
          boxShadow: `inset 0 0 0 1.5px var(--color-t-${spec.color})`,
        }}
      >
        {spec.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="mb-0.5 flex items-center justify-between">
          <span className="text-[14px] font-bold">{spec.title}</span>
          <span className="t-mono text-[10px] opacity-70">{usageLabel}</span>
        </span>
        <span
          className="block text-[12px] leading-tight"
          style={{ color: "var(--color-ink-3)" }}
        >
          {spec.sub}
        </span>
        {notImplemented && (
          <span
            className="t-mono mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px]"
            style={{
              background: "var(--color-paper-2)",
              color: "var(--color-ink-3)",
            }}
          >
            soon
          </span>
        )}
      </span>
    </button>
  );
}
