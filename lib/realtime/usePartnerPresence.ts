"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Bidirectional partner presence on a Supabase Realtime presence
 * channel. Each tab `track`s its own participant id under
 * `tessera-presence:<game_id>`; every other tab on the same channel
 * gets sync events listing all currently-tracked pids.
 *
 * Returns `true` when `partnerPid` shows up in the presence state.
 * Replaces the earlier action-based `usePartnerActivity`, which was
 * guider-only because builder events were the only unambiguous
 * signal — presence works in both directions because it doesn't need
 * an action to fire.
 *
 * Channel is separate from the broadcast channel used by
 * `useGameEvents` so the presence join/leave traffic doesn't add
 * noise to event subscribers.
 */
export function usePartnerPresence(
  gameId: string | null | undefined,
  myPid: string | null | undefined,
  partnerPid: string | null | undefined,
): boolean {
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (!gameId || !myPid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset presence when the game/partner identity changes; cheap to flip and avoids stale-yes results across game switches.
      setPresent(false);
      return;
    }
    const client = getBrowserClient();
    if (!client) return;

    const channel = client.channel(`tessera-presence:${gameId}`, {
      config: { presence: { key: myPid } },
    });

    const sync = () => {
      if (!partnerPid) {
        setPresent(false);
        return;
      }
      const state = channel.presenceState();
      setPresent(Object.prototype.hasOwnProperty.call(state, partnerPid));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ pid: myPid });
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [gameId, myPid, partnerPid]);

  return present;
}
