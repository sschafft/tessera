/**
 * Shared URL helpers for the call/whiteboard surfaces.
 *
 * Some workshops are configured with placeholder URLs (`example.com`,
 * `localhost`) at game-create time — the player views shouldn't render
 * a CTA pointing at a dead destination. Three components used to
 * duplicate this filter (JoinCallCta, PlayTopBar, LobbyWaiting); this
 * is the single source of truth.
 */

const PLACEHOLDER_HOSTS: ReadonlySet<string> = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "127.0.0.1",
]);

export function isPlaceholderUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return [...PLACEHOLDER_HOSTS].some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return true;
  }
}

/** Returns the URL if it's usable, null otherwise. */
export function usableCallUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isPlaceholderUrl(url) ? null : url;
}
