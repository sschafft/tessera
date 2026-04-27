"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TileColor, TileShape } from "@/components/canvas/Tile";
import type { GoalPattern } from "@/lib/pattern/types";
import {
  enableAudio,
  playGameEnd,
  playLastTwoMinutes,
  playRoundEnd,
  playTimePressure,
} from "@/lib/sound";
import { useGameEvents } from "@/lib/realtime/useGameEvents";

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
import { RoundEndedView } from "./RoundEndedView";
import { GameEndedView } from "./GameEndedView";

type PlayRole = "lobby" | "builder" | "guider" | "observer";

export interface PlayState {
  code: string;
  game_id: string;
  workshop_name: string;
  video_call_url: string;
  whiteboard_url: string | null;
  game_status: "lobby" | "running" | "ended" | "purged";
  sound_on: boolean;
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
  /** Goal piece count — exposed to all roles for the builder progress counter. */
  goal_count: number;
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
  /** Prototype glimpse window for the builder; null when not active. */
  prototype: {
    goal: PlacedPiece[];
    ends_at: string;
  } | null;
  /** Most recent Agile-share snapshot from the builder; guider/observer only. */
  builder_snapshot: PlacedPiece[] | null;
  /** Remaining Agile shares; surfaced to the builder for their UI. */
  shares_remaining: number;
  /** Observer-only: list of pairs available to switch to. */
  available_pairs:
    | Array<{
        id: string;
        builder_name: string | null;
        guider_name: string | null;
      }>
    | null;
}

export interface PlayContentProps {
  code: string;
  initial: PlayState;
}

// Realtime broadcast handles the snappy updates; this polling cadence
// is the safety net (e.g. when the WS connection drops or the
// browser loses focus and pauses sockets).
const POLL_MS = 30_000;

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

  // Realtime: refetch instantly when any mutation lands.
  useGameEvents(state.game_id, fetchState);

  // Audio: arm on the first user click; trigger sound on state diffs.
  useEffect(() => {
    if (!state.sound_on) return;
    const onClick = () => {
      void enableAudio();
    };
    window.addEventListener("pointerdown", onClick, { once: true });
    return () => window.removeEventListener("pointerdown", onClick);
  }, [state.sound_on]);

  const prevRoundStatus = useRef<string | null | undefined>(state.round?.status);
  const prevDuration = useRef<number | undefined>(state.round?.duration_seconds);
  const prevGameStatus = useRef<string>(state.game_status);

  useEffect(() => {
    if (!state.sound_on) return;
    const cur = state.round?.status;
    // Round just ended: play the round-end ding (skip if game also ended).
    if (
      prevRoundStatus.current === "running" &&
      cur === "ended" &&
      state.game_status !== "ended"
    ) {
      playRoundEnd();
    }
    prevRoundStatus.current = cur;
  }, [state.round?.status, state.game_status, state.sound_on]);

  useEffect(() => {
    if (!state.sound_on) return;
    const cur = state.round?.duration_seconds;
    if (
      typeof prevDuration.current === "number" &&
      typeof cur === "number" &&
      cur < prevDuration.current &&
      state.round?.status === "running"
    ) {
      playTimePressure();
    }
    prevDuration.current = cur;
  }, [state.round?.duration_seconds, state.round?.status, state.sound_on]);

  useEffect(() => {
    if (!state.sound_on) return;
    if (prevGameStatus.current !== "ended" && state.game_status === "ended") {
      playGameEnd();
    }
    prevGameStatus.current = state.game_status;
  }, [state.game_status, state.sound_on]);

  // Last-two-minutes chime: ticks every second checking the live
  // remaining timer. Fires once per round when remaining first dips
  // below 120s. Re-arms whenever a new round starts.
  const lastTwoArmedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!state.sound_on) return;
    const round = state.round;
    if (!round || round.status !== "running" || !round.started_at) return;
    const startedMs = new Date(round.started_at).getTime();
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedMs) / 1000);
      const remaining = Math.max(0, round.duration_seconds - elapsed);
      if (remaining <= 120 && remaining > 60 && lastTwoArmedFor.current !== round.id) {
        lastTwoArmedFor.current = round.id;
        playLastTwoMinutes();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state.round, state.sound_on]);

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
      <main className="relative flex flex-1 overflow-hidden">
        {renderBody(state)}
      </main>
      {error && (
        <p className="px-6 py-2 text-[11px] text-[var(--color-t-red)]">
          poll error · {error}
        </p>
      )}
    </div>
  );
}

function renderBody(state: PlayState) {
  if (state.game_status === "ended") {
    return (
      <GameEndedView code={state.code} workshopName={state.workshop_name} />
    );
  }
  // Round ended but game still running → debrief view (everyone sees it).
  if (state.round?.status === "ended" && state.pair_round) {
    return <RoundEndedView state={state} />;
  }
  if (state.role === "lobby") {
    return (
      <LobbyWaiting
        workshopName={state.workshop_name}
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
    );
  }
  if (state.role === "builder") return <BuilderView state={state} />;
  if (state.role === "guider") return <GuiderView state={state} />;
  if (state.role === "observer") return <ObserverView state={state} />;
  return null;
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
