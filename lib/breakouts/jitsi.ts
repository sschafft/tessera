/**
 * Jitsi breakout URLs are deterministic — no API call, no auth, no
 * calendar event. The room name is `tessera-<gameCode>-<pairId>`,
 * which is unique-per-pair-per-game and guarantees the same pair
 * always rejoins the same room across reconnects.
 *
 * Jitsi rooms on the public meet.jit.si server are open by default;
 * the long randomised slug makes them unguessable in practice. For
 * deployments that want stricter access control, swap JITSI_HOST
 * for a private deployment that requires a token (out of scope for
 * v1).
 */

const JITSI_HOST = "https://meet.jit.si";

/** Strip any non-room-safe chars so weird game codes can't break the URL. */
function safeSlug(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, "");
}

export function jitsiUrlForPair(input: {
  gameCode: string;
  pairId: string;
}): string {
  const code = safeSlug(input.gameCode).toLowerCase();
  const pair = safeSlug(input.pairId).toLowerCase().slice(0, 12);
  return `${JITSI_HOST}/tessera-${code}-${pair}`;
}
