"use client";

import { useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { topicFor } from "./topic";

/**
 * Subscribe to the per-game broadcast topic and call `onEvent()`
 * whenever any mutation lands. The handler is debounced to 200ms so
 * a flurry of events (e.g. round start fan-out) coalesces into one
 * refetch.
 *
 * Returns silently if Supabase env vars are missing — callers fall
 * back to the slower polling cadence.
 */
export function useGameEvents(
  game_id: string | null | undefined,
  onEvent: () => void,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

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
      .on("broadcast", { event: "*" }, () => fire())
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    };
  }, [game_id]);
}
