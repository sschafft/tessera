"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { SuperPowerToast } from "./SuperPowerToast";
import { WelcomeToast } from "./WelcomeToast";
import { BriefsRevealedModal } from "./BriefsRevealedModal";
import { ReturnToMainModal } from "./ReturnToMainModal";

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
  video_call_url: string | null;
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
  pair: {
    id: string;
    display_name: string | null;
    /**
     * Per-pair breakout Meet URL. When set, this is the primary
     * "Join your pair's call" CTA on the lobby + play views; the
     * workshop-level `video_call_url` demotes to a small "main
     * room ↗" secondary link.
     */
    breakout_call_url: string | null;
  } | null;
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
  /**
   * Per-goal-piece correctness, parallel to `goal`. Null until
   * test_enabled fires (keeps the builder's correctness opt-in).
   * Drives the mirrored ✓ overlay on the guider's goal canvas so
   * they see which positions the builder has currently satisfied
   * without seeing the builder's wrong placements.
   */
  goal_correctness: boolean[] | null;
  /** Goal piece count — exposed to all roles for the builder progress counter. */
  goal_count: number;
  /**
   * How many pieces the builder has placed *right now*. Exposed to
   * every role (no layout leak); drives the guider's live progress
   * chip so they're not staring at a static board between Test/Share
   * events. Builder + observer also get the full layout via
   * `placements` below.
   */
  builder_placements_count: number;
  placements: PlacedPiece[];
  /** Server-computed accuracy gauge when test_enabled is true. */
  accuracy: { correct: number; total: number } | null;
  /**
   * Live-recomputed score against the current placements + scoring
   * config. Surfaced to builder + guider as the score tally chip
   * once test_enabled is on.
   */
  live_score: {
    score: number;
    correct: number;
    wrong: number;
    total: number;
    penalty_applied: boolean;
  } | null;
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
// is the safety net (e.g. when the WS connection drops, the browser
// pauses sockets, or NEXT_PUBLIC_SUPABASE_ANON_KEY isn't wired on the
// client). Was 30s — playtests showed round-2 transitions, observer
// counter updates, and lobby role-assignment refreshes all stalled
// for the full 30s window when realtime didn't reach the client.
// 10s is the right tradeoff: still negligible server load (one
// /play hit per player every 10s) and brings every "didn't see the
// change instantly" symptom inside acceptable workshop pacing.
const POLL_MS = 10_000;

export function PlayContent({ code, initial }: PlayContentProps) {
  const router = useRouter();
  const [state, setState] = useState<PlayState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [sessionLost, setSessionLost] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/play`, { cache: "no-store" });
      if (!res.ok) {
        // Stale-cookie cases the polling loop would otherwise spin on
        // forever. Read the body once so we can branch on the typed
        // error code.
        const body = await res.json().catch(() => ({}));
        if (body?.error === "gm_should_use_master") {
          // GM session ended up on /play (e.g. shared-cookie tooling
          // race, or the GM bookmarked the player URL). Push to the
          // master view where their cookie actually means something.
          router.replace(`/g/${code}/master`);
          return;
        }
        if (res.status === 401 || res.status === 403) {
          // Session is gone (cookie cleared, expired, or overwritten by
          // a different role's join). Surface a recovery banner instead
          // of looping silently on 401/403.
          setSessionLost(true);
          setError(null);
          return;
        }
        throw new Error(`status ${res.status}`);
      }
      const json: PlayState = await res.json();
      setState(json);
      setError(null);
      setSessionLost(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    }
  }, [code, router]);

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
        breakoutCallUrl={state.pair?.breakout_call_url ?? null}
      />
      <main className="relative flex flex-1 overflow-hidden">
        {renderBody(state)}
      </main>
      <SuperPowerToast gameId={state.game_id} />
      <WelcomeToast code={code} />
      <ReturnToMainModal gameId={state.game_id ?? null} />
      {state.partner_brief && state.round?.id && (
        <BriefsRevealedModal
          roundId={state.round.id}
          myBrief={state.brief}
          partnerBrief={state.partner_brief}
        />
      )}
      {sessionLost && (
        <SessionLostBanner code={code} />
      )}
      {error && !sessionLost && (
        <p className="px-6 py-2 text-[11px] text-[var(--color-ink-3)]">
          {/* User-facing copy that doesn't leak the raw HTTP status. */}
          Couldn&apos;t reach the game right now — retrying.
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
        breakoutCallUrl={state.pair?.breakout_call_url ?? null}
        roundInFlight={state.round?.status === "running"}
      />
    );
  }
  if (state.role === "builder") return <BuilderView state={state} />;
  if (state.role === "guider") return <GuiderView state={state} />;
  if (state.role === "observer") return <ObserverView state={state} />;
  return null;
}

/**
 * Banner the player sees when their cookie was wiped mid-game.
 * Prefer-recovery copy: re-joining with the same name fails the
 * uniqueness check (the original participant row is still there)
 * and lands on a confusing "name taken" error. The right path is
 * the one-shot recovery URL the player was prompted to save at
 * join time, which we also stash in localStorage as a fallback.
 * If localStorage has it, we surface a single-click recover link.
 */
function SessionLostBanner({ code }: { code: string }) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot localStorage read after mount; SSR has no window.
      setSavedUrl(window.localStorage.getItem(`tessera_recovery_${code}`));
    } catch {
      // localStorage disabled (private mode); the manual-paste copy
      // below covers it.
    }
  }, [code]);
  return (
    <div
      className="flex flex-col gap-1.5 border-t border-[var(--color-line)] px-6 py-3 text-[13px]"
      style={{ background: "var(--color-tint-red)", color: "var(--color-t-red)" }}
      role="alert"
    >
      <span className="font-bold">Your session for this game was lost.</span>
      {savedUrl ? (
        <span style={{ color: "#7a1818" }}>
          We have your recovery URL stashed in this browser —{" "}
          <a href={savedUrl} className="font-bold underline">
            click here to reclaim your seat
          </a>
          .
        </span>
      ) : (
        <span style={{ color: "#7a1818" }}>
          Paste the recovery URL you saved at join time into the address bar,
          or open{" "}
          <a href={`/recover/${code}`} className="font-bold underline">
            /recover/{code}
          </a>{" "}
          to enter your participant id + token manually. Re-joining with the
          same name won&apos;t work — the original seat is still on the roster.
        </span>
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
      // Lobby — no role assigned yet. Surface a neutral pill instead
      // of defaulting to "Builder" (which lied to players in
      // gm_picks mode).
      return null;
  }
}
