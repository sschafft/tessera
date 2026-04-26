import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

/**
 * Cookie strategy (per TDD §5.1):
 * - One cookie per game named `ts_<code-without-hyphen>` so multiple games in
 *   the same browser don't collide.
 * - HttpOnly + Secure + SameSite=Lax so it works on top-level navigation
 *   (joining a game via a link) but isn't readable from JS.
 * - Path `/` so it gets sent to `/api/*` routes.
 * - Expiry matches the JWT (4h).
 */
export function cookieName(code: string): string {
  return `ts_${code.replace(/-/g, "")}`;
}

export interface SetCookieOptions {
  /** Defaults to true. Override only for tests against http://localhost. */
  secure?: boolean;
}

const FOUR_HOURS = 60 * 60 * 4;

export function sessionCookieAttributes(opts: SetCookieOptions = {}) {
  return {
    httpOnly: true,
    secure: opts.secure ?? process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: FOUR_HOURS,
  };
}

export function setSessionCookie(
  cookies: ResponseCookies,
  code: string,
  token: string,
  opts: SetCookieOptions = {},
): void {
  cookies.set(cookieName(code), token, sessionCookieAttributes(opts));
}

export function readSessionCookie(
  cookies: ReadonlyRequestCookies | ResponseCookies,
  code: string,
): string | undefined {
  return cookies.get(cookieName(code))?.value;
}

export function clearSessionCookie(
  cookies: ResponseCookies,
  code: string,
): void {
  cookies.set(cookieName(code), "", {
    ...sessionCookieAttributes(),
    maxAge: 0,
  });
}
