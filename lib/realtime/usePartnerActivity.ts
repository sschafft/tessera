"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useGameEvents, type GameEventDetail } from "./useGameEvents";

/**
 * Track the most recent realtime event from the player's partner so a
 * tiny "active now" dot can ride alongside the partner avatar.
 *
 * Currently only the guider gets a useful signal: builders fire a
 * stream of `placement_*` / `test_result` events as they place pieces,
 * which are unambiguously theirs. Guiders don't issue their own state
 * mutations, so the builder's "partner is active" surface needs a
 * server-side presence channel to be honest — out of scope here.
 *
 * Returns `null` when nothing has fired yet, otherwise a wallclock ms
 * timestamp. The caller decides the freshness window (e.g. 30 s).
 */
const PARTNER_EVENT_KINDS_FOR_GUIDER: ReadonlySet<string> = new Set([
  "placement_added",
  "placement_moved",
  "placement_removed",
  "placement_changed",
  "test_result",
]);

export function usePartnerActivity(
  gameId: string | null | undefined,
  myRole: "builder" | "guider" | null | undefined,
): number | null {
  const [lastActiveAt, setLastActiveAt] = useState<number | null>(null);
  // Mirror via a ref so the detail callback below stays stable for
  // useGameEvents (it captures via its own ref). Same useLayoutEffect
  // mirroring trick useGameEvents uses internally.
  const myRoleRef = useRef(myRole);
  useLayoutEffect(() => {
    myRoleRef.current = myRole;
  });

  useGameEvents(gameId, () => {}, (detail: GameEventDetail) => {
    if (myRoleRef.current !== "guider") return;
    if (!PARTNER_EVENT_KINDS_FOR_GUIDER.has(detail.kind)) return;
    setLastActiveAt(Date.now());
  });

  return lastActiveAt;
}
