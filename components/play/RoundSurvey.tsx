"use client";

import { useEffect, useState } from "react";

export interface RoundSurveyProps {
  code: string;
  roundId: string;
}

const MAX_OTHER_TEXT = 280;

type FrictionAxis =
  | "fric_puzzle"
  | "fric_communication"
  | "fric_time_pressure"
  | "fric_game_adjustments"
  | "fric_other";

interface FrictionState {
  fric_puzzle: number;
  fric_communication: number;
  fric_time_pressure: number;
  fric_game_adjustments: number;
  fric_other: number;
}

interface SubmittedSurvey extends FrictionState {
  fric_other_text: string | null;
  submitted_at: string;
}

/**
 * End-of-round reflection (2026-06-10 redesign). Five independent
 * 0..100 sliders for the categories players actually point at when
 * they describe what made a round hard:
 *
 *   • Puzzle
 *   • Communication
 *   • Time pressure
 *   • Game adjustments
 *   • Other (with a free-text note when > 0)
 *
 * Replaces the v2 forced-choice self/partner/system slider — the
 * old framing made "the game" do too much work. No sum constraint;
 * each axis is rated on its own.
 *
 *   - Posts to POST /api/games/[code]/rounds/[round_id]/survey.
 *   - Mounts only when the GM opted in at end-round time
 *     (rounds.reflection_survey_requested === true); the caller
 *     just doesn't render this component otherwise.
 *   - Pre-fetches an existing response so a refresh / cross-device
 *     return collapses to the recap instead of re-asking.
 */
export function RoundSurvey({ code, roundId }: RoundSurveyProps) {
  const [friction, setFriction] = useState<FrictionState>({
    fric_puzzle: 0,
    fric_communication: 0,
    fric_time_pressure: 0,
    fric_game_adjustments: 0,
    fric_other: 0,
  });
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedSurvey | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/games/${code}/rounds/${roundId}/survey`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...friction,
            fric_other_text:
              friction.fric_other > 0 && otherText.trim().length > 0
                ? otherText.trim()
                : null,
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
          Thanks — your facilitator can see the categories where this round
          felt the hardest.
        </div>
      </div>
    );
  }

  const anyMass =
    friction.fric_puzzle +
      friction.fric_communication +
      friction.fric_time_pressure +
      friction.fric_game_adjustments +
      friction.fric_other >
    0;

  return (
    <div className="t-card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <span className="t-mono text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-3)]">
          Quick reflection · what added friction?
        </span>
        <p className="text-[13px] text-[var(--color-ink-2)]">
          Optional. Move each slider to show how much that category got
          in the way this round — each axis is independent, you can
          leave any at zero.
        </p>
      </div>

      <fieldset className="flex flex-col gap-4">
        <FrictionRow
          axis="fric_puzzle"
          label="Puzzle"
          hint="The goal pattern itself / the grid."
          tint="var(--color-t-blue)"
          value={friction.fric_puzzle}
          onChange={(v) =>
            setFriction((p) => ({ ...p, fric_puzzle: v }))
          }
          disabled={submitting}
        />
        <FrictionRow
          axis="fric_communication"
          label="Communication"
          hint="Talking past each other — descriptions, questions, vocabulary."
          tint="var(--color-t-orange)"
          value={friction.fric_communication}
          onChange={(v) =>
            setFriction((p) => ({ ...p, fric_communication: v }))
          }
          disabled={submitting}
        />
        <FrictionRow
          axis="fric_time_pressure"
          label="Time pressure"
          hint="Not enough time, the clock making things feel rushed."
          tint="var(--color-t-red)"
          value={friction.fric_time_pressure}
          onChange={(v) =>
            setFriction((p) => ({ ...p, fric_time_pressure: v }))
          }
          disabled={submitting}
        />
        <FrictionRow
          axis="fric_game_adjustments"
          label="Game adjustments"
          hint="Mid-round changes from the facilitator (super-powers, scoring, brief swaps)."
          tint="var(--color-t-purple)"
          value={friction.fric_game_adjustments}
          onChange={(v) =>
            setFriction((p) => ({ ...p, fric_game_adjustments: v }))
          }
          disabled={submitting}
        />
        <FrictionRow
          axis="fric_other"
          label="Other"
          hint="Anything else. Type a note below if it'd help the facilitator."
          tint="var(--color-t-green)"
          value={friction.fric_other}
          onChange={(v) => setFriction((p) => ({ ...p, fric_other: v }))}
          disabled={submitting}
        />
        {friction.fric_other > 0 && (
          <label className="flex flex-col gap-1">
            <span className="t-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-3)]">
              Other — what was it?
            </span>
            <textarea
              value={otherText}
              onChange={(e) =>
                setOtherText(e.target.value.slice(0, MAX_OTHER_TEXT))
              }
              disabled={submitting}
              placeholder="A line is plenty."
              rows={2}
              maxLength={MAX_OTHER_TEXT}
              className="rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2 text-[13px]"
              style={{ resize: "vertical" }}
            />
            <span
              className="t-mono self-end text-[10px]"
              style={{ color: "var(--color-ink-3)" }}
            >
              {otherText.length} / {MAX_OTHER_TEXT}
            </span>
          </label>
        )}
      </fieldset>

      {error && (
        <p className="text-[12px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span
          className="t-mono text-[11px]"
          style={{ color: "var(--color-ink-3)" }}
        >
          {anyMass
            ? "All five are independent — no need to balance."
            : "Move at least one slider, or leave them all at zero and submit."}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
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
  tint: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function FrictionRow({
  axis,
  label,
  hint,
  tint,
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
          {value}
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
        style={{ accentColor: tint }}
        aria-label={`${axis} friction (0 = none, 100 = a lot)`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      />
    </div>
  );
}
