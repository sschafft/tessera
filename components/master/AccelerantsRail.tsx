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
    kind: "change_builder_brief",
    icon: "✦",
    color: "orange",
    title: "Change builder brief",
    sub: "Re-roll the builder's hidden constraint.",
  },
  {
    kind: "vocab_swap",
    icon: "✦",
    color: "teal",
    title: "Change guider brief",
    sub: "Re-roll the guider's hidden constraint.",
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
  {
    kind: "harder",
    icon: "▲",
    color: "red",
    title: "Make it harder",
    sub: "Re-roll the goal at +1 complexity.",
  },
  {
    kind: "easier",
    icon: "▼",
    color: "green",
    title: "Make it easier",
    sub: "Re-roll the goal at −1 complexity.",
  },
];

export interface AccelerantsRailProps {
  events: AccelerantEvent[];
  roundRunning: boolean;
  focusedPair: LobbyPair | null;
  busy: boolean;
  scoring: { correct_pts: number; wrong_pts: number };
  onTrigger: (
    kind: string,
    scope: "pair" | "all",
    pairId: string | null,
    payload?: Record<string, unknown>,
  ) => void;
  onScoring: (patch: { correct_pts?: number; wrong_pts?: number }) => void;
}

export function AccelerantsRail({
  events,
  roundRunning,
  focusedPair,
  busy,
  scoring,
  onTrigger,
  onScoring,
}: AccelerantsRailProps) {
  const [scope, setScope] = useState<"pair" | "all">("pair");
  const [prototypeSec, setPrototypeSec] = useState(5);

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
        <ScoringPanel
          correctPts={scoring.correct_pts}
          wrongPts={scoring.wrong_pts}
          busy={busy}
          onChange={onScoring}
        />
        {!roundRunning && (
          <p className="px-2 py-2 text-[12px] text-[var(--color-ink-3)]">
            {/* Copy adapts to lifecycle: pre-round vs post-round. */}
            Super powers light up while a round is in flight.
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
            payload={
              b.kind === "prototype"
                ? { duration_seconds: prototypeSec }
                : undefined
            }
            extra={
              b.kind === "prototype" ? (
                <PrototypeDurationControl
                  seconds={prototypeSec}
                  onChange={setPrototypeSec}
                />
              ) : null
            }
            onTrigger={onTrigger}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Game-wide scoring config tile. Lets the GM bump the +/per-correct
 * value and toggle the flat wrong-attempts penalty (0 = off, -1 = on).
 * Sits at the top of the super-powers panel so it's always visible.
 */
function ScoringPanel({
  correctPts,
  wrongPts,
  busy,
  onChange,
}: {
  correctPts: number;
  wrongPts: number;
  busy: boolean;
  onChange: (patch: { correct_pts?: number; wrong_pts?: number }) => void;
}) {
  const bumpCorrect = (delta: number) => {
    const next = Math.max(1, Math.min(100, correctPts + delta));
    if (next !== correctPts) onChange({ correct_pts: next });
  };
  const bumpWrong = (delta: number) => {
    const next = Math.max(-10, Math.min(0, wrongPts + delta));
    if (next !== wrongPts) onChange({ wrong_pts: next });
  };
  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] bg-white p-3.5"
      style={{
        border: "1.5px solid var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.06)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-[38px] w-[38px] flex-shrink-0 place-items-center rounded-[10px] text-[18px]"
          style={{
            background: "var(--color-tint-yellow)",
            color: "var(--color-t-yellow)",
            boxShadow: "inset 0 0 0 1.5px var(--color-t-yellow)",
          }}
        >
          ★
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-bold">Scoring</span>
          <span
            className="block text-[12px] leading-tight"
            style={{ color: "var(--color-ink-3)" }}
          >
            Tune the points awarded per correct piece, or punish wrong
            attempts with a flat penalty.
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">
          Per correct
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bumpCorrect(-1)}
            disabled={busy || correctPts <= 1}
            className="t-mono grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[12px] font-bold disabled:opacity-50"
            aria-label="Decrease points per correct"
          >
            −
          </button>
          <span
            className="t-mono w-8 text-center text-[13px] font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            {correctPts}
          </span>
          <button
            type="button"
            onClick={() => bumpCorrect(+1)}
            disabled={busy || correctPts >= 100}
            className="t-mono grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[12px] font-bold disabled:opacity-50"
            aria-label="Increase points per correct"
          >
            +
          </button>
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-2"
        title="Flat penalty applied if any placement is wrong on a Test."
      >
        <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">
          Wrong-attempt penalty
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bumpWrong(-1)}
            disabled={busy || wrongPts <= -10}
            className="t-mono grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[12px] font-bold disabled:opacity-50"
            aria-label="Increase penalty (more negative)"
          >
            −
          </button>
          <span
            className="t-mono w-10 text-center text-[13px] font-bold"
            style={{
              color: wrongPts < 0 ? "var(--color-t-red)" : "var(--color-ink-3)",
            }}
          >
            {wrongPts === 0 ? "off" : wrongPts}
          </span>
          <button
            type="button"
            onClick={() => bumpWrong(+1)}
            disabled={busy || wrongPts >= 0}
            className="t-mono grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[12px] font-bold disabled:opacity-50"
            aria-label="Decrease penalty (toward 0)"
          >
            +
          </button>
        </div>
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
  payload,
  extra,
  onTrigger,
}: {
  spec: RailButtonSpec;
  events: AccelerantEvent[];
  scope: "pair" | "all";
  focusedPairId: string | null;
  disabled: boolean;
  /** Optional payload merged into the trigger call (e.g. duration_seconds). */
  payload?: Record<string, unknown>;
  /** Optional inline control rendered below the spec body (e.g. duration knob). */
  extra?: React.ReactNode;
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
    <div
      className="relative flex w-full flex-col gap-2 rounded-[14px] border-[1.5px] bg-white p-3.5"
      style={{
        borderColor: "var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.08)",
        opacity: finalDisabled ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        onClick={() =>
          onTrigger(
            spec.kind,
            scope,
            scope === "pair" ? focusedPairId : null,
            payload,
          )
        }
        disabled={finalDisabled}
        className="flex w-full cursor-pointer items-start gap-3 text-left disabled:cursor-not-allowed"
        style={{ background: "transparent", border: "none", padding: 0 }}
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
      {extra && <div>{extra}</div>}
    </div>
  );
}

function PrototypeDurationControl({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (s: number) => void;
}) {
  const options = [3, 5, 10, 15];
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <span className="text-[11px] font-semibold text-[var(--color-ink-2)]">
        Glimpse duration
      </span>
      <div
        className="flex gap-0.5 rounded-full bg-[var(--color-paper-2)] p-0.5"
        role="radiogroup"
      >
        {options.map((opt) => {
          const active = seconds === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              className="t-mono rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: active ? "#fff" : "transparent",
                color: active ? "var(--color-t-blue)" : "var(--color-ink-3)",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,.10)" : "none",
              }}
            >
              {opt}s
            </button>
          );
        })}
      </div>
    </div>
  );
}
