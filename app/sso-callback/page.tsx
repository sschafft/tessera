"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Clerk's required landing page after an OAuth provider redirects
 * back. AuthenticateWithRedirectCallback finishes the sign-in dance
 * and then routes the browser to the `redirectUrlComplete` value the
 * caller passed to `signIn.authenticateWithRedirect`.
 *
 * No UI — Clerk handles the redirect synchronously. A momentary blank
 * page is the right behaviour here; staying on this URL means the
 * callback failed.
 */
export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
