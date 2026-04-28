"use client";

import { useCallback, useEffect, useState } from "react";
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

// Verb override on the trigger CTA — defaults to "Fire" elsewhere.
// Specific verbs make it crisper which mechanic the GM is about to
// invoke ("Reveal" vs "Fire", "Re-roll" vs "Fire", etc.).
const TRIGGER_LABELS: Partial<Record<AccelerantKind, string>> = {
  prototype: "Show glimpse",
  reveal_briefs: "Reveal",
  test_build: "Enable testing",
  agile_share: "Unlock share",
  time_pressure: "Squeeze",
  change_builder_brief: "Re-roll",
  vocab_swap: "Re-roll",
  randomizer: "Re-roll goal",
  requirement_change: "Mutate one",
  harder: "Harder",
  easier: "Easier",
};

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
  scoreRetuneIsRetroactive,
  scoring,
  onTrigger,
  onScoring,
}: AccelerantsRailProps) {
  const [scope, setScope] = useState<"pair" | "all">("pair");
  const [prototypeSec, setPrototypeSec] = useState(5);
  const [expanded, setExpanded] = useState(false);

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

  const renderButton = (b: RailButtonSpec) => (
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
        b.kind === "prototype" ? { duration_seconds: prototypeSec } : undefined
      }
      extra={
        b.kind === "prototype" ? (
          <PrototypeDurationControl
            seconds={prototypeSec}
            onChange={setPrototypeSec}
          />
        ) : null
      }
      triggerLabel={TRIGGER_LABELS[b.kind]}
      onTrigger={onTrigger}
    />
  );

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
        {BUTTONS.map(renderButton)}
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

/**
 * Game-wide scoring config tile. Lets the GM bump the per-correct
 * value (stepper) and pick the wrong-attempt penalty from a labelled
 * preset row (Off / Light / Med / Hard). Sits at the top of the
 * super-powers panel so it's always visible.
 *
 * Optimistic local state: each click immediately updates the visible
 * value while the API call resolves. A transient "✓ saved" pip
 * confirms the write. Earlier passes used live props directly which
 * meant the value flickered through the polling round-trip — GMs
 * tapped twice thinking the first didn't take.
 */
export function ScoringPanel({
  correctPts,
  wrongPts,
  busy,
  retroactive,
  onChange,
}: {
  correctPts: number;
  wrongPts: number;
  busy: boolean;
  /**
   * When true, a wrong-pts change will recompute existing pair
   * scores in place (round is running and pairs have placements).
   * Drives a confirm modal so a tap on Hard during a live round
   * doesn't silently slam scores into the negatives.
   */
  retroactive: boolean;
  onChange: (patch: { correct_pts?: number; wrong_pts?: number }) => void;
}) {
  const [optCorrect, setOptCorrect] = useState<number | null>(null);
  const [optWrong, setOptWrong] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [savedVisible, setSavedVisible] = useState(false);
  const [pendingWrong, setPendingWrong] = useState<number | null>(null);

  // Drop optimistic overrides once the server-side state catches up.
  useEffect(() => {
    if (optCorrect !== null && optCorrect === correctPts) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic-GC: server caught up.
      setOptCorrect(null);
    }
  }, [correctPts, optCorrect]);
  useEffect(() => {
    if (optWrong !== null && optWrong === wrongPts) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic-GC: server caught up.
      setOptWrong(null);
    }
  }, [wrongPts, optWrong]);
  // Show "✓ saved" pip for ~1.4s after each click. Schedule the
  // hide via a fresh timer keyed off savedAt so back-to-back clicks
  // keep the pip visible.
  useEffect(() => {
    if (savedAt === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot pip toggle off a per-save sentinel; the cleanup timer handles auto-hide.
    setSavedVisible(true);
    const id = window.setTimeout(() => setSavedVisible(false), 1400);
    return () => window.clearTimeout(id);
  }, [savedAt]);

  const visibleCorrect = optCorrect ?? correctPts;
  const visibleWrong = optWrong ?? wrongPts;

  const bumpCorrect = useCallback(
    (delta: number) => {
      const next = Math.max(1, Math.min(100, visibleCorrect + delta));
      if (next === visibleCorrect) return;
      setOptCorrect(next);
      setSavedAt(Date.now());
      onChange({ correct_pts: next });
    },
    [visibleCorrect, onChange],
  );
  const commitWrong = useCallback(
    (next: number) => {
      setOptWrong(next);
      setSavedAt(Date.now());
      onChange({ wrong_pts: next });
    },
    [onChange],
  );
  const setWrong = useCallback(
    (next: number) => {
      if (next === visibleWrong) return;
      // Mid-round penalty changes recompute every pair's existing
      // score the next time /play, /test-solution, or /summary fires
      // — so a tap on Hard while pairs are mid-build can drop them
      // from 0 pts to −Nx pts in one click. Confirm before
      // committing when the change is retroactive.
      if (retroactive) {
        setPendingWrong(next);
        return;
      }
      commitWrong(next);
    },
    [visibleWrong, retroactive, commitWrong],
  );

  const PENALTY_PRESETS: Array<{ value: number; label: string; sub: string }> =
    [
      { value: 0, label: "Off", sub: "no penalty" },
      { value: -1, label: "Light", sub: "−1" },
      { value: -3, label: "Med", sub: "−3" },
      { value: -5, label: "Hard", sub: "−5" },
    ];

  const showSaved = savedVisible;
  const pendingPreset =
    pendingWrong !== null
      ? PENALTY_PRESETS.find((p) => p.value === pendingWrong)
      : null;

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[14px] bg-white p-3.5"
      style={{
        border: "1.5px solid var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.06)",
      }}
    >
      {pendingPreset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm scoring change"
          // z-[70] so we sit above the rail's own fullscreen modal
          // (z-50). Playtest #7 caught the GM clicking Light → no
          // visible change because this confirm modal opened
          // *under* the fullscreen rail and stayed unseen.
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          style={{ background: "rgba(31,26,20,0.62)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingWrong(null);
          }}
        >
          <div
            className="t-card flex flex-col gap-3 p-5"
            style={{
              background: "var(--color-tint-yellow)",
              border: "2px solid var(--color-t-yellow)",
              maxWidth: 440,
              boxShadow: "0 24px 60px rgba(122,91,0,0.35), 0 6px 0 rgba(0,0,0,.12)",
            }}
          >
            <div
              className="t-mono text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "#7a5b00", letterSpacing: ".15em" }}
            >
              ⚠ Mid-round scoring change
            </div>
            <h3
              className="t-display text-[20px] leading-tight"
              style={{ color: "var(--color-ink)" }}
            >
              Apply <b>{pendingPreset.label}</b> ({pendingPreset.sub}) penalty
              now?
            </h3>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: "#7a5b00" }}
            >
              This recomputes every pair&apos;s score in place — pairs with
              wrong placements right now will drop immediately, before they
              get another chance to test. Generally safer to tune scoring
              between rounds.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  commitWrong(pendingPreset.value);
                  setPendingWrong(null);
                }}
                className="t-btn t-btn--primary"
                disabled={busy}
                autoFocus
              >
                Apply now →
              </button>
              <button
                type="button"
                onClick={() => setPendingWrong(null)}
                className="t-btn t-btn--ghost"
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold">Scoring</span>
            {showSaved && (
              <span
                className="t-mono rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  background: "var(--color-tint-green)",
                  color: "var(--color-t-green)",
                }}
                role="status"
                aria-live="polite"
              >
                ✓ saved
              </span>
            )}
          </div>
          <span
            className="block text-[12px] leading-tight"
            style={{ color: "var(--color-ink-3)" }}
          >
            Live across every pair. Changes apply on the next Test
            solution and recompute existing scores.
          </span>
        </div>
      </div>

      {/* Per-correct stepper */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">
          Per correct piece
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bumpCorrect(-1)}
            disabled={busy || visibleCorrect <= 1}
            className="t-mono grid h-7 w-7 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[14px] font-bold disabled:opacity-50"
            aria-label="Decrease points per correct"
          >
            −
          </button>
          <span
            className="t-mono w-10 text-center text-[14px] font-bold"
            style={{ color: "var(--color-ink)" }}
            aria-live="polite"
          >
            +{visibleCorrect}
          </span>
          <button
            type="button"
            onClick={() => bumpCorrect(+1)}
            disabled={busy || visibleCorrect >= 100}
            className="t-mono grid h-7 w-7 place-items-center rounded-md border-[1.5px] border-[var(--color-line)] bg-white text-[14px] font-bold disabled:opacity-50"
            aria-label="Increase points per correct"
          >
            +
          </button>
        </div>
      </div>

      {/* Wrong-attempt penalty preset row. Was a +/- stepper which
          had inverted semantics on negative numbers and read
          identically to "Per correct" — GMs reported it as
          "not feasible to trigger". Discrete labelled presets make
          the choice explicit. */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">
          Wrong-attempt penalty
        </span>
        <div
          className="flex gap-0.5 rounded-[10px] bg-[var(--color-paper-2)] p-1"
          role="radiogroup"
          aria-label="Wrong-attempt penalty"
        >
          {PENALTY_PRESETS.map((p) => {
            const active = visibleWrong === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => setWrong(p.value)}
                className="flex-1 cursor-pointer rounded-[8px] border-none px-2 py-1.5 text-center transition-colors disabled:opacity-50"
                style={{
                  background: active ? "#fff" : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                  color: active
                    ? p.value < 0
                      ? "var(--color-t-red)"
                      : "var(--color-ink)"
                    : "var(--color-ink-3)",
                }}
              >
                <span className="block text-[11px] font-bold leading-none">
                  {p.label}
                </span>
                <span
                  className="t-mono mt-0.5 block text-[10px]"
                  style={{ opacity: active ? 1 : 0.7 }}
                >
                  {p.sub}
                </span>
              </button>
            );
          })}
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
  triggerLabel,
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
