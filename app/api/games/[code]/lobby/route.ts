import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GM-only lobby snapshot. Returns the active participant list for live
 * polling on the master dashboard. Polled at ~2 Hz; cheap query.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const claims = await readSessionForGame(code);
  if (!claims) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (claims.role !== "gm") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const active = await repo.listActiveParticipants(game.id);

  // Strip last_seen_at and game_id from the wire payload — the dashboard
  // only needs what it renders.
  const participants = active.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    pair_id: p.pair_id,
    color: p.color,
    joined_at: p.joined_at,
  }));

  return NextResponse.json({
    code,
    workshop_name: game.workshop_name,
    team_mode: game.team_mode,
    participant_cap: game.participant_cap,
    participants,
  });
}
