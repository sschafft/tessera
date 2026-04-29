"use client";

export interface TestResult {
  correct: number;
  wrong: number;
  total: number;
  score: number;
  penaltyApplied: boolean;
  correctPts: number;
  wrongPts: number;
  /** ms timestamp — used to drive the celebration animation. */
  at: number;
}

export interface TestSolutionCTAProps {
  disabled: boolean;
  testing: boolean;
  result: TestResult | null;
  onTest: () => void;
}

/**
 * Builder's "Test solution" CTA + the result card that pulses after
 * each press. The card is a snapshot of the moment of test; the live
 * score chip elsewhere is the canonical current value.
 */
export function TestSolutionCTA({
  disabled,
  testing,
  result,
  onTest,
}: TestSolutionCTAProps) {
  // The result chip pulses on every Test-solution submission. The
  // pulse is React-keyed by the result.at timestamp so a fresh result
  // remounts the div and replays the CSS animation — no need for a
  // counter-in-effect to drive the remount.
  const anyCorrect = (result?.correct ?? 0) > 0;
  return (
    <div className="mt-2 flex w-full max-w-[640px] flex-col items-center gap-3">
      {result && (
        <div
          key={result.at}
          className="t-card flex w-full items-center gap-3 px-4 py-3"
          style={{
            background: anyCorrect
              ? "var(--color-tint-green)"
              : "var(--color-paper-2)",
            borderColor: anyCorrect
              ? "var(--color-t-green)"
              : "var(--color-line)",
            animation: "tessera-pulse 600ms ease-out",
          }}
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-[20px]"
            style={{
              background: anyCorrect ? "var(--color-t-green)" : "#fff",
              color: anyCorrect ? "#fff" : "var(--color-ink-3)",
              boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,.10)",
            }}
          >
            {anyCorrect ? "✓" : "—"}
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span
              className="t-display text-[18px] font-bold"
              style={{
                color: anyCorrect
                  ? "var(--color-t-green)"
                  : "var(--color-ink)",
              }}
            >
              {result.score} point
              {Math.abs(result.score) === 1 ? "" : "s"}
            </span>
            <span className="text-[12px] text-[var(--color-ink-2)]">
              {result.correct} right · {result.wrong} wrong
              {result.penaltyApplied
                ? ` · penalty ${result.wrongPts} applied`
                : ""}
            </span>
          </div>
          <span className="t-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-3)]">
            tap test again any time
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onTest}
        disabled={disabled || testing}
        className="t-btn t-btn--primary w-full disabled:opacity-50"
        style={{ padding: "16px 22px", fontSize: 16 }}
        title={
          disabled
            ? "Place at least one piece to test."
            : "Score the current placements against the goal."
        }
      >
        {testing ? "Testing…" : "✓ Test solution"}
      </button>

      <style>{`
        @keyframes tessera-pulse {
          0% { transform: scale(0.96); opacity: 0; }
          60% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
