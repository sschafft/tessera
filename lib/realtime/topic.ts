/**
 * Shared between server (publish) and client (subscribe). Kept in its
 * own module so the client code can import the helper without pulling
 * `server-only` along.
 */
export function topicFor(game_id: string): string {
  return `tessera:${game_id}`;
}
