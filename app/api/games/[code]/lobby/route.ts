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

  // Accelerant events for the current round (used to render usage
  // counters + cooldowns on the dashboard rail).
  const accelerantEvents = round
    ? await repo.listAccelerantEvents(round.id)
    : [];

  // Build a map of (pair_id → { builder_brief, guider_brief }) for the
  // current round. Only populated when a round is in flight.
  const briefsByPair = new Map<
    string,
    {
      builder: { title: string; rules: string[] } | null;
      guider: { title: string; rules: string[] } | null;
    }
  >();
  if (round) {
    for (const pair of pairs) {
      const pr = await repo.findPairRound(round.id, pair.id);
      if (!pr) continue;
      const list = await repo.listBriefsForPairRound(pr.id);
      const builder = list.find((b) => b.role === "builder");
      const guider = list.find((b) => b.role === "guider");
      briefsByPair.set(pair.id, {
        builder: builder
          ? { title: builder.title, rules: builder.rules }
          : null,
        guider: guider
          ? { title: guider.title, rules: guider.rules }
          : null,
      });
    }
  }

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
    game_id: game.id,
    workshop_name: game.workshop_name,
    team_mode: game.team_mode,
    participant_cap: game.participant_cap,
    status: game.status,
    round_count: game.round_count,
    scoring: {
      correct_pts: game.scoring_correct_pts,
      wrong_pts: game.scoring_wrong_pts,
    },
    participants,
    pairs: pairs.map((p) => ({
      id: p.id,
      builder_id: p.builder_id,
      guider_id: p.guider_id,
      created_at: p.created_at,
      briefs: briefsByPair.get(p.id) ?? { builder: null, guider: null },
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
    accelerant_events: accelerantEvents.map((e) => ({
      kind: e.kind,
      scope: e.scope,
      pair_id: e.pair_id,
      triggered_at: e.triggered_at,
    })),
  });
}
