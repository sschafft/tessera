"use client";

import { useEffect, useState } from "react";
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
  busy: boolean;
  onStart: () => void;
}

export function TopBarControls({
  code,
  workshopName,
  roundCount,
  complexity,
  round,
  durationSeconds,
  canStart,
  busy,
  onStart,
}: TopBarControlsProps) {
  const remaining = useTimer(round, durationSeconds);
  const isRunning = round?.status === "running";
  const idx = round?.index ?? 1;

  return (
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
        {isRunning ? (
          <>
            <button
              className="t-btn t-btn--ghost t-btn--sm"
              disabled
              title="Pause lands in milestone 7"
            >
              Pause round
            </button>
            <button
              className="t-btn t-btn--primary t-btn--sm"
              disabled
              title="End round lands in milestone 7"
            >
              End round
            </button>
          </>
        ) : (
          <button
            type="button"
            className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
            disabled={!canStart || busy}
            onClick={onStart}
            title={canStart ? undefined : "Allocate at least one pair first."}
          >
            {busy ? "Starting…" : `Start round ${idx}`}
          </button>
        )}
      </div>
    </header>
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
