import { cookies } from "next/headers";
import { cookieName } from "./cookie";
import { verifySession, type TesseraClaims } from "./jwt";
import { getRepository } from "@/lib/game/getRepository";
import type { ParticipantRecord } from "@/lib/game/repository";

/**
 * Read and verify the session JWT for the given game code.
 * Returns null when there's no cookie, the JWT is invalid/expired,
 * or the JWT's `code` claim doesn't match.
 */
export async function readSessionForGame(
  code: string,
): Promise<TesseraClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName(code))?.value;
  if (!token) return null;
  try {
    const claims = await verifySession(token);
    if (claims.code !== code) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Resolve the requester's *live* role from the participants table.
 * Use this for any route that gates on non-GM roles (builder, guider,
 * observer); the JWT can carry a stale role claim because we don't
 * re-mint cookies when the GM allocates someone in the lobby. The DB
 * is the source of truth.
 */
export async function readSessionAndParticipant(
  code: string,
): Promise<{ claims: TesseraClaims; me: ParticipantRecord } | null> {
  const claims = await readSessionForGame(code);
  if (!claims) return null;
  const repo = getRepository();
  const me = await repo.participants.findById(claims.sub);
  if (!me || me.game_id !== claims.game_id) return null;
  return { claims, me };
}
