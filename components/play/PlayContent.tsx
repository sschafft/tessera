"use client";

import { useCallback, useEffect, useState } from "react";
import type { TileColor, TileShape } from "@/components/canvas/Tile";
import type { GoalPattern } from "@/lib/pattern/types";

export interface PlacedPiece {
  id: string;
  shape: TileShape;
  color: TileColor;
  q: number;
  r: number;
  rot: number;
  /** Set when test_enabled is true; matches goal pattern equality. */
  correct?: boolean;
}

export interface BriefSummary {
  role: "builder" | "guider";
  title: string;
  rules: string[];
}
import { PlayTopBar } from "./PlayTopBar";
import { BuilderView } from "./BuilderView";
import { GuiderView } from "./GuiderView";
import { ObserverView } from "./ObserverView";
import { LobbyWaiting } from "./LobbyWaiting";

type PlayRole = "lobby" | "builder" | "guider" | "observer";

export interface PlayState {
  code: string;
  workshop_name: string;
  video_call_url: string;
  whiteboard_url: string | null;
  role: PlayRole;
  me: { id: string; display_name: string; role: PlayRole; color: TileColor };
  partner: {
    id: string;
    display_name: string;
    role: PlayRole;
    color: TileColor;
  } | null;
  pair: { id: string } | null;
  round: {
    id: string;
    index: number;
    complexity: number;
    duration_seconds: number;
    status: "pending" | "running" | "ended";
    started_at: string | null;
    ended_at: string | null;
  } | null;
  pair_round: {
    id: string;
    test_enabled: boolean;
    shares_remaining: number;
  } | null;
  goal: GoalPattern | null;
  placements: PlacedPiece[];
  /** Server-computed accuracy gauge when test_enabled is true. */
  accuracy: { correct: number; total: number } | null;
  test_enabled: boolean;
  briefs_revealed: boolean;
  brief: BriefSummary | null;
  /** Builder + guider see their partner's brief when revealed. */
  partner_brief: BriefSummary | null;
  /** Observers see both briefs when revealed. */
  observer_briefs: BriefSummary[] | null;
}

export interface PlayContentProps {
  code: string;
  initial: PlayState;
}

const POLL_MS = 2000;

export function PlayContent({ code, initial }: PlayContentProps) {
  const [state, setState] = useState<PlayState>(initial);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/play`, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json: PlayState = await res.json();
      setState(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    }
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!cancelled) await fetchState();
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchState]);

  const partnerForBar = state.partner
    ? {
        name: state.partner.display_name,
        color: state.partner.color,
        role: state.partner.role,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <PlayTopBar
        code={state.code}
        role={roleLabel(state.role)}
        partner={partnerForBar}
        round={state.round}
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
      <main className="flex flex-1 overflow-hidden">
        {state.role === "lobby" && <LobbyWaiting workshopName={state.workshop_name} />}
        {state.role === "builder" && <BuilderView state={state} />}
        {state.role === "guider" && <GuiderView state={state} />}
        {state.role === "observer" && <ObserverView state={state} />}
      </main>
      {error && (
        <p className="px-6 py-2 text-[11px] text-[var(--color-t-red)]">
          poll error · {error}
        </p>
      )}
    </div>
  );
}

function roleLabel(r: PlayRole) {
  switch (r) {
    case "builder":
      return "Builder" as const;
    case "guider":
      return "Guider" as const;
    case "observer":
      return "Observer" as const;
    default:
      return "Builder" as const;
  }
}
