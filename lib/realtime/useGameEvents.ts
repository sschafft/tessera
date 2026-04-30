"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { topicFor } from "./topic";

export interface GameEventDetail {
  /**
   * Event kind from the publish call (e.g. "superpower_triggered",
   * "placement_added"). The publisher always populates this; the
   * subscriber may still see a raw `payload` body via Supabase
   * Realtime's wrapper, but `kind` is what we key UI off.
   */
  kind: string;
  /** Per-event payload from the publisher; shape varies by kind. */
  payload: Record<string, unknown>;
}

/**
 * Events that signal a placement-loop change on the canvas. We
 * service these on a tighter 50 ms debounce so the
 * place-piece → server-echo → swap window feels snappier on the
 * builder side. Burst placements still coalesce into a single
 * refetch (whichever event fires first arms the timer; subsequent
 * events within 50 ms are no-ops).
 *
 * Everything else (super-power triggers, brief reveals, scoring
 * tweaks, lobby allocation) goes through the slower 200 ms timer:
 * those events are less time-sensitive and the broader debounce
 * keeps the refetch fan-out humane on round-start storms.
 */
const FAST_EVENTS: ReadonlySet<string> = new Set([
  "placement_added",
  "placement_moved",
  "placement_removed",
  "placement_changed",
  "test_result",
]);

const FAST_DEBOUNCE_MS = 50;
const SLOW_DEBOUNCE_MS = 200;

/**
 * Subscribe to the per-game broadcast topic and call `onEvent()`
 * whenever any mutation lands. Two debounce lanes — placement-loop
 * events on a 50 ms timer (snappy reconciliation under the
 * optimistic UI), everything else on 200 ms (coalesces fan-out
 * storms). Both lanes are leading-edge: first event arms the
 * timer, subsequent events within the window are coalesced.
 *
 * Pass `onDetail` to also receive a per-event detail callback (NOT
 * debounced) — useful for transient UI banners ("GM fired Reveal
 * briefs") that need the kind/payload, not just a refetch trigger.
 *
 * Returns silently if Supabase env vars are missing — callers fall
 * back to the slower polling cadence.
 */
export function useGameEvents(
  game_id: string | null | undefined,
  onEvent: () => void,
  onDetail?: (detail: GameEventDetail) => void,
): void {
  // Mirror the latest handlers via refs so the subscribe effect
  // doesn't re-run every time the parent component recreates the
  // callback. useLayoutEffect runs synchronously after DOM commit but
  // before paint — strictly after render, so React's "no refs during
  // render" rule is satisfied.
  const handlerRef = useRef(onEvent);
  const detailRef = useRef<typeof onDetail>(onDetail);
  useLayoutEffect(() => {
    handlerRef.current = onEvent;
    detailRef.current = onDetail;
  });

  useEffect(() => {
    if (!game_id) return;
    const client = getBrowserClient();
    if (!client) return;

    let fastTimer: ReturnType<typeof setTimeout> | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    const fire = (fast: boolean) => {
      if (fast) {
        if (fastTimer) return;
        fastTimer = setTimeout(() => {
          fastTimer = null;
          handlerRef.current();
        }, FAST_DEBOUNCE_MS);
      } else {
        if (slowTimer) return;
        slowTimer = setTimeout(() => {
          slowTimer = null;
          handlerRef.current();
        }, SLOW_DEBOUNCE_MS);
      }
    };

    const channel = client
      .channel(topicFor(game_id))
      .on(
        "broadcast",
        { event: "*" },
        (msg: { event?: string; payload?: Record<string, unknown> }) => {
          fire(FAST_EVENTS.has(msg.event ?? ""));
          if (detailRef.current && msg.event) {
            detailRef.current({
              kind: msg.event,
              payload: msg.payload ?? {},
            });
          }
        },
      )
      .subscribe();

    return () => {
      if (fastTimer) clearTimeout(fastTimer);
      if (slowTimer) clearTimeout(slowTimer);
      client.removeChannel(channel);
    };
  }, [game_id]);
}
