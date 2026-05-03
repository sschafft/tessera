/**
 * Shared URL helpers for the call/whiteboard surfaces.
 *
 * Two layers of defence:
 *
 *   1. `isHttpUrl` — boundary validator used by the create routes
 *      (`/api/games`, `/api/games/upload`). Rejects non-`http(s)`
 *      schemes outright so a `javascript:`, `data:`, or custom-scheme
 *      string can't even land in the database. Also flagged by the
 *      2026-05-03 tessera-tl review when the upload route was
 *      bypassing this check.
 *   2. `usableCallUrl` — render-time defence in depth. Even if a bad
 *      URL slipped through (custom backfill, manual DB edit), the
 *      player views won't surface it: only `http(s)` URLs that aren't
 *      placeholder hosts (`example.com`, `localhost`) get a clickable
 *      CTA.
 *
 * Three components used to duplicate the placeholder filter
 * (JoinCallCta, PlayTopBar, LobbyWaiting); this module is the single
 * source of truth.
 */

const PLACEHOLDER_HOSTS: ReadonlySet<string> = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "127.0.0.1",
]);

/**
 * True only when `url` is a syntactically-valid `http:` or `https:`
 * URL. Use at API boundaries before persisting any URL the user
 * submits; mirrors the validator that lived inline in
 * `app/api/games/route.ts`.
 */
export function isHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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
  if (!isHttpUrl(url)) return null;
  return isPlaceholderUrl(url) ? null : url;
}
