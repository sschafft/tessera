"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/primitives/Wordmark";
import { RoleChip } from "@/components/primitives/RoleChip";
import type { LobbyRound } from "./MasterContent";

export interface TopBarControlsProps {
  code: string;
  workshopName: string;
  roundCount: number;
  complexity: number;
  round: LobbyRound | null;
  durationSeconds: number;
  canStart: boolean;
  /** True when the game has been ended. Hides round controls. */
  gameEnded: boolean;
  /** True when round.status='ended' and we've reached round_count. */
  allRoundsDone: boolean;
  busy: boolean;
  /** Last action error (e.g. "no_pairs"); surfaced near the button. */
  actionError: string | null;
  /** Whether at least one pair exists — used to explain a disabled Start. */
  pairsCount: number;
  /** Start the next round with the chosen complexity (1..8) and duration in seconds. */
  onStart: (complexity?: number, durationSeconds?: number) => void;
  onEnd: () => void;
  onEndGame: () => void;
  /** Add seconds to the running round timer. */
  onExtend: (deltaSeconds: number) => void;
}

const ERROR_COPY: Record<string, string> = {
  no_pairs: "Allocate at least one pair before starting a round.",
  round_already_running: "A round is already running.",
  all_rounds_complete:
    "All planned rounds finished. Use \"Start another round\" instead.",
  forbidden: "You don't have permission for that.",
};

export function TopBarControls({
  code,
  workshopName,
  roundCount,
  complexity,
  round,
  durationSeconds,
  canStart,
  gameEnded,
  allRoundsDone,
  busy,
  actionError,
  pairsCount,
  onStart,
  onEnd,
  onEndGame,
  onExtend,
}: TopBarControlsProps) {
  const remaining = useTimer(round, durationSeconds);
  const isRunning = round?.status === "running";
  const isRoundEnded = round?.status === "ended";
  const isLastTwoMinutes = isRunning && remaining > 0 && remaining <= 120;
  const idx = round?.index ?? 1;
  const nextIdx = isRoundEnded ? idx + 1 : idx;
  const startComplexityDefault = isRoundEnded ? complexity : complexity;
  const [startComplexity, setStartComplexity] = useState(startComplexityDefault);
  // Re-seed when the underlying default changes (new round, replay).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the local "starting complexity" stepper when the GM starts a new round and the default shifts.
    setStartComplexity(startComplexityDefault);
  }, [startComplexityDefault]);
  const bumpComplexity = (delta: number) =>
    setStartComplexity((c) => Math.max(1, Math.min(8, c + delta)));

  // Free-text round duration. The text input accepts plain minutes
  // ("5", "2.5") or m:ss ("5:30"); we parse to seconds at submit time
  // and let the server clamp anything < 60s back to the configured
  // default.
  const defaultMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const [durationText, setDurationText] = useState<string>(
    String(defaultMinutes),
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same shape: re-seeds the duration text input when the GM-tunable default changes.
    setDurationText(String(Math.max(1, Math.round(durationSeconds / 60))));
  }, [durationSeconds]);
  function parseDurationSeconds(input: string): number | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const colon = trimmed.match(/^(\d+):(\d{1,2})$/);
    if (colon) {
      const m = parseInt(colon[1]!, 10);
      const s = parseInt(colon[2]!, 10);
      if (Number.isFinite(m) && Number.isFinite(s) && s < 60) {
        return m * 60 + s;
      }
      return null;
    }
    const num = parseFloat(trimmed);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num * 60);
  }

  // Auto-fire end-round when timer hits 0 while running. The endpoint
  // is idempotent so multiple clients firing is harmless.
  const autoFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      isRunning &&
      remaining === 0 &&
      round &&
      autoFiredRef.current !== round.id
    ) {
      autoFiredRef.current = round.id;
      onEnd();
    }
  }, [isRunning, remaining, round, onEnd]);

  const startDisabledHint =
    !gameEnded && !isRunning && !canStart
      ? pairsCount === 0
        ? "Allocate at least one pair before starting a round."
        : "Start unavailable right now."
      : null;
  const errorMessage = actionError ? (ERROR_COPY[actionError] ?? actionError) : null;

  return (
    <>
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-white px-7">
      <div className="flex items-center gap-4">
        <Wordmark size={22} />
        <span className="h-5 w-px bg-[var(--color-line)]" />
        <div className="flex flex-col">
          <span className="text-[14px] font-bold">{workshopName}</span>
          <span className="t-mono text-[11px] text-[var(--color-ink-3)]">
            {/* Round-of-N copy collapses correctly when the GM has
                started a bonus round past the planned count: shows
                "round 2 · bonus" instead of the nonsensical
                "round 2 of 1". Complexity reads off the active round
                (or the game default when no round has started). */}
            {code} · {idx > roundCount
              ? `round ${idx} · bonus`
              : `round ${idx} of ${roundCount}`}
            {" · "}complexity {complexity}
          </span>
        </div>
        <RoleChip role="Game master" />
      </div>
      <div className="flex items-center gap-3">
        <span
          className="t-mono rounded-full px-3.5 py-2 text-[14px] font-bold"
          aria-label="Round timer"
          style={{
            background: isLastTwoMinutes
              ? "var(--color-tint-red)"
              : "var(--color-paper-2)",
            color: isLastTwoMinutes ? "var(--color-t-red)" : "inherit",
            boxShadow: isLastTwoMinutes
              ? "inset 0 0 0 1.5px var(--color-t-red)"
              : "none",
            animation: isLastTwoMinutes
              ? "tessera-jiggle 700ms ease-in-out infinite"
              : "none",
            transition: "background 200ms, color 200ms",
          }}
        >
          ⏱ {formatDuration(remaining)}
        </span>

        {isRunning && (
          <div className="flex items-center gap-1">
            {[
              { label: "+30s", delta: 30 },
              { label: "+1m", delta: 60 },
              { label: "+2m", delta: 120 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => onExtend(b.delta)}
                disabled={busy}
                className="t-mono rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
                style={{
                  background: "var(--color-tint-blue)",
                  color: "var(--color-t-blue)",
                  border: "1.5px solid var(--color-t-blue)",
                }}
                aria-label={`Add ${b.delta} seconds to the timer`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        {gameEnded ? (
          <span
            className="t-mono rounded-full px-4 py-2 text-[12px] font-bold"
            style={{
              background: "var(--color-tint-green)",
              color: "var(--color-t-green)",
            }}
          >
            game ended
          </span>
        ) : isRunning ? (
          <button
            type="button"
            className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
            onClick={onEnd}
            disabled={busy}
          >
            {busy ? "Ending…" : "End round"}
          </button>
        ) : (
          // Single between-rounds cluster covering both "more rounds
          // planned" and "all rounds done" states. The original layout
          // had two separate End-game CTAs (a prominent button when
          // allRoundsDone + a small underlined link otherwise) and no
          // way to start a bonus round once the planned count was
          // reached. Backend has no hard cap on round count — a
          // facilitator can keep going as long as the room is engaged
          // — so the UI surfaces a single "Start round N" CTA in
          // either state and a single quiet "End game" affordance.
          <div className="flex items-center gap-2">
            {allRoundsDone && (
              <span
                className="t-mono rounded-full bg-[var(--color-tint-yellow)] px-3 py-1.5 text-[11px] font-bold"
                style={{ color: "#7a5b00" }}
                title={`All ${roundCount} planned round${roundCount === 1 ? "" : "s"} have finished — bonus rounds are still allowed.`}
              >
                all planned rounds done
              </span>
            )}
            <div
              className="t-mono flex items-center gap-1 rounded-full bg-[var(--color-paper-2)] px-2 py-1 text-[11px] font-bold"
              title="Round complexity"
            >
              <span style={{ color: "var(--color-ink-3)" }}>complexity</span>
              <button
                type="button"
                onClick={() => bumpComplexity(-1)}
                disabled={busy || startComplexity <= 1}
                className="grid h-5 w-5 place-items-center rounded-full bg-white text-[12px] font-bold disabled:opacity-50"
                style={{ border: "1.5px solid var(--color-line)" }}
                aria-label="Decrease complexity"
              >
                −
              </button>
              <span style={{ minWidth: 14, textAlign: "center" }}>
                {startComplexity}
              </span>
              <button
                type="button"
                onClick={() => bumpComplexity(+1)}
                disabled={busy || startComplexity >= 8}
                className="grid h-5 w-5 place-items-center rounded-full bg-white text-[12px] font-bold disabled:opacity-50"
                style={{ border: "1.5px solid var(--color-line)" }}
                aria-label="Increase complexity"
              >
                +
              </button>
            </div>
            <label
              className="t-mono flex items-center gap-1 rounded-full bg-[var(--color-paper-2)] px-2 py-1 text-[11px] font-bold"
              title="Round duration — minutes, or m:ss (e.g. 2:30). Server enforces a 60s minimum."
            >
              <span style={{ color: "var(--color-ink-3)" }}>duration</span>
              <input
                type="text"
                inputMode="decimal"
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                onBlur={(e) => {
                  const parsed = parseDurationSeconds(e.target.value);
                  if (parsed === null) {
                    setDurationText(
                      String(Math.max(1, Math.round(durationSeconds / 60))),
                    );
                  }
                }}
                disabled={busy}
                className="t-mono rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[var(--color-ink)] outline-none disabled:opacity-50"
                style={{
                  border: "1.5px solid var(--color-line)",
                  width: 56,
                  textAlign: "center",
                }}
                aria-label="Round duration in minutes"
              />
              <span style={{ color: "var(--color-ink-3)" }}>min</span>
            </label>
            <button
              type="button"
              className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
              onClick={() => {
                const parsed = parseDurationSeconds(durationText);
                onStart(
                  startComplexity,
                  parsed !== null ? parsed : undefined,
                );
              }}
              disabled={!canStart || busy}
              title={canStart ? undefined : "Allocate at least one pair first."}
            >
              {busy
                ? "Starting…"
                : allRoundsDone
                  ? `Start bonus round ${nextIdx} →`
                  : `Start round ${nextIdx} →`}
            </button>
            <button
              type="button"
              onClick={onEndGame}
              disabled={busy}
              className="t-mono rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--color-ink-2)] disabled:opacity-50"
              style={{ border: "1.5px solid var(--color-line)" }}
              title="Close the game out — final leaderboard + debrief view."
            >
              End game
            </button>
          </div>
        )}
      </div>
    </header>
    {(errorMessage || startDisabledHint) && (
      <div
        className="flex items-center gap-2 border-b border-[var(--color-line)] px-7 py-2 text-[12px]"
        style={{
          background: errorMessage
            ? "var(--color-tint-red)"
            : "var(--color-tint-yellow)",
          color: errorMessage ? "var(--color-t-red)" : "#7a5b00",
        }}
        role={errorMessage ? "alert" : undefined}
      >
        <span aria-hidden="true">{errorMessage ? "⚠" : "ℹ"}</span>
        <span className="flex-1 font-semibold">
          {errorMessage ?? startDisabledHint}
        </span>
      </div>
    )}
    </>
  );
}

function useTimer(round: LobbyRound | null, fallbackDuration: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!round || round.status !== "running" || !round.started_at) {
    return fallbackDuration;
  }
  const startedMs = new Date(round.started_at).getTime();
  const elapsed = Math.floor((now - startedMs) / 1000);
  return Math.max(0, round.duration_seconds - elapsed);
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
