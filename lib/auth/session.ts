import { cookies } from "next/headers";
import { cookieName } from "./cookie";
import { verifySession, type TesseraClaims } from "./jwt";

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
