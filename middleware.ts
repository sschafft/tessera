import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight per-IP rate limit for our public mutation routes.
 *
 * The Tessera deployment runs on Vercel's free tier with no KV/Redis,
 * so this implementation uses an in-memory sliding-window counter
 * scoped to the runtime instance. That has known caveats:
 *
 *   - Counters reset on cold starts.
 *   - A determined attacker can hit different instances to bypass
 *     the per-instance window.
 *
 * Both are acceptable for v1 — this is a defence in depth against
 * accidental client retries / casual abuse, NOT a hardened gate. The
 * upgrade path when traffic warrants it is Vercel KV or Upstash Redis
 * (drop-in replacement for the `hits` Map below).
 *
 * The limits are intentionally generous: a real workshop GM creating
 * a game + one player joining sends ~6 mutating requests in the first
 * 30 seconds. We bound at 60 mutations / minute / IP, which still
 * leaves headroom for racy realtime updates.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

// Mutation paths we want to gate. Read-only `/api/games/[code]/play`
// and `/api/games/[code]/lobby` are excluded — they're polled at high
// frequency by legitimate clients (2 Hz from the GM dashboard) and
// gating them would create false positives faster than it stops
// abuse.
const GUARDED_PATTERNS: RegExp[] = [
  /^\/api\/games$/, // POST: create game (bcrypt, expensive)
  /^\/api\/games\/[A-Z0-9-]+\/host-recover$/, // POST: bcrypt verify
  /^\/api\/games\/[A-Z0-9-]+\/recover$/, // POST: bcrypt verify
  /^\/api\/games\/[A-Z0-9-]+\/join$/, // POST: bcrypt for player_token
];

interface Bucket {
  hits: number[];
}
const buckets = new Map<string, Bucket>();

function gated(pathname: string): boolean {
  return GUARDED_PATTERNS.some((re) => re.test(pathname));
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function middleware(req: NextRequest) {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return NextResponse.next();
  }
  const path = req.nextUrl.pathname;
  if (!gated(path)) return NextResponse.next();
  const ip = getClientIp(req);
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(ip, bucket);
  }
  while (bucket.hits.length > 0 && bucket.hits[0]! < cutoff) {
    bucket.hits.shift();
  }
  if (bucket.hits.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.hits[0]! + WINDOW_MS - now) / 1000);
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many requests. Wait a moment and try again — if this is wrong, refresh the page.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, retryAfter)),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  bucket.hits.push(now);
  if (Math.random() < 0.01) {
    for (const [k, v] of buckets) {
      if (v.hits.length === 0) buckets.delete(k);
    }
  }
  const remaining = MAX_REQUESTS - bucket.hits.length;
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  return res;
}

export const config = {
  matcher: ["/api/games/:path*"],
};
