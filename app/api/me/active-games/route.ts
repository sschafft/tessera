import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/jwt";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

/**
 * Returns the games the current browser has a valid session for. We
 * read every `ts_*` cookie, verify the JWT, and look up the matching
 * game. Games that are ended/purged or where the JWT is invalid are
 * filtered out.
 */
export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  const sessionCookies = all.filter((c) => c.name.startsWith("ts_"));
  if (sessionCookies.length === 0) {
    return NextResponse.json({ games: [] });
  }

  const repo = getRepository();

  // Parallelise the per-cookie verify + game lookup. A user with three
  // active workshop cookies plus a couple of stale ones used to chain
  // 5+ sequential round-trips on every home-page hit. Promise.all
  // collapses that to one round-trip per dependent step (verify, then
  // game lookup, both fanned out).
  const verifications = await Promise.all(
    sessionCookies.map(async (c) => {
      try {
        const claims = await verifySession(c.value);
        return { claims };
      } catch {
        return null;
      }
    }),
  );
  const validClaims = verifications.flatMap((v) => (v ? [v.claims] : []));
  if (validClaims.length === 0) {
    return NextResponse.json({ games: [] });
  }
  const lookedUp = await Promise.all(
    validClaims.map(async (claims) => {
      const game = await repo.games.findByCode(claims.code);
      if (!game) return null;
      if (game.id !== claims.game_id) return null;
      if (game.status === "ended" || game.status === "purged") return null;
      return {
        code: game.code,
        workshop_name: game.workshop_name,
        role: claims.role,
        status: game.status,
      };
    }),
  );
  const games = lookedUp.filter((g): g is NonNullable<typeof g> => g !== null);

  return NextResponse.json({ games });
}
