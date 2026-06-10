"use client";

import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { Confetti } from "./Confetti";
import { RoundSurvey } from "./RoundSurvey";
import type { PlayState } from "./PlayContent";

/**
 * Map an accuracy ratio (0..1) to a debrief headline + tone.
 * The current copy is intentionally supportive at every tier so
 * partial-completion players don't read the screen as a graded
 * report card.
 */
function debriefTone(correct: number, total: number) {
  if (total === 0) return { headline: "Round complete", tint: "ink-3" as const };
  const ratio = correct / total;
  if (ratio >= 1) {
    return { headline: "Perfect round! 🎉", tint: "green" as const };
  }
  if (ratio >= 0.8) {
    return {
      headline: "So close — that was a great round.",
      tint: "green" as const,
    };
  }
  if (ratio >= 0.5) {
    return { headline: "Solid effort.", tint: "orange" as const };
  }
  return { headline: "Tough one. Onto the next.", tint: "ink-2" as const };
}

export interface RoundEndedViewProps {
  state: PlayState;
}

/**
 * Shown to every role once round.status='ended' and the game is still
 * running. Reveals the goal pattern + final builder canvas + accuracy
 * + both briefs side-by-side for the debrief.
 */
export function RoundEndedView({ state }: RoundEndedViewProps) {
  const goal = state.goal ?? [];
  const placements = state.placements;
  const accuracy = state.accuracy;
  const briefs = collectBriefs(state);
  const showCoords = (state.round?.complexity ?? 5) <= 4;

  const tone = accuracy
    ? debriefTone(accuracy.correct, accuracy.total)
    : { headline: "Round complete", tint: "ink-3" as const };
  const ratio = accuracy && accuracy.total > 0 ? accuracy.correct / accuracy.total : 0;
  // Mount-only confetti burst sized by accuracy: high accuracy gets a
  // celebratory pop, partial gets a gentle sprinkle, near-miss gets
  // nothing.
  const confettiIntensity =
    ratio >= 1 ? "large" : ratio >= 0.8 ? "small" : null;

  return (
    <section className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 p-6">
      {confettiIntensity && <Confetti intensity={confettiIntensity} />}
      <header className="flex items-end justify-between">
        <div>
          <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
            ROUND ENDED
          </div>
          <h1
            className="t-display mt-1 text-[32px]"
            style={{
              color:
                tone.tint === "green"
                  ? "var(--color-t-green)"
                  : tone.tint === "orange"
                    ? "var(--color-t-orange)"
                    : "var(--color-ink)",
            }}
          >
            {tone.headline}
          </h1>
          <p className="t-mono mt-1 text-[12px] text-[var(--color-ink-3)]">
            Round {state.round?.index} · debrief
          </p>
        </div>
        {accuracy && (
          <span
            className="t-mono rounded-full px-4 py-2 text-[14px] font-bold"
            style={{
              background:
                accuracy.correct === accuracy.total
                  ? "var(--color-tint-green)"
                  : "var(--color-paper-2)",
              color:
                accuracy.correct === accuracy.total
                  ? "var(--color-t-green)"
                  : "var(--color-ink)",
            }}
          >
            ✓ {accuracy.correct} / {accuracy.total} correct
          </span>
        )}
      </header>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="t-card flex flex-col items-center gap-3 p-4">
          <PaneHeader title="What you built" colorVar="orange" />
          <PlayCanvas
            pieces={placements}
            complexity={state.round?.complexity ?? 5}
            showCoords={showCoords}
          />
        </div>
        <div className="t-card flex flex-col items-center gap-3 p-4">
          <PaneHeader title="What it should have been" colorVar="blue" />
          <PlayCanvas
            pieces={goal}
            complexity={state.round?.complexity ?? 5}
            showCoords={showCoords}
          />
        </div>
      </div>

      {briefs.length > 0 && (
        <div className="t-card flex flex-col gap-3 p-4">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
            Briefs in play
          </span>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(briefs.length, 2)}, 1fr)`,
            }}
          >
            {briefs.map((b) => (
              <div
                key={b.role}
                className="rounded-[12px] border-[1.5px] p-3.5"
                style={{
                  background:
                    b.role === "builder"
                      ? "var(--color-tint-orange)"
                      : "var(--color-tint-blue)",
                  borderColor:
                    b.role === "builder"
                      ? "var(--color-t-orange)"
                      : "var(--color-t-blue)",
                }}
              >
                <span
                  className="t-mono text-[10px] font-bold tracking-widest"
                  style={{
                    color:
                      b.role === "builder"
                        ? "var(--color-t-orange)"
                        : "var(--color-t-blue)",
                  }}
                >
                  ● {b.role.toUpperCase()}
                </span>
                <div
                  className="t-display mt-1 mb-2 text-[16px] font-bold"
                  style={{ color: "var(--color-ink)" }}
                >
                  {b.title}
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-[var(--color-ink-2)]">
                  {b.rules.map((r, i) => (
                    <li key={i}>· {r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The reflection survey is GM-opt-in per round (post 2026-05-04
          attribution-survey design pass). Players see it only when
          the GM picked "End + ask reflection" in the EndRoundModal,
          which flips `rounds.reflection_survey_requested`. Observers
          are excluded — they don't have a partner-balance to weigh in
          on. The component fetches the participant's existing
          response on mount and collapses to a recap if one already
          exists. */}
      {state.round?.id &&
        state.round.reflection_survey_requested === true &&
        (state.role === "builder" || state.role === "guider") && (
          <RoundSurvey code={state.code} roundId={state.round.id} />
        )}

      <p className="t-mono text-center text-[12px] text-[var(--color-ink-3)]">
        Debrief on your call. Your facilitator will move the room next.
      </p>
    </section>
  );
}

function collectBriefs(state: PlayState) {
  const set: PlayState["brief"][] = [];
  if (state.brief) set.push(state.brief);
  if (state.partner_brief) set.push(state.partner_brief);
  if (state.observer_briefs) {
    for (const b of state.observer_briefs) set.push(b);
  }
  // Dedupe by role.
  const seen = new Set<string>();
  return set
    .filter((b): b is NonNullable<PlayState["brief"]> => Boolean(b))
    .filter((b) => {
      if (seen.has(b.role)) return false;
      seen.add(b.role);
      return true;
    });
}

function PaneHeader({ title, colorVar }: { title: string; colorVar: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: `var(--color-t-${colorVar})` }}
      />
      <span className="text-[13px] font-bold">{title}</span>
    </div>
  );
}
