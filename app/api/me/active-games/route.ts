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
  const games: Array<{
    code: string;
    workshop_name: string;
    role: string;
    status: string;
  }> = [];

  for (const c of sessionCookies) {
    try {
      const claims = await verifySession(c.value);
      const game = await repo.findGameByCode(claims.code);
      if (!game) continue;
      if (game.id !== claims.game_id) continue;
      if (game.status === "ended" || game.status === "purged") continue;
      games.push({
        code: game.code,
        workshop_name: game.workshop_name,
        role: claims.role,
        status: game.status,
      });
    } catch {
      // Invalid JWT (expired, tampered, etc.) — skip silently.
    }
  }

  return NextResponse.json({ games });
}
