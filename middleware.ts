import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Composed middleware:
 *
 *   1. Lightweight per-IP rate limit on a few sensitive POST routes
 *      (game create, host-recover, recover, join — all bcrypt-bound).
 *   2. Clerk auth context injection — but ONLY when the Clerk env
 *      vars are present. On deployments without Clerk configured
 *      (the breakouts feature is opt-in), we skip Clerk entirely
 *      so a missing key doesn't crash every request with
 *      MIDDLEWARE_INVOCATION_FAILED. The breakouts UI separately
 *      gates on `isClerkConfigured()` to keep the sign-in CTA from
 *      appearing on unconfigured deployments.
 */

const CLERK_AVAILABLE = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

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

const clerkChain = clerkMiddleware((_auth, req) => {
  const limited = applyRateLimit(req);
  if (limited) return limited;
  return NextResponse.next();
});

const fallbackChain = (req: NextRequest) => {
  const limited = applyRateLimit(req);
  if (limited) return limited;
  return NextResponse.next();
};

// Pick the active middleware once at module-init based on whether
// Clerk env vars exist. We can't make `clerkMiddleware` no-op at call
// time because the ClerkProvider on the client also tries to read the
// key — both surfaces gate identically. The fallback path keeps the
// pre-Clerk behaviour (rate-limit-only) intact.
export default CLERK_AVAILABLE ? clerkChain : fallbackChain;

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
