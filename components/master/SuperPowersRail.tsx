"use client";

import { useEffect, useState } from "react";
import {
  POLICIES,
  countPriorEvents,
  type SuperPowerKind,
} from "@/lib/superpowers/policy";
import type { SuperPowerEvent, LobbyPair } from "./MasterContent";
import { ScoringPanel } from "./ScoringPanel";

interface RailButtonSpec {
  kind: SuperPowerKind;
  icon: string;
  color: TintColor;
  title: string;
  sub: string;
}

type TintColor = "blue" | "purple" | "green" | "orange" | "red" | "teal";

// Verb override on the trigger CTA — defaults to "Fire" elsewhere.
// Specific verbs make it crisper which mechanic the GM is about to
// invoke ("Reveal" vs "Fire", "Re-roll" vs "Fire", etc.).
const TRIGGER_LABELS: Partial<Record<SuperPowerKind, string>> = {
  prototype: "Show glimpse",
  reveal_briefs: "Reveal",
  test_build: "Enable testing",
  agile_share: "Unlock share",
  time_pressure: "Squeeze",
  change_builder_brief: "Re-roll",
  change_guider_brief: "Re-roll",
  randomizer: "Re-roll goal",
  requirement_change: "Mutate one",
  harder: "Harder",
  easier: "Easier",
};

const BUTTONS: RailButtonSpec[] = [
  // Inline top-5 first, in the order the GM dashboard shows them.
  // Picked from playtest 2026-04-28 + UX-study read: these are the
  // mechanics that actually nudge a stuck pair without paving over
  // the lesson. The remaining mechanics live behind "More super
  // powers" → fullscreen modal so the rail stays scannable.
  {
    kind: "prototype",
    icon: "🔮",
    color: "blue",
    title: "Prototype unlock",
    sub: "Show builder a 3–15 s glimpse of the goal.",
  },
  {
    kind: "reveal_briefs",
    icon: "📖",
    color: "purple",
    title: "Reveal briefs",
    sub: "Both players see each other's hidden brief.",
  },
  {
    kind: "requirement_change",
    icon: "✎",
    color: "blue",
    title: "Requirement change",
    sub: "Mutate one element in the goal pattern.",
  },
  {
    kind: "time_pressure",
    icon: "⏱",
    color: "red",
    title: "Time pressure",
    sub: "−3:00 from the round timer.",
  },
  {
    kind: "randomizer",
    icon: "🎲",
    color: "orange",
    title: "Randomizer",
    sub: "Reset the pair's goal pattern.",
  },
  // Below the fold — only rendered in the fullscreen "More super
  // powers" modal.
  {
    kind: "agile_share",
    icon: "↻",
    color: "orange",
    title: "Agile share",
    sub: "Unlock a builder snapshot for the guider (one per fire).",
  },
  {
    kind: "test_build",
    icon: "✓",
    color: "green",
    title: "Test build",
    sub: "Flip per-piece correctness on for the builder + observers.",
  },
  {
    kind: "change_builder_brief",
    icon: "✦",
    color: "orange",
    title: "Change builder brief",
    sub: "Re-roll the builder's hidden constraint.",
  },
  {
    kind: "change_guider_brief",
    icon: "✦",
    color: "teal",
    title: "Change guider brief",
    sub: "Re-roll the guider's hidden constraint.",
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

// Inline rail surfaces only the top-5; the rest live behind a
// "More super powers" button that opens the fullscreen modal.
const TOP_KINDS = new Set<SuperPowerKind>([
  "prototype",
  "reveal_briefs",
  "requirement_change",
  "time_pressure",
  "randomizer",
]);
const TOP_BUTTONS = BUTTONS.filter((b) => TOP_KINDS.has(b.kind));

export interface SuperPowersRailProps {
  events: SuperPowerEvent[];
  roundRunning: boolean;
  focusedPair: LobbyPair | null;
  busy: boolean;
  /**
   * Whether scoring changes will retroactively recompute existing
   * pair scores (true while a round is active and at least one pair
   * has placements). Drives the mid-round confirmation in
   * ScoringPanel — playtest 2026-04-28 caught a GM dropping a
   * Light penalty on a pair sitting at 0 correct, watching them
   * snap to -4. The product warning was there but easy to miss.
   */
  scoreRetuneIsRetroactive: boolean;
  scoring: { correct_pts: number; wrong_pts: number };
  /**
   * Per-side brief enablement read from the game row. When a side is
   * disabled (GM created the game without that brief), the
   * corresponding "Change brief" super-power relabels itself to
   * "Add brief" — the route handler flips the flag the first time
   * it's triggered. When BOTH sides are disabled, "Reveal briefs"
   * has nothing to reveal and is disabled with an explanatory note.
   */
  briefsEnabled: { builder: boolean; guider: boolean };
  onTrigger: (
    kind: string,
    scope: "pair" | "all",
    pairId: string | null,
    payload?: Record<string, unknown>,
  ) => void;
  onScoring: (patch: { correct_pts?: number; wrong_pts?: number }) => void;
}

export function SuperPowersRail({
  events,
  roundRunning,
  focusedPair,
  busy,
  scoreRetuneIsRetroactive,
  scoring,
  briefsEnabled,
  onTrigger,
  onScoring,
}: SuperPowersRailProps) {
  const [scope, setScope] = useState<"pair" | "all">("pair");
  const [prototypeSec, setPrototypeSec] = useState(5);
  const [expanded, setExpanded] = useState(false);
  const noBriefsAtAll = !briefsEnabled.builder && !briefsEnabled.guider;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const focusedName = focusedPair ? "this pair" : "—";
  const segmentOptions = [
    { value: "pair" as const, label: focusedName },
    { value: "all" as const, label: "All pairs" },
  ];

  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
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
      </div>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]"
        title="Open full-screen super powers"
        aria-label="Open full-screen super powers"
      >
        <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>
          ⤢
        </span>
      </button>
    </div>
  );

  const scopeSegment = (
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
  );

  const scoringPanel = (
    <ScoringPanel
      correctPts={scoring.correct_pts}
      wrongPts={scoring.wrong_pts}
      busy={busy}
      retroactive={scoreRetuneIsRetroactive}
      onChange={onScoring}
    />
  );

  const renderButton = (b: RailButtonSpec) => {
    // Brief on/off conditionals.
    //   - change_builder_brief / change_guider_brief relabel to "Add
    //     ... brief" when that side is currently off. The route handler
    //     flips the flag on first trigger so future rounds keep the
    //     brief on.
    //   - reveal_briefs disables when BOTH sides are off — there's
    //     nothing to reveal.
    let spec: RailButtonSpec = b;
    let triggerLabel: string | undefined = TRIGGER_LABELS[b.kind];
    let extraDisabledReason: string | null = null;

    if (b.kind === "change_builder_brief" && !briefsEnabled.builder) {
      spec = {
        ...b,
        title: "Add builder brief",
        sub: "Builder brief was off at game-create. Trigger to roll one in for this round and keep it on for future rounds.",
      };
      triggerLabel = "Add brief";
    } else if (b.kind === "change_guider_brief" && !briefsEnabled.guider) {
      spec = {
        ...b,
        title: "Add guider brief",
        sub: "Guider brief was off at game-create. Trigger to roll one in for this round and keep it on for future rounds.",
      };
      triggerLabel = "Add brief";
    } else if (b.kind === "reveal_briefs" && noBriefsAtAll) {
      extraDisabledReason = "no_briefs";
    }

    return (
      <RailButton
        key={b.kind}
        spec={spec}
        events={events}
        scope={scope}
        focusedPairId={focusedPair?.id ?? null}
        disabled={
          !roundRunning ||
          busy ||
          (scope === "pair" && !focusedPair) ||
          !POLICIES[b.kind].implemented ||
          extraDisabledReason !== null
        }
        disabledNote={
          extraDisabledReason === "no_briefs"
            ? "No briefs to reveal — turn on a brief from the Add brief super-powers below."
            : null
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
        triggerLabel={triggerLabel}
        onTrigger={onTrigger}
      />
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-line)] px-5 pb-3 pt-5">
        {header}
        {scopeSegment}
      </div>

      {/* gap-4 + per-card outline keeps adjacent trigger CTAs
          visually distinct so an agent (or human) targeting a
          button by visible-text accessibility name lands on the
          intended card. Playtest #7 caught a Time pressure click
          firing Change builder brief — the cards were stacked too
          tightly with similar bottom-CTA shapes. */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3.5">
        {scoringPanel}
        {!roundRunning && (
          <p className="px-2 py-2 text-[12px] text-[var(--color-ink-3)]">
            Super powers light up while a round is in flight.
          </p>
        )}
        {TOP_BUTTONS.map(renderButton)}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="t-mono mt-1 flex w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-[var(--color-line)] bg-white px-3 py-3 text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink-3)]"
          aria-label="Open all super powers"
        >
          <span aria-hidden style={{ fontSize: 14 }}>
            ⤢
          </span>
          More super powers ({BUTTONS.length - TOP_BUTTONS.length}) →
        </button>
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Super powers — full screen"
          className="fixed inset-0 z-50 flex items-stretch justify-center p-6"
          style={{ background: "rgba(31,26,20,0.62)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
        >
          <div
            className="t-card flex w-full max-w-[1100px] flex-col gap-4 overflow-hidden p-6"
            style={{ background: "#fff" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">{header}</div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-md text-[20px] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <div className="flex-shrink-0 md:w-[300px]">
                {scopeSegment}
                <div className="mt-3">{scoringPanel}</div>
              </div>
              <div className="flex-1">
                {!roundRunning && (
                  <p className="mb-3 px-2 py-2 text-[12px] text-[var(--color-ink-3)]">
                    Super powers light up while a round is in flight.
                  </p>
                )}
                <div
                  className="grid gap-3 overflow-y-auto pr-1"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    maxHeight: "calc(90vh - 200px)",
                  }}
                >
                  {BUTTONS.map(renderButton)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
                Esc or click outside to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RailButton({
  spec,
  events,
  scope,
  focusedPairId,
  disabled,
  disabledNote,
  payload,
  extra,
  triggerLabel,
  onTrigger,
}: {
  spec: RailButtonSpec;
  events: SuperPowerEvent[];
  scope: "pair" | "all";
  focusedPairId: string | null;
  disabled: boolean;
  /**
   * Optional copy explaining a context-specific disable (e.g. "No
   * briefs to reveal" when both sides are off). Renders as a small
   * inline note next to the disabled CTA so the GM understands why
   * the button is unresponsive instead of guessing.
   */
  disabledNote?: string | null;
  /** Optional payload merged into the trigger call (e.g. duration_seconds). */
  payload?: Record<string, unknown>;
  /** Optional inline control rendered below the spec body (e.g. duration knob). */
  extra?: React.ReactNode;
  /** Override for the trigger CTA's verb — defaults to "Fire". */
  triggerLabel?: string;
  onTrigger: (
    kind: string,
    scope: "pair" | "all",
    pairId: string | null,
    payload?: Record<string, unknown>,
  ) => void;
}) {
  const policy = POLICIES[spec.kind];
  const counts = countPriorEvents(
    events as { kind: SuperPowerKind; scope: "pair" | "all"; pair_id: string | null; triggered_at: string }[],
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
  const verb = triggerLabel ?? "Fire";
  const ctaLabel =
    scope === "all" ? `${verb} on all pairs` : `${verb} on this pair`;

  // Card layout deliberately separates "read + configure" from "fire":
  // - Top row: icon, title, usage. Read-only.
  // - Body: description + optional `extra` (e.g. duration knob).
  // - Footer: a clearly-coloured CTA button — the *only* tap target
  //   that actually triggers the super-power. Earlier passes wrapped
  //   the entire card in a button with the `extra` controls nested
  //   inside, which left GMs guessing what would fire vs configure.
  return (
    <div
      className="relative flex w-full flex-col gap-2.5 rounded-[14px] border-[1.5px] bg-white p-3.5"
      style={{
        borderColor: "var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.08)",
        opacity: finalDisabled ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-3">
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
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold">{spec.title}</span>
            <span className="t-mono text-[10px] opacity-70">{usageLabel}</span>
          </div>
          <p
            className="block text-[12px] leading-tight"
            style={{ color: "var(--color-ink-3)" }}
          >
            {spec.sub}
          </p>
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
        </div>
      </div>
      {extra && <div>{extra}</div>}
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
        className="t-mono w-full rounded-[10px] px-3 py-2 text-[12px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed"
        style={{
          background: finalDisabled
            ? "var(--color-paper-2)"
            : `var(--color-t-${spec.color})`,
          color: finalDisabled ? "var(--color-ink-3)" : "#fff",
          letterSpacing: ".08em",
          boxShadow: finalDisabled
            ? "none"
            : "0 2px 0 rgba(0,0,0,.10), inset 0 -1px 0 rgba(0,0,0,.10)",
        }}
        aria-label={`${ctaLabel}${reachedCap ? " — cap reached" : ""}`}
      >
        {reachedCap ? "Cap reached" : `${verb} →`}
      </button>
      {disabledNote && finalDisabled && (
        <p
          className="text-[11px] leading-snug"
          style={{ color: "var(--color-ink-3)" }}
        >
          {disabledNote}
        </p>
      )}
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
