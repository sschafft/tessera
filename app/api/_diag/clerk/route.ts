import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Tiny diagnostic endpoint for the breakouts feature config. Returns
 * which env vars are PRESENT (not their values) so a maintainer can
 * verify the Clerk integration on Vercel without exposing secrets.
 *
 * Public on purpose — the response only confirms env-var presence,
 * which is the same signal you'd get by clicking the Sign in button
 * and seeing whether the OAuth flow starts. No secret material is
 * leaked.
 *
 * Usage:
 *   curl https://tessera.schaffters.com/api/_diag/clerk
 */
export async function GET() {
  return NextResponse.json({
    server: {
      // The runtime needs both halves: publishable for the client
      // bundle, secret for server-side `auth()` + `clerkClient`.
      next_public_clerk_publishable_key: Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      ),
      clerk_secret_key: Boolean(process.env.CLERK_SECRET_KEY),
      // Bonus: while we're here, surface a few other env vars whose
      // absence is the silent cause of feature-off behaviour.
      tessera_public_url: Boolean(process.env.TESSERA_PUBLIC_URL),
      tessera_jwt_secret: Boolean(process.env.TESSERA_JWT_SECRET),
      next_public_supabase_url: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      ),
      supabase_service_role_key: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
    },
    breakouts_configured: Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.CLERK_SECRET_KEY,
    ),
  });
}
