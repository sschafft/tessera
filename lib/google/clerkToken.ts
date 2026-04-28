import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Pulls the Google access token for the currently signed-in Clerk
 * user. Tessera uses Clerk as the OAuth gateway for the breakouts
 * feature: the GM signs in with Google through Clerk's social
 * connection (configured in the Clerk Dashboard with the
 * `https://www.googleapis.com/auth/calendar.events` additional scope),
 * Clerk handles the consent + token-storage + token-refresh dance,
 * and we fetch the live access token here whenever we need to call
 * the Calendar API.
 *
 * Returns null when:
 *   - Clerk env vars aren't configured on this deployment.
 *   - No user is signed in to Clerk on this request.
 *   - The signed-in user doesn't have Google connected (or has
 *     revoked it).
 *
 * Routes should treat null as "GM needs to (re)sign in with Google"
 * and surface a re-auth CTA.
 */

export interface ClerkGoogleSession {
  userId: string;
  accessToken: string;
}

export class ClerkUnconfiguredError extends Error {
  constructor() {
    super("clerk_unconfigured");
    this.name = "ClerkUnconfiguredError";
  }
}

export function isClerkConfigured(): boolean {
  // Both the publishable + secret keys are required for Clerk to
  // function. NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is bundled into the
  // client; CLERK_SECRET_KEY is server-only.
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

/**
 * Read the current Clerk session and pull the user's Google OAuth
 * access token. Returns null when the user isn't signed in or hasn't
 * connected Google.
 */
export async function getGoogleAccessToken(): Promise<ClerkGoogleSession | null> {
  if (!isClerkConfigured()) throw new ClerkUnconfiguredError();
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  // The provider key follows Clerk's naming convention. The leading
  // `oauth_` prefix is required.
  const tokens = await client.users.getUserOauthAccessToken(
    userId,
    "google",
  );
  // Recent Clerk SDK returns { data: [...] } from this call; older
  // versions returned the array directly. Defensive read covers both.
  const list: Array<{ token?: string }> = Array.isArray(
    (tokens as unknown as { data?: unknown }).data,
  )
    ? (tokens as unknown as { data: Array<{ token?: string }> }).data
    : (tokens as unknown as Array<{ token?: string }>);
  const token = list?.[0]?.token;
  if (!token) return null;
  return { userId, accessToken: token };
}
