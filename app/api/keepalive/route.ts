import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Keepalive cron — fires daily at 12:00 UTC via vercel.json. Issues a
 * cheap read against Supabase to prevent the free-tier project from
 * auto-pausing after a week of inactivity (TDD §13.3).
 *
 * Vercel signs cron requests with the CRON_SECRET env var (auto-set on
 * Hobby+). We verify it so this endpoint can't be hit casually.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, supabase: "unconfigured" });
  }

  try {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, supabase: "alive" });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
