"use client";

import { useEffect, useState } from "react";

export type SurveyHarderReason = "me" | "partner" | "briefs" | "puzzle";

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
  what_made_harder: SurveyHarderReason;
  submitted_at: string;
}

const HARDER_OPTIONS: Array<{
  key: SurveyHarderReason;
  label: string;
  hint: string;
}> = [
  { key: "me", label: "Me", hint: "I struggled to translate / describe" },
  { key: "partner", label: "My partner", hint: "Their direction / question was hard to read" },
  { key: "briefs", label: "The briefs", hint: "The hidden constraint warped the conversation" },
  { key: "puzzle", label: "The puzzle", hint: "The pattern itself was tough" },
];

/**
 * Two-question end-of-round reflection. Slider for "who carried the
 * communication" + a 4-way pick for "what made it harder."
 *
 *   - Posts to POST /api/games/[code]/rounds/[round_id]/survey.
 *   - Fetches existing response on mount so the prompt is replaced
 *     with a "thanks · here's what you said" recap if the player
 *     already answered (browser refresh, or they came back after
 *     leaving).
 *   - Card collapses to the recap after submit; no nag, no force.
 *     The whole thing is optional — players can ignore it.
 */
export function RoundSurvey({
  code,
  roundId,
  meName,
  partnerName,
}: RoundSurveyProps) {
  const [balance, setBalance] = useState(50);
  const [harder, setHarder] = useState<SurveyHarderReason | null>(null);
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

  const submit = async () => {
    if (harder === null) {
      setError("Pick what made the round harder.");
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
            what_made_harder: harder,
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
          You answered <b>{labelForBalance(submitted.comm_balance, meName, partnerName)}</b>{" "}
          on the talk-balance, and that <b>{labelForHarder(submitted.what_made_harder)}</b>{" "}
          made the round harder.
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-bold text-[var(--color-ink)]">
          What made the round harder?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {HARDER_OPTIONS.map((opt) => {
            const active = harder === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setHarder(opt.key)}
                disabled={submitting}
                className="flex flex-col items-start gap-0.5 rounded-[10px] px-3 py-2 text-left text-[12px] disabled:opacity-50"
                style={{
                  background: active ? "var(--color-ink)" : "white",
                  color: active ? "var(--color-paper)" : "var(--color-ink)",
                  border: active
                    ? "1.5px solid var(--color-ink)"
                    : "1.5px solid var(--color-line)",
                }}
                aria-pressed={active}
              >
                <span className="font-bold">{opt.label}</span>
                <span
                  className="text-[11px]"
                  style={{
                    color: active ? "rgba(245,235,215,.85)" : "var(--color-ink-3)",
                  }}
                >
                  {opt.hint}
                </span>
              </button>
            );
          })}
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
          disabled={submitting || harder === null}
          className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save reflection →"}
        </button>
      </div>
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

function labelForHarder(reason: SurveyHarderReason): string {
  switch (reason) {
    case "me":
      return "you";
    case "partner":
      return "your partner";
    case "briefs":
      return "the briefs";
    case "puzzle":
      return "the puzzle";
  }
}
