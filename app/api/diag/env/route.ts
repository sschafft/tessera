import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Tiny diagnostic endpoint for the breakouts feature config. Returns
 * which env vars are PRESENT (not their values) so a maintainer can
 * verify Vercel scope settings without exposing secrets.
 *
 * Usage:
 *   curl https://tessera.schaffters.com/api/diag/env
 */
export async function GET() {
  return NextResponse.json({
    server: {
      google_oauth_client_id: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
      google_oauth_client_secret: Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      ),
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
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    ),
  });
}
