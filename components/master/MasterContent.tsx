"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TeamMode } from "@/lib/game/repository";
import type { TileColor } from "@/components/canvas/Tile";
import { MasterLobby } from "./MasterLobby";
import { PairsPanel } from "./PairsPanel";
import { TopBarControls } from "./TopBarControls";
import { AccelerantsRail } from "./AccelerantsRail";
import { EndGameModal } from "./EndGameModal";
import { GameEndedView } from "@/components/play/GameEndedView";
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
  participants: LobbyParticipant[];
  pairs: LobbyPair[];
  round: LobbyRound | null;
  accelerant_events: AccelerantEvent[];
}

// Realtime broadcasts drive the freshness; this poll is a safety net.
const POLL_MS = 30_000;

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusedPairId, setFocusedPairId] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/lobby`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json: LobbyResponse = await res.json();
      setData(json);
      setPollError(null);
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

  const startRound = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${code}/rounds/start`, {
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
      setActionError(err instanceof Error ? err.message : "start failed");
    } finally {
      setBusy(false);
    }
  }, [code, fetchSnapshot]);

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
  // disappears (e.g. after a Shuffle).
  useEffect(() => {
    if (!focusedPairId && pairs.length > 0) {
      setFocusedPairId(pairs[0]!.id);
    } else if (focusedPairId && !pairs.some((p) => p.id === focusedPairId)) {
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
        durationSeconds={round?.duration_seconds ?? initialDurationSeconds}
        canStart={pairs.length > 0 && (round === null || round.status === "ended")}
        gameEnded={data?.status === "ended"}
        allRoundsDone={
          round?.status === "ended" &&
          (round?.index ?? 0) >= (data?.round_count ?? roundCount)
        }
        busy={busy}
        onStart={startRound}
        onEnd={endRound}
        onEndGame={requestEndGame}
      />
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
            onAuto={() => allocate({ kind: "auto" })}
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
          {focusedPair ? (
            <FocusedPairCard
              pair={focusedPair}
              participants={participants}
              round={round}
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
            onTrigger={triggerAccelerant}
          />
        </aside>
      </div>
      <EndGameModal
        open={endGameModalOpen}
        busy={busy}
        onConfirm={confirmEndGame}
        onCancel={cancelEndGame}
      />
    </>
  );
}

function FocusedPairPlaceholder({
  round,
  pairs,
}: {
  round: LobbyRound | null;
  pairs: number;
}) {
  return (
    <div className="t-card flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
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
  );
}

function FocusedPairCard({
  pair,
  participants,
  round,
  onReroll,
  busy,
}: {
  pair: LobbyPair;
  participants: LobbyParticipant[];
  round: LobbyRound | null;
  onReroll: (pairId: string, role: "builder" | "guider") => void;
  busy: boolean;
}) {
  const builder =
    pair.builder_id !== null
      ? participants.find((p) => p.id === pair.builder_id) ?? null
      : null;
  const guider =
    pair.guider_id !== null
      ? participants.find((p) => p.id === pair.guider_id) ?? null
      : null;
  const pairName = `${builder?.display_name ?? "?"} ↔ ${guider?.display_name ?? "?"}`;
  const running = round?.status === "running";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
            FOCUSED PAIR
          </div>
          <h2 className="t-display mt-1 text-[28px]">{pairName}</h2>
        </div>
      </div>

      <div className="t-card p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
            Briefs in play (only you see both)
          </span>
        </div>
        {running ? (
          <div className="grid grid-cols-2 gap-3.5">
            <BriefCard
              role="builder"
              brief={pair.briefs.builder}
              onReroll={() => onReroll(pair.id, "builder")}
              busy={busy}
            />
            <BriefCard
              role="guider"
              brief={pair.briefs.guider}
              onReroll={() => onReroll(pair.id, "guider")}
              busy={busy}
            />
          </div>
        ) : (
          <p className="text-[13px] text-[var(--color-ink-3)]">
            Briefs spin up when you start the round.
          </p>
        )}
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

