import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type SessionRole = "gm" | "builder" | "guider" | "observer" | "lobby";

export interface TesseraClaims extends JWTPayload {
  /** participant_id (uuid) */
  sub: string;
  game_id: string;
  role: SessionRole;
  /** Game code, e.g. HEX-934. Routing convenience only. */
  code: string;
}

const ISSUER = "tessera";
const EXPIRY_SECONDS = 60 * 60 * 4; // 4 hours

function getSecret(): Uint8Array {
  const s = process.env.TESSERA_JWT_SECRET;
  if (!s) {
    throw new Error(
      "TESSERA_JWT_SECRET is not set. Add it to .env.local for development.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function mintSession(claims: {
  sub: string;
  game_id: string;
  role: SessionRole;
  code: string;
}): Promise<string> {
  return new SignJWT({
    game_id: claims.game_id,
    role: claims.role,
    code: claims.code,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .setIssuer(ISSUER)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<TesseraClaims> {
  const { payload } = await jwtVerify<TesseraClaims>(token, getSecret(), {
    issuer: ISSUER,
  });
  if (typeof payload.sub !== "string" || !payload.game_id || !payload.role) {
    throw new Error("Invalid session claims");
  }
  return payload;
}
