"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { topicFor } from "./topic";

export interface GameEventDetail {
  /**
   * Event kind from the publish call (e.g. "accelerant_triggered",
   * "placement_added"). The publisher always populates this; the
   * subscriber may still see a raw `payload` body via Supabase
   * Realtime's wrapper, but `kind` is what we key UI off.
   */
  kind: string;
  /** Per-event payload from the publisher; shape varies by kind. */
  payload: Record<string, unknown>;
}

/**
 * Subscribe to the per-game broadcast topic and call `onEvent()`
 * whenever any mutation lands. The handler is debounced to 200ms so
 * a flurry of events (e.g. round start fan-out) coalesces into one
 * refetch.
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

    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        handlerRef.current();
      }, 200);
    };

    const channel = client
      .channel(topicFor(game_id))
      .on(
        "broadcast",
        { event: "*" },
        (msg: { event?: string; payload?: Record<string, unknown> }) => {
          fire();
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
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [game_id]);
}
