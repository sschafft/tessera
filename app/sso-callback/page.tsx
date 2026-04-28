"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// NEXT_PUBLIC_* env vars are inlined at build time. When the Clerk
// publishable key is missing at build, the root layout doesn't mount
// <ClerkProvider>, and AuthenticateWithRedirectCallback would throw
// during static prerender. Returning null in that case lets the
// build complete; on properly-configured deployments the key IS
// present, the layout mounts ClerkProvider, and the Clerk component
// runs as expected.
const CLERK_AVAILABLE = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

/**
 * Clerk's required landing page after an OAuth provider redirects
 * back. AuthenticateWithRedirectCallback finishes the sign-in dance
 * and then routes the browser to the `redirectUrlComplete` value the
 * caller passed to `signIn.sso()`.
 *
 * No UI — Clerk handles the redirect synchronously. A momentary blank
 * page is the right behaviour here; staying on this URL means the
 * callback failed.
 */
export default function SSOCallbackPage() {
  if (!CLERK_AVAILABLE) return null;
  return <AuthenticateWithRedirectCallback />;
}
