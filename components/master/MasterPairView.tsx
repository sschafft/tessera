"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { Avatar } from "@/components/primitives/Avatar";
import type { TileColor, TileShape } from "@/components/canvas/Tile";
import { useGameEvents } from "@/lib/realtime/useGameEvents";

interface PairSnapshot {
  pair_id: string;
  round: {
    id: string;
    index: number;
    complexity: number;
    status: "pending" | "running" | "ended";
    duration_seconds: number;
    started_at: string | null;
    ended_at: string | null;
  } | null;
  goal: Array<{
    shape: TileShape;
    color: TileColor;
    q: number;
    r: number;
    rot: number;
  }>;
  placements: Array<{
    id: string;
    shape: TileShape;
    color: TileColor;
    q: number;
    r: number;
    rot: number;
    correct: boolean;
  }>;
  accuracy: { correct: number; total: number } | null;
  builder_name: string | null;
  builder_color: TileColor | null;
  guider_name: string | null;
  guider_color: TileColor | null;
  builder_brief: { title: string; rules: string[] } | null;
  guider_brief: { title: string; rules: string[] } | null;
}

export interface MasterPairViewProps {
  code: string;
  gameId: string;
  pairId: string;
  onReroll: (pairId: string, role: "builder" | "guider") => void;
  busy: boolean;
}

/**
 * GM-as-observer view of a single focused pair. Two canvases side-by-
 * side (builder build + goal), accuracy gauge, both briefs as cards
 * with re-roll. Lives in the master dashboard's centre column; the
 * accelerant rail on the right is unaffected.
 */
export function MasterPairView({
  code,
  gameId,
  pairId,
  onReroll,
  busy,
}: MasterPairViewProps) {
  const [snap, setSnap] = useState<PairSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSnap = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/games/${code}/pairs/${pairId}/snapshot`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json: PairSnapshot = await res.json();
      setSnap(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    }
  }, [code, pairId]);

  // Refetch on pair change + on every realtime tick.
  useEffect(() => {
    setSnap(null);
    void fetchSnap();
  }, [fetchSnap]);
  useGameEvents(gameId, fetchSnap);

  const showCoords = (snap?.round?.complexity ?? 5) <= 4;
  const pairName = `${snap?.builder_name ?? "?"} ↔ ${snap?.guider_name ?? "?"}`;
  const noRound = snap !== null && snap.round === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
            FOCUSED PAIR · OBSERVING
          </div>
          <h2 className="t-display mt-1 flex items-center gap-2 text-[28px]">
            <span className="flex items-center gap-1">
              {snap?.builder_color && snap?.builder_name && (
                <Avatar
                  name={snap.builder_name}
                  color={snap.builder_color}
                  size={28}
                />
              )}
              {snap?.guider_color && snap?.guider_name && (
                <span className="-ml-2">
                  <Avatar
                    name={snap.guider_name}
                    color={snap.guider_color}
                    size={28}
                  />
                </span>
              )}
            </span>
            <span className="ml-1">{pairName}</span>
          </h2>
        </div>
        {snap?.accuracy && (snap.accuracy.total ?? 0) > 0 && (
          <span
            className="t-mono rounded-full px-3.5 py-2 text-[13px] font-bold"
            style={{
              background:
                snap.accuracy.correct === snap.accuracy.total
                  ? "var(--color-tint-green)"
                  : "var(--color-paper-2)",
              color:
                snap.accuracy.correct === snap.accuracy.total
                  ? "var(--color-t-green)"
                  : "var(--color-ink)",
            }}
          >
            ✓ {snap.accuracy.correct} / {snap.accuracy.total}
          </span>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}

      {/* Canvases */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="t-card flex flex-col items-center gap-2 p-3">
          <PaneHeader
            title="Builder"
            subtitle={
              snap?.placements && snap.placements.length > 0
                ? `${snap.placements.length} placed`
                : "no placements"
            }
            color="orange"
          />
          <CanvasScale>
            <PlayCanvas
              pieces={snap?.placements ?? []}
              complexity={snap?.round?.complexity ?? 5}
              showCoords={showCoords}
            />
          </CanvasScale>
        </div>
        <div className="t-card flex flex-col items-center gap-2 p-3">
          <PaneHeader title="Goal" subtitle="only the guider sees this" color="blue" />
          <CanvasScale>
            <PlayCanvas
              pieces={snap?.goal ?? []}
              complexity={snap?.round?.complexity ?? 5}
              showCoords={showCoords}
            />
          </CanvasScale>
        </div>
      </div>

      {noRound && (
        <p className="t-card px-4 py-3 text-[12px] text-[var(--color-ink-3)]">
          No round started yet. Start a round to populate canvases + briefs.
        </p>
      )}

      {/* Briefs (only the GM sees both) */}
      <div className="t-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
            Briefs in play (only you see both)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BriefCard
            role="builder"
            brief={snap?.builder_brief ?? null}
            onReroll={() => onReroll(pairId, "builder")}
            busy={busy}
          />
          <BriefCard
            role="guider"
            brief={snap?.guider_brief ?? null}
            onReroll={() => onReroll(pairId, "guider")}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}

function PaneHeader({
  title,
  subtitle,
  color,
}: {
  title: string;
  subtitle: string;
  color: "orange" | "blue";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: `var(--color-t-${color})` }}
      />
      <span className="text-[13px] font-bold">{title}</span>
      <span className="text-[12px] text-[var(--color-ink-3)]">· {subtitle}</span>
    </div>
  );
}

/**
 * Wraps PlayCanvas in a fixed-aspect downscale so two canvases fit
 * comfortably side-by-side in the centre column without scrolling.
 */
function CanvasScale({ children }: { children: React.ReactNode }) {
  // 0.78 keeps coordinate labels and tile shadows readable while
  // letting two canvases share the width.
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transform: "scale(0.78)",
          transformOrigin: "top center",
          width: "fit-content",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BriefCard({
  role,
  brief,
  onReroll,
  busy,
}: {
  role: "builder" | "guider";
  brief: { title: string; rules: string[] } | null;
  onReroll: () => void;
  busy: boolean;
}) {
  const isBuilder = role === "builder";
  return (
    <div
      className="rounded-[12px] border-[1.5px] p-3.5"
      style={{
        background: isBuilder
          ? "var(--color-tint-orange)"
          : "var(--color-tint-blue)",
        borderColor: isBuilder ? "var(--color-t-orange)" : "var(--color-t-blue)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="t-mono text-[10px] font-bold tracking-widest"
          style={{
            color: isBuilder ? "var(--color-t-orange)" : "var(--color-t-blue)",
          }}
        >
          ● {role.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onReroll}
          disabled={busy}
          className="t-mono text-[10px] text-[var(--color-ink-3)] underline disabled:opacity-50"
        >
          re-roll
        </button>
      </div>
      <div
        className="t-display mb-2 text-[15px] font-bold"
        style={{ color: "var(--color-ink)" }}
      >
        {brief?.title ?? "(off — toggle in game settings)"}
      </div>
      {brief && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-[var(--color-ink-2)]">
          {brief.rules.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
