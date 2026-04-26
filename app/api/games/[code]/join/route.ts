import { NextResponse, type NextRequest } from "next/server";
import { mintSession } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookie";
import { readSessionForGame } from "@/lib/auth/session";
import { isValidGameCode } from "@/lib/game/code";
import { getRepository } from "@/lib/game/getRepository";
import { colorFor } from "@/lib/game/colors";
import { DuplicateNameError } from "@/lib/game/repository.memory";
import { publishGameEvent } from "@/lib/realtime/publish";
import type { ParticipantRole } from "@/lib/game/repository";

export const runtime = "nodejs";

interface JoinPayload {
  display_name?: string;
  /** Only used when team_mode='players_pick'. Defaults to 'lobby' otherwise. */
  role?: ParticipantRole;
}

const ALLOWED_PICK_ROLES: ReadonlySet<ParticipantRole> = new Set([
  "builder",
  "guider",
  "observer",
  "lobby",
]);

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  let body: JoinPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const displayName = (body.display_name ?? "").trim();
  if (!displayName || displayName.length > 40) {
    return NextResponse.json(
      { error: "display_name must be 1..40 chars" },
      { status: 400 },
    );
  }

  const requestedRole: ParticipantRole = body.role ?? "lobby";
  if (!ALLOWED_PICK_ROLES.has(requestedRole)) {
    return NextResponse.json(
      { error: "role must be builder|guider|observer|lobby" },
      { status: 400 },
    );
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "ended" || game.status === "purged") {
    return NextResponse.json({ error: "game_closed" }, { status: 410 });
  }

  // Honour team_mode: if GM picks teams, ignore any client-provided role
  // and seat the player in the lobby for the GM to allocate later.
  const effectiveRole: ParticipantRole =
    game.team_mode === "gm_picks" ? "lobby" : requestedRole;

  // Reconnect path: if the cookie holds a valid claim for this game and
  // the participant's display_name matches, reclaim the seat.
  const existingClaims = await readSessionForGame(code);
  if (existingClaims) {
    const existing = await repo.findParticipantById(existingClaims.sub);
    if (
      existing &&
      existing.game_id === game.id &&
      existing.released_at === null &&
      existing.display_name.toLowerCase() === displayName.toLowerCase()
    ) {
      await repo.touchParticipant(existing.id);
      return successResponse({
        code,
        game,
        participantId: existing.id,
        role: existing.role,
      });
    }
  }

  // Capacity check (active participants only).
  const active = await repo.listActiveParticipants(game.id);
  if (active.length >= game.participant_cap) {
    return NextResponse.json({ error: "game_full" }, { status: 409 });
  }

  let participant;
  try {
    participant = await repo.createParticipant({
      game_id: game.id,
      display_name: displayName,
      role: effectiveRole,
      color: colorFor(displayName, game.id),
    });
  } catch (err) {
    if (err instanceof DuplicateNameError) {
      return NextResponse.json(
        { error: "name_taken", message: "That display name is already in this game." },
        { status: 409 },
      );
    }
    throw err;
  }

  void publishGameEvent(game.id, "lobby_changed");
  return successResponse({
    code,
    game,
    participantId: participant.id,
    role: participant.role,
  });
}

async function successResponse({
  code,
  game,
  participantId,
  role,
}: {
  code: string;
  game: { id: string };
  participantId: string;
  role: ParticipantRole;
}) {
  const token = await mintSession({
    sub: participantId,
    game_id: game.id,
    role,
    code,
  });

  // Everyone lands on /play; the page renders a "waiting" state for
  // lobby-role participants until the GM allocates them.
  const redirect = `/g/${code}/play`;

  const res = NextResponse.json({
    code,
    participant_id: participantId,
    role,
    redirect,
  });
  setSessionCookie(res.cookies, code, token);
  return res;
}
