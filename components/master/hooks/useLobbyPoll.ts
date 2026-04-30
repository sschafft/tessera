"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameEvents } from "@/lib/realtime/useGameEvents";
import type { LobbyResponse } from "@/lib/game/lobby-response";

/**
 * Polling cadence — realtime broadcasts drive most freshness; this is
 * the safety net for cases where the WS drops, the browser tab is
 * backgrounded, or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing client-
 * side. Matches `PlayContent.POLL_MS` so GM and player tabs share the
 * same beat.
 */
const POLL_MS = 10_000;

export interface LobbyPollState {
  data: LobbyResponse | null;
  pollError: string | null;
  /** True when /lobby returned 401/403 — GM session is gone and the
   *  dashboard should show the host-recover banner. */
  hostSessionLost: boolean;
  fetchSnapshot: () => Promise<void>;
  /**
   * Setter for the underlying data state — exposed so callers can apply
   * optimistic local patches (e.g. scoring +/- buttons that need to
   * feel instant) before the server roundtrip. Treat it as a hatch for
   * the rare optimistic case; most mutations should rely on
   * `fetchSnapshot` to reconcile.
   */
  setData: React.Dispatch<React.SetStateAction<LobbyResponse | null>>;
}

/**
 * Owns the GM dashboard's lobby fetch loop: a fetchSnapshot callback,
 * the 10s polling interval, and a realtime subscription that triggers
 * a refetch on broadcast. Extracted from MasterContent in v1.2 so the
 * shape of the data + its lifecycle live in one place — the parent
 * component used to scatter `data`, `pollError`, `hostSessionLost`, the
 * fetch effect, and the useGameEvents call across 50 lines.
 *
 * The hook returns `data` (raw lobby response or null), `pollError`
 * (set when a fetch fails for a reason other than auth), and
 * `hostSessionLost` (set when /lobby returns 401/403 — GM session is
 * gone). `fetchSnapshot` is exposed so callers can fire a refetch
 * after a mutation lands.
 */
export function useLobbyPoll(code: string): LobbyPollState {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [hostSessionLost, setHostSessionLost] = useState(false);

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

  return { data, pollError, hostSessionLost, fetchSnapshot, setData };
}
