"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BriefSource, TeamMode } from "@/lib/game/repository";
import type { TileColor } from "@/components/canvas/Tile";
import { MasterLobby } from "./MasterLobby";
import { PairsPanel } from "./PairsPanel";
import { TopBarControls } from "./TopBarControls";
import { AccelerantsRail, ScoringPanel } from "./AccelerantsRail";
import { EndGameModal } from "./EndGameModal";
import { GeminiFallbackModal } from "./GeminiFallbackModal";
import { GameEndedView } from "@/components/play/GameEndedView";
import { MasterPairView } from "./MasterPairView";
import { useGameEvents } from "@/lib/realtime/useGameEvents";

export interface LobbyParticipant {
  id: string;
  display_name: string;
  role: "lobby" | "builder" | "guider" | "observer" | "gm";
  pair_id: string | null;
  color: TileColor;
  joined_at: string;
}

export interface LobbyPair {
  id: string;
  builder_id: string | null;
  guider_id: string | null;
  created_at: string;
  briefs: {
    builder: { title: string; rules: string[] } | null;
    guider: { title: string; rules: string[] } | null;
  };
  /**
   * Live per-pair progress. Null when no round is running. Populated
   * by the lobby route when a round is active so the PairsPanel can
   * render a "✓ complete" overlay or "% correct" chip per row.
   */
  progress: {
    correct: number;
    total: number;
    placed: number;
    percent: number;
    complete: boolean;
    score: number;
  } | null;
}

export interface LobbyRound {
  id: string;
  index: number;
  complexity: number;
  duration_seconds: number;
  status: "pending" | "running" | "ended";
  started_at: string | null;
  ended_at: string | null;
}

export interface AccelerantEvent {
  kind: string;
  scope: "pair" | "all";
  pair_id: string | null;
  triggered_at: string;
}

interface LobbyResponse {
  code: string;
  game_id: string;
  workshop_name: string;
  team_mode: TeamMode;
  participant_cap: number;
  status: "lobby" | "running" | "ended" | "purged";
  round_count: number;
  scoring: {
    correct_pts: number;
    wrong_pts: number;
  };
  briefs_enabled: {
    builder: boolean;
    guider: boolean;
  };
  participants: LobbyParticipant[];
  pairs: LobbyPair[];
  round: LobbyRound | null;
  accelerant_events: AccelerantEvent[];
}

// Realtime broadcasts drive the freshness; this poll is a safety net
// for cases where the WS drops, the browser tab is backgrounded, or
// NEXT_PUBLIC_SUPABASE_ANON_KEY is missing client-side. Was 30s —
// playtest 2026-04-28 surfaced a 90s lag on the GM dashboard's
// accelerant counter (3× polling cycles for a missed broadcast),
// which made super-power triggers feel ambiguous in the moment.
// 10s matches PlayContent.POLL_MS and keeps the load trivial (one
// /lobby hit per 10s, single tab).
const POLL_MS = 10_000;

export interface MasterContentProps {
  code: string;
  teamMode: TeamMode;
  /** Initial workshop name from server-side render — used until first poll lands. */
  initialWorkshopName: string;
  /** Initial round count for the round counter in the top bar. */
  initialRoundCount: number;
  /** Default complexity from game settings — shown next to the round counter. */
  defaultComplexity: number;
  /** Initial round duration to display before any round starts. */
  initialDurationSeconds: number;
}

/**
 * Single client-side owner of the master dashboard's dynamic state.
 * Wraps the top-bar round controls and the sidebar (lobby + pairs).
 */
export function MasterContent({
  code,
  teamMode,
  initialWorkshopName,
  initialRoundCount,
  defaultComplexity,
  initialDurationSeconds,
}: MasterContentProps) {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [hostSessionLost, setHostSessionLost] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusedPairId, setFocusedPairId] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/lobby`, {
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        // GM session is gone — could be a torn cookie (player tab on
        // the same browser overwrote it), an expired session, or the
        // GM landing here with no session at all. Surface the host-
        // recover CTA instead of looping silently with an empty lobby.
        setHostSessionLost(true);
        setPollError(null);
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json: LobbyResponse = await res.json();
      setData(json);
      setPollError(null);
      setHostSessionLost(false);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "fetch failed");
    }
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await fetchSnapshot();
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchSnapshot]);

  // Realtime: refetch instantly on any game event.
  useGameEvents(data?.game_id ?? null, fetchSnapshot);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const allocate = useCallback(
    async (body: object) => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/games/${code}/lobby/allocate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        clearSelection();
        await fetchSnapshot();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "allocate failed");
      } finally {
        setBusy(false);
      }
    },
    [code, clearSelection, fetchSnapshot],
  );

  const triggerAccelerant = useCallback(
    async (
      kind: string,
      scope: "pair" | "all",
      pairId: string | null,
      payload?: Record<string, unknown>,
    ) => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/games/${code}/accelerants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, scope, pair_id: pairId, payload }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        await fetchSnapshot();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "accelerant failed",
        );
      } finally {
        setBusy(false);
      }
    },
    [code, fetchSnapshot],
  );

  const rerollBrief = useCallback(
    async (pairId: string, role: "builder" | "guider") => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/games/${code}/briefs/reroll`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pair_id: pairId, role }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        await fetchSnapshot();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "reroll failed");
      } finally {
        setBusy(false);
      }
    },
    [code, fetchSnapshot],
  );

  const [geminiFallback, setGeminiFallback] = useState<{
    failedRole: "builder" | "guider" | null;
  } | null>(null);

  const startRound = useCallback(
    async (
      override?: BriefSource,
      complexity?: number,
      durationSeconds?: number,
    ) => {
      setBusy(true);
      setActionError(null);
      try {
        const body: Record<string, unknown> = {};
        if (override) body.brief_source_override = override;
        if (typeof complexity === "number") body.complexity = complexity;
        if (typeof durationSeconds === "number")
          body.duration_seconds = durationSeconds;
        const res = await fetch(`/api/games/${code}/rounds/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 502) {
          const j = await res.json().catch(() => ({}));
          if (j?.error === "gemini_failed") {
            const failed: "builder" | "guider" | null =
              j.failed_role === "builder" || j.failed_role === "guider"
                ? j.failed_role
                : null;
            setGeminiFallback({ failedRole: failed });
            return;
          }
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || j.error || `status ${res.status}`);
        }
        setGeminiFallback(null);
        await fetchSnapshot();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "start failed");
      } finally {
        setBusy(false);
      }
    },
    [code, fetchSnapshot],
  );

  const startRoundDefault = useCallback(
    (complexity?: number, durationSeconds?: number) => {
      void startRound(undefined, complexity, durationSeconds);
    },
    [startRound],
  );

  const startWithLibrary = useCallback(() => {
    void startRound("library");
  }, [startRound]);

  const dismissGeminiFallback = useCallback(() => {
    setGeminiFallback(null);
  }, []);

  const endRound = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${code}/rounds/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      await fetchSnapshot();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "end failed");
    } finally {
      setBusy(false);
    }
  }, [code, fetchSnapshot]);

  const [endGameModalOpen, setEndGameModalOpen] = useState(false);

  const requestEndGame = useCallback(() => setEndGameModalOpen(true), []);
  const cancelEndGame = useCallback(() => setEndGameModalOpen(false), []);

  const confirmEndGame = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${code}/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      setEndGameModalOpen(false);
      await fetchSnapshot();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "end failed");
    } finally {
      setBusy(false);
    }
  }, [code, fetchSnapshot]);

  const extendRound = useCallback(
    async (deltaSeconds: number) => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/games/${code}/rounds/extend`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ delta_seconds: deltaSeconds }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        await fetchSnapshot();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "extend failed");
      } finally {
        setBusy(false);
      }
    },
    [code, fetchSnapshot],
  );

  const updateScoring = useCallback(
    async (patch: { correct_pts?: number; wrong_pts?: number }) => {
      // Apply locally first so the +/− buttons feel instant. Without
      // this, the panel's displayed value lags behind the click by the
      // round-trip + fetchSnapshot, which read as a broken button.
      setData((prev) =>
        prev
          ? {
              ...prev,
              scoring: {
                correct_pts: patch.correct_pts ?? prev.scoring.correct_pts,
                wrong_pts: patch.wrong_pts ?? prev.scoring.wrong_pts,
              },
            }
          : prev,
      );
      setActionError(null);
      try {
        const res = await fetch(`/api/games/${code}/scoring`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        await fetchSnapshot();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "scoring failed");
        await fetchSnapshot();
      }
    },
    [code, fetchSnapshot],
  );

  const replay = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${code}/replay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || j.error || `status ${res.status}`);
      }
      await fetchSnapshot();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "replay failed",
      );
    } finally {
      setBusy(false);
    }
  }, [code, fetchSnapshot]);

  const participants = useMemo(() => data?.participants ?? [], [data]);
  // Lobby panel = anyone unallocated (no pair) and not the GM. In
  // players_pick mode, players self-select a role at join (builder /
  // guider / observer); they're still in the lobby until paired.
  const lobbyMembers = useMemo(
    () =>
      participants.filter((p) => p.role !== "gm" && p.pair_id === null),
    [participants],
  );
  const pairs = useMemo(() => data?.pairs ?? [], [data]);

  // Auto-focus the first pair once one exists; clear focus if the pair
  // disappears (e.g. after a Shuffle). Sync state from a derived prop
  // (the pairs list) — there's no cleaner place for this since
  // MasterContent owns focusedPairId and the pairs list is fetched
  // async by the same component.
  useEffect(() => {
    if (!focusedPairId && pairs.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs focused-pair when the pairs list arrives or a Shuffle drops the focused row.
      setFocusedPairId(pairs[0]!.id);
    } else if (focusedPairId && !pairs.some((p) => p.id === focusedPairId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- same: focused row disappeared, snap to the first remaining pair.
      setFocusedPairId(pairs[0]?.id ?? null);
    }
  }, [pairs, focusedPairId]);

  const focusedPair = pairs.find((p) => p.id === focusedPairId) ?? null;

  const round = data?.round ?? null;
  const workshopName = data?.workshop_name ?? initialWorkshopName;
  const roundCount = data?.round_count ?? initialRoundCount;
  const cap = data?.participant_cap ?? 0;
  const gameEnded = data?.status === "ended";

  // Once the game has ended, the GM dashboard collapses to the same
  // debrief summary the players see, plus a primary "Start another
  // round" CTA + the standard "Back to home" + facilitator guide CTA.
  if (gameEnded) {
    return (
      <>
        <header
          className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-white px-7"
        >
          <div className="flex items-center gap-3 text-[14px]">
            <span className="t-mono text-[12px] text-[var(--color-ink-3)]">
              {code}
            </span>
            <span className="font-bold">{workshopName}</span>
            <span
              className="t-mono rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
              style={{
                background: "var(--color-tint-green)",
                color: "var(--color-t-green)",
              }}
            >
              game ended
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={replay}
              disabled={busy || pairs.length === 0}
              className="t-btn t-btn--primary t-btn--sm"
              title={
                pairs.length === 0
                  ? "No pairs to replay with."
                  : undefined
              }
            >
              {busy ? "Starting…" : "↻ Start another round"}
            </button>
          </div>
        </header>
        <div
          className="flex flex-1 flex-col items-center overflow-y-auto"
          style={{ background: "var(--color-paper-2)" }}
        >
          <GameEndedView code={code} workshopName={workshopName} />
          {actionError && (
            <p className="px-6 py-2 text-[12px] text-[var(--color-t-red)]">
              {actionError}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <TopBarControls
        code={code}
        workshopName={workshopName}
        roundCount={roundCount}
        complexity={round?.complexity ?? defaultComplexity}
        round={round}
        // While a round is running, surface its current duration (incl.
        // any +30s/+1m extensions) so the GM sees the live timer truth.
        // BETWEEN rounds, fall back to the game's configured default —
        // playtest 2026-04-28 caught a bug where extending round 1 by
        // +1m bumped the round-2 duration default from 8 to 9 min,
        // which read as the extension silently sticking past the round
        // it was scoped to.
        durationSeconds={
          round && round.status === "running"
            ? round.duration_seconds
            : initialDurationSeconds
        }
        canStart={
          pairs.length > 0 &&
          (round === null ||
            round.status === "ended" ||
            round.status === "pending")
        }
        gameEnded={data?.status === "ended"}
        allRoundsDone={
          round?.status === "ended" &&
          (round?.index ?? 0) >= (data?.round_count ?? roundCount)
        }
        busy={busy}
        actionError={actionError}
        pairsCount={pairs.length}
        onStart={startRoundDefault}
        onEnd={endRound}
        onEndGame={requestEndGame}
        onExtend={extendRound}
      />
      {hostSessionLost && (
        <div
          className="flex items-center gap-3 border-b border-[var(--color-line)] px-7 py-2.5 text-[13px]"
          style={{
            background: "var(--color-tint-red)",
            color: "var(--color-t-red)",
          }}
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          <span className="flex-1">
            <b>Your facilitator session was lost.</b> The lobby below may look
            empty even though players are still in the game. Recover via the
            host token you saved when you created this game.
          </span>
          <a
            href={`/host-recover/${code}`}
            className="t-mono rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--color-t-red)]"
            style={{ border: "1.5px solid var(--color-t-red)" }}
          >
            Recover host →
          </a>
        </div>
      )}
      {/* Layout has two phases:
          - Pre-round (no round yet, or round pending): single-column
            "setup" flow with numbered Step sections (invite → lobby
            → pairs → game settings). The super-power rail is hidden
            entirely — its mechanics light up only during a round, so
            showing them disabled is just visual noise. The whole
            column is centered with a max-width to keep the setup
            flow readable on wide displays.
          - Round running OR ended (debrief): three-column dashboard
            (320 lobby / 1fr focused pair / 360 super-power rail).
          User feedback 2026-04-28 explicitly asked for both: hide
          super-powers pre-round + add visible separation between
          invite / lobby / game-settings. */}
      {(() => {
        const hasRoundContent =
          round !== null && round.status !== "pending";
        if (!hasRoundContent) {
          return (
            <main
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
              style={{ background: "var(--color-paper)" }}
            >
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-5 py-6">
                <SetupStep step={1} title="Invite players">
                  <MasterLobby
                    code={code}
                    teamMode={teamMode}
                    members={lobbyMembers}
                    cap={cap}
                    selected={selected}
                    toggleSelect={toggleSelect}
                    clearSelection={clearSelection}
                    pollError={pollError}
                    actionError={actionError}
                    busy={busy}
                    pairs={pairs}
                    participants={participants}
                    onAutoPairs={(count) =>
                      allocate({ kind: "auto_pairs", count })
                    }
                    onAutoObservers={() =>
                      allocate({ kind: "auto_observers" })
                    }
                    onPair={(builderId) => {
                      const arr = Array.from(selected);
                      if (arr.length !== 2) return;
                      allocate({
                        kind: "pair",
                        participant_ids: arr,
                        builder_id: builderId,
                      });
                    }}
                    onObserver={(pairId) =>
                      allocate({
                        kind: "observer",
                        participant_ids: Array.from(selected),
                        pair_id: pairId,
                      })
                    }
                  />
                </SetupStep>
                <SetupStep
                  step={2}
                  title="Pairs + observers"
                  hint={
                    pairs.length === 0
                      ? "No pairs yet — pair players above before starting a round."
                      : `${pairs.length} pair${pairs.length === 1 ? "" : "s"} ready.`
                  }
                >
                  <PairsPanel
                    pairs={pairs}
                    participants={participants}
                    focusedPairId={focusedPairId}
                    onFocus={setFocusedPairId}
                  />
                </SetupStep>
                <SetupStep
                  step={3}
                  title="Game settings"
                  hint="Tune scoring before round 1. The super-power rail unlocks once a round is live."
                >
                  <ScoringPanel
                    correctPts={data?.scoring.correct_pts ?? 10}
                    wrongPts={data?.scoring.wrong_pts ?? 0}
                    busy={busy}
                    retroactive={false}
                    onChange={updateScoring}
                  />
                </SetupStep>
              </div>
            </main>
          );
        }
        return (
          <div
            className="grid min-h-0 flex-1"
            style={{ gridTemplateColumns: "320px 1fr 360px" }}
          >
            <aside className="flex flex-col border-r border-[var(--color-line)] bg-white">
              <MasterLobby
                code={code}
                teamMode={teamMode}
                members={lobbyMembers}
                cap={cap}
                selected={selected}
                toggleSelect={toggleSelect}
                clearSelection={clearSelection}
                pollError={pollError}
                actionError={actionError}
                busy={busy}
                pairs={pairs}
                participants={participants}
                onAutoPairs={(count) =>
                  allocate({ kind: "auto_pairs", count })
                }
                onAutoObservers={() => allocate({ kind: "auto_observers" })}
                onPair={(builderId) => {
                  const arr = Array.from(selected);
                  if (arr.length !== 2) return;
                  allocate({
                    kind: "pair",
                    participant_ids: arr,
                    builder_id: builderId,
                  });
                }}
                onObserver={(pairId) =>
                  allocate({
                    kind: "observer",
                    participant_ids: Array.from(selected),
                    pair_id: pairId,
                  })
                }
              />
              <PairsPanel
                pairs={pairs}
                participants={participants}
                focusedPairId={focusedPairId}
                onFocus={setFocusedPairId}
              />
            </aside>

            <main
              className="flex flex-col gap-4 overflow-y-auto p-6"
              style={{ background: "var(--color-paper-2)" }}
            >
              {focusedPair && data?.game_id ? (
                <MasterPairView
                  code={code}
                  gameId={data.game_id}
                  pairId={focusedPair.id}
                  onReroll={rerollBrief}
                  busy={busy}
                />
              ) : (
                <FocusedPairPlaceholder round={round} pairs={pairs.length} />
              )}
            </main>

            <aside className="flex flex-col border-l border-[var(--color-line)] bg-white">
              <AccelerantsRail
                events={data?.accelerant_events ?? []}
                roundRunning={round?.status === "running"}
                focusedPair={focusedPair}
                busy={busy}
                scoreRetuneIsRetroactive={
                  round?.status === "running" && pairs.length > 0
                }
                scoring={data?.scoring ?? { correct_pts: 10, wrong_pts: 0 }}
                briefsEnabled={
                  data?.briefs_enabled ?? { builder: true, guider: true }
                }
                onTrigger={triggerAccelerant}
                onScoring={updateScoring}
              />
            </aside>
          </div>
        );
      })()}
      <EndGameModal
        open={endGameModalOpen}
        busy={busy}
        onConfirm={confirmEndGame}
        onCancel={cancelEndGame}
      />
      <GeminiFallbackModal
        open={geminiFallback !== null}
        busy={busy}
        failedRole={geminiFallback?.failedRole ?? null}
        onUseLibrary={startWithLibrary}
        onCancel={dismissGeminiFallback}
      />
    </>
  );
}

function SetupStep({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="t-card flex flex-col overflow-hidden"
      style={{
        background: "#fff",
        border: "1.5px solid var(--color-line)",
        boxShadow: "0 3px 0 rgba(0,0,0,.05)",
      }}
    >
      <header
        className="flex items-baseline gap-3 border-b border-[var(--color-line)] px-5 py-3"
        style={{ background: "var(--color-paper)" }}
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
          style={{
            background: "var(--color-ink)",
            color: "var(--color-paper)",
          }}
        >
          {step}
        </span>
        <h2 className="t-display text-[15px] font-bold leading-none">
          {title}
        </h2>
        {hint && (
          <span className="t-mono ml-auto text-[11px] text-[var(--color-ink-3)]">
            {hint}
          </span>
        )}
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function FocusedPairPlaceholder({
  round,
  pairs,
}: {
  round: LobbyRound | null;
  pairs: number;
}) {
  // Pre-round the placeholder card stretches to fill the full centre
  // column instead of hugging its content. Otherwise the GM sees a
  // small "Waiting for the round to start" rectangle at the top with
  // a wide expanse of paper-2 below it — visually unfinished, and the
  // empty space carries no information. flex-1 lets the card grow,
  // and the inner content stays vertically centred via my-auto.
  return (
    <div className="t-card flex flex-1 flex-col items-center gap-3 px-8 py-16 text-center">
      <div className="my-auto flex flex-col items-center gap-3">
        <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
          FOCUSED PAIR
        </div>
        {round?.status === "running" ? (
          <h2 className="t-display text-2xl">
            Round {round.index} live · {pairs} pair{pairs === 1 ? "" : "s"}
          </h2>
        ) : (
          <>
            <h2 className="t-display text-2xl">Waiting for the round to start</h2>
            <p className="max-w-md text-[14px] text-[var(--color-ink-2)]">
              Once you allocate pairs in the sidebar, the <b>Start round</b>{" "}
              button up top generates a fresh goal pattern for each pair and the
              briefs in play appear here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}


