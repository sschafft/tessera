"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamMode } from "@/lib/game/repository";
import type { TileColor } from "@/components/canvas/Tile";
import { MasterLobby } from "./MasterLobby";
import { PairsPanel } from "./PairsPanel";

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
}

interface LobbyResponse {
  code: string;
  workshop_name: string;
  team_mode: TeamMode;
  participant_cap: number;
  participants: LobbyParticipant[];
  pairs: LobbyPair[];
}

const POLL_MS = 2000;

export interface MasterDashboardProps {
  code: string;
  teamMode: TeamMode;
}

/**
 * Owns lobby polling state + multi-select. Renders the Lobby panel
 * above the Pairs panel in the sidebar. Allocation calls bypass the
 * 2 Hz poll cadence and trigger an immediate refresh on success.
 */
export function MasterDashboard({ code, teamMode }: MasterDashboardProps) {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

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
        setActionError(
          err instanceof Error ? err.message : "allocate failed",
        );
      } finally {
        setBusy(false);
      }
    },
    [code, clearSelection, fetchSnapshot],
  );

  const participants = data?.participants ?? [];
  const lobbyMembers = participants.filter((p) => p.role === "lobby");
  const pairs = data?.pairs ?? [];

  return (
    <>
      <MasterLobby
        code={code}
        teamMode={teamMode}
        members={lobbyMembers}
        cap={data?.participant_cap ?? 0}
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
      <PairsPanel pairs={pairs} participants={participants} />
    </>
  );
}
