"use client";

import { useEffect, useState } from "react";

export interface RoundSurveyProps {
  code: string;
  roundId: string;
  /** Display name to anchor the slider's "you" anchor; null falls back to "you". */
  meName: string;
  /** Display name to anchor the slider's "partner" anchor; null falls back to "your partner". */
  partnerName: string | null;
}

interface SubmittedSurvey {
  comm_balance: number;
  attr_self: number;
  attr_partner: number;
  attr_system: number;
  submitted_at: string;
}

type FrictionAxis = "self" | "partner" | "system";

interface FrictionState {
  self: number;
  partner: number;
  system: number;
}

/**
 * Two-question end-of-round reflection. The original 4-way pick was
 * replaced 2026-05-04 with a forced-choice friction-attribution
 * slider that splits 100 points across self / partner / system —
 * magnitude carries the debrief signal, not just a coarse pick.
 *
 *   - Posts to POST /api/games/[code]/rounds/[round_id]/survey.
 *   - Mounts only when the GM opted in at end-round time
 *     (rounds.reflection_survey_requested === true). Caller checks
 *     that flag and just doesn't render this component otherwise.
 *   - Pre-fetches an existing response so a refresh / cross-device
 *     return collapses to the recap instead of re-asking.
 */
export function RoundSurvey({
  code,
  roundId,
  meName,
  partnerName,
}: RoundSurveyProps) {
  const [balance, setBalance] = useState(50);
  // Default 33/33/34 so the three-slider rebalance has non-zero
  // mass to redistribute on the first interaction. 0/0/0 would lock
  // the sliders in place because the rebalance has nothing to take
  // from. The user is still expected to tweak before submit.
  const [friction, setFriction] = useState<FrictionState>({
    self: 33,
    partner: 33,
    system: 34,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedSurvey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fetch any existing response so a refresh / cross-device return
  // collapses the card to the recap instead of re-asking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/games/${code}/rounds/${roundId}/survey`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const j = (await res.json()) as { survey: SubmittedSurvey | null };
        if (!cancelled && j.survey) setSubmitted(j.survey);
      } catch {
        // Silent — the card just stays in its prompt state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, roundId]);

  /**
   * When one slider moves, redistribute the delta proportionally
   * across the other two so the three always sum to 100. If the
   * other two are both zero, the active slider can't grow past its
   * current value (no mass to cede); the input is clamped via
   * `oldValue`.
   */
  function setAxis(axis: FrictionAxis, raw: number) {
    const next = Math.max(0, Math.min(100, Math.round(raw)));
    setFriction((prev) => {
      const oldValue = prev[axis];
      const others: FrictionAxis[] =
        axis === "self"
          ? ["partner", "system"]
          : axis === "partner"
            ? ["self", "system"]
            : ["self", "partner"];
      const [a, b] = others;
      const otherSum = prev[a] + prev[b];
      // Both other axes already at zero — can't grow this one
      // further. Clamp the new value to keep the sum invariant.
      if (otherSum === 0 && next > oldValue) {
        return prev;
      }
      const delta = next - oldValue;
      // Proportional split. Edge-case: when otherSum is 0 the user
      // can only DECREASE this axis (delta <= 0), and the other two
      // are 0 so they're not adjusted — the freed mass redistributes
      // to whichever has positive value (here neither, so fall back
      // to even split).
      let aNew: number;
      let bNew: number;
      if (otherSum === 0) {
        aNew = Math.round(-delta / 2);
        bNew = -delta - aNew;
      } else {
        aNew = Math.round(prev[a] - delta * (prev[a] / otherSum));
        bNew = Math.round(prev[b] - delta * (prev[b] / otherSum));
      }
      // Clamp + reconcile rounding so the three integers sum to 100.
      const clamped = {
        [axis]: next,
        [a]: Math.max(0, Math.min(100, aNew)),
        [b]: Math.max(0, Math.min(100, bNew)),
      } as unknown as FrictionState;
      const sum = clamped.self + clamped.partner + clamped.system;
      const drift = 100 - sum;
      // Push leftover into the larger of the two others so we never
      // distort the user's intent on `axis`.
      if (drift !== 0) {
        const pickAxis: FrictionAxis = clamped[a] >= clamped[b] ? a : b;
        clamped[pickAxis] = Math.max(
          0,
          Math.min(100, clamped[pickAxis] + drift),
        );
      }
      return clamped;
    });
  }

  const sum = friction.self + friction.partner + friction.system;

  const submit = async () => {
    if (sum !== 100) {
      setError("The three sliders must total 100.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/games/${code}/rounds/${roundId}/survey`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            comm_balance: balance,
            attr_self: friction.self,
            attr_partner: friction.partner,
            attr_system: friction.system,
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      const j = (await res.json()) as { survey: SubmittedSurvey };
      setSubmitted(j.survey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="t-card flex flex-col gap-2 p-4"
        style={{
          background: "var(--color-tint-green)",
          borderColor: "var(--color-t-green)",
        }}
      >
        <span
          className="t-mono text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "var(--color-t-green)" }}
        >
          ✓ Reflection saved
        </span>
        <div className="text-[13px] text-[var(--color-ink-2)]">
          You answered{" "}
          <b>{labelForBalance(submitted.comm_balance, meName, partnerName)}</b>{" "}
          on the talk-balance, and split friction{" "}
          <b>
            {submitted.attr_self}% on you · {submitted.attr_partner}% on{" "}
            {partnerName ?? "your partner"} · {submitted.attr_system}% on the
            game
          </b>
          .
        </div>
      </div>
    );
  }

  const meAnchor = meName || "you";
  const partnerAnchor = partnerName || "your partner";
  return (
    <div className="t-card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <span className="t-mono text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-3)]">
          Quick reflection · two questions
        </span>
        <p className="text-[13px] text-[var(--color-ink-2)]">
          Optional. Helps the facilitator anchor the debrief on the
          right thing.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="survey-balance"
          className="text-[13px] font-bold text-[var(--color-ink)]"
        >
          Who carried the communication?
        </label>
        <div className="flex items-center justify-between text-[12px] text-[var(--color-ink-3)]">
          <span>← {meAnchor} did most</span>
          <span>shared</span>
          <span>{partnerAnchor} did most →</span>
        </div>
        <input
          id="survey-balance"
          type="range"
          min={0}
          max={100}
          step={5}
          value={balance}
          onChange={(e) => setBalance(Number(e.target.value))}
          disabled={submitting}
          className="w-full"
          style={{ accentColor: "var(--color-t-blue)" }}
          aria-label="Communication balance slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={balance}
        />
        <div className="t-mono self-center text-[11px] text-[var(--color-ink-3)]">
          {labelForBalance(balance, meName, partnerName)}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-bold text-[var(--color-ink)]">
          Where did the friction land?
        </legend>
        <p className="text-[12px] text-[var(--color-ink-3)]">
          Split 100 points across the three sources. Sliders rebalance
          as you adjust so the total always lands at 100.
        </p>
        <FrictionRow
          axis="self"
          label={`On ${meAnchor}`}
          hint="I missed translating, mis-heard, or got confused."
          value={friction.self}
          onChange={(v) => setAxis("self", v)}
          disabled={submitting}
        />
        <FrictionRow
          axis="partner"
          label={`On ${partnerAnchor}`}
          hint="Their direction / question was hard to read."
          value={friction.partner}
          onChange={(v) => setAxis("partner", v)}
          disabled={submitting}
        />
        <FrictionRow
          axis="system"
          label="On the game"
          hint="The brief, the puzzle, or the rules made this hard."
          value={friction.system}
          onChange={(v) => setAxis("system", v)}
          disabled={submitting}
        />
        <div
          className="t-mono self-end text-[11px]"
          style={{
            color:
              sum === 100 ? "var(--color-t-green)" : "var(--color-t-red)",
          }}
          aria-live="polite"
        >
          {sum} / 100
        </div>
      </fieldset>

      {error && (
        <p className="text-[12px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || sum !== 100}
          className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save reflection →"}
        </button>
      </div>
    </div>
  );
}

interface FrictionRowProps {
  axis: FrictionAxis;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function FrictionRow({
  axis,
  label,
  hint,
  value,
  onChange,
  disabled,
}: FrictionRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">
          {label}
        </span>
        <span className="t-mono text-[12px] font-bold text-[var(--color-ink)]">
          {value}%
        </span>
      </div>
      <span className="text-[11px] text-[var(--color-ink-3)]">{hint}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full"
        style={{
          accentColor:
            axis === "self"
              ? "var(--color-t-orange)"
              : axis === "partner"
                ? "var(--color-t-blue)"
                : "var(--color-t-purple)",
        }}
        aria-label={`Attribution to ${axis}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      />
    </div>
  );
}

function labelForBalance(
  v: number,
  meName: string,
  partnerName: string | null,
): string {
  const me = meName || "you";
  const partner = partnerName || "your partner";
  if (v <= 20) return `Mostly ${me}`;
  if (v <= 40) return `${me} more than ${partner}`;
  if (v < 60) return "Pretty even";
  if (v < 80) return `${partner} more than ${me}`;
  return `Mostly ${partner}`;
}
