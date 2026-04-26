import "server-only";

import { topicFor } from "./topic";

/**
 * Server-side broadcast publisher. Uses the Supabase Realtime REST
 * endpoint so we don't have to manage a long-lived WebSocket from a
 * serverless function. Each call is one HTTP POST with the service-
 * role key as auth.
 *
 * Failure mode: log + swallow. Realtime is a freshness layer; if it
 * goes down, the 30-second polling fallback takes over.
 */
export async function publishGameEvent(
  game_id: string,
  kind: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: topicFor(game_id),
            event: kind,
            payload,
            private: false,
          },
        ],
      }),
      // Don't block the route handler on a slow Realtime endpoint.
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[realtime] publish failed: ${res.status} ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.warn("[realtime] publish error", err);
  }
}
