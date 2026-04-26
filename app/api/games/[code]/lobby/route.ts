import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GM-only snapshot of all participants and pairs for a game. Polled at
 * 2 Hz from the master dashboard. Returns enough data for the UI to
 * render the lobby panel + pairs list without further round-trips.
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

  const [active, pairs, round] = await Promise.all([
    repo.listActiveParticipants(game.id),
    repo.listPairs(game.id),
    repo.findLatestRound(game.id),
  ]);

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
    status: game.status,
    round_count: game.round_count,
    participants,
    pairs: pairs.map((p) => ({
      id: p.id,
      builder_id: p.builder_id,
      guider_id: p.guider_id,
      created_at: p.created_at,
    })),
    round: round
      ? {
          id: round.id,
          index: round.index,
          complexity: round.complexity,
          duration_seconds: round.duration_seconds,
          status: round.status,
          started_at: round.started_at,
          ended_at: round.ended_at,
        }
      : null,
  });
}
