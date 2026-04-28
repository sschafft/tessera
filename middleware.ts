import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Composed middleware:
 *
 *   1. Lightweight per-IP rate limit on a few sensitive POST routes
 *      (game create, host-recover, recover, join — all bcrypt-bound).
 *   2. Clerk auth context injection. Runs on all non-asset routes so
 *      `auth()` works in any route handler / server component that
 *      needs to know who the signed-in GM is. We only actually use it
 *      under /api/games/[code]/breakouts/* and /api/games/[code]/end,
 *      but extending the matcher is cheap and avoids "auth() called
 *      outside Clerk middleware" surprises.
 *
 * The rate-limit logic was previously the entire middleware; it's now
 * the inner step inside Clerk's wrapper.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

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

function applyRateLimit(req: NextRequest): NextResponse | null {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return null;
  }
  const path = req.nextUrl.pathname;
  if (!gated(path)) return null;
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
  return null;
}

export default clerkMiddleware((_auth, req) => {
  const limited = applyRateLimit(req);
  if (limited) return limited;
  return NextResponse.next();
});

export const config = {
  // Clerk's recommended matcher — every route except static assets +
  // the Next.js internals. This is broader than the previous matcher
  // (`/api/games/:path*`) but cheap because the inner rate-limit logic
  // bails fast on non-guarded paths.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
