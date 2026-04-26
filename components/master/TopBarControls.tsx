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
  onStart: () => void;
  onEnd: () => void;
  onEndGame: () => void;
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
}: TopBarControlsProps) {
  const remaining = useTimer(round, durationSeconds);
  const isRunning = round?.status === "running";
  const isRoundEnded = round?.status === "ended";
  const idx = round?.index ?? 1;
  const nextIdx = isRoundEnded ? idx + 1 : idx;

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
            {code} · round {idx} of {roundCount} · complexity {complexity}
          </span>
        </div>
        <RoleChip role="Game master" />
      </div>
      <div className="flex items-center gap-3">
        <span
          className="t-mono rounded-full bg-[var(--color-paper-2)] px-3.5 py-2 text-[14px] font-bold"
          aria-label="Round timer"
        >
          ⏱ {formatDuration(remaining)}
        </span>

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
        ) : isRoundEnded && allRoundsDone ? (
          <button
            type="button"
            className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
            onClick={onEndGame}
            disabled={busy}
          >
            {busy ? "Ending…" : "End game"}
          </button>
        ) : (
          <button
            type="button"
            className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
            onClick={onStart}
            disabled={!canStart || busy}
            title={canStart ? undefined : "Allocate at least one pair first."}
          >
            {busy ? "Starting…" : `Start round ${nextIdx}`}
          </button>
        )}

        {!gameEnded && !isRunning && !isRoundEnded && (
          <button
            type="button"
            onClick={onEndGame}
            className="t-mono text-[10px] text-[var(--color-ink-3)] underline"
          >
            end game
          </button>
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
