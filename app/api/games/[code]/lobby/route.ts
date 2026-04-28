import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { scorePlacements } from "@/lib/scoring/score";
import type { GoalPattern } from "@/lib/pattern/types";

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

  // Super-power events for the current round (used to render usage
  // counters + cooldowns on the dashboard rail). The DB-side
  // `accelerant_events` table keeps its historic name for stable
  // persistence — the repository surfaces them as super-power events
  // here.
  const superpowerEvents = round
    ? await repo.listSuperPowerEvents(round.id)
    : [];

  // Build a map of (pair_id → { builder_brief, guider_brief, progress })
  // for the current round. Per-pair progress drives the GM dashboard's
  // completion overlay — green tint + ✓/% chip per row when a pair has
  // satisfied the goal. We only compute progress for the running round;
  // pre-round and ended-round pairs surface no chip.
  const briefsByPair = new Map<
    string,
    {
      builder: { title: string; rules: string[] } | null;
      guider: { title: string; rules: string[] } | null;
    }
  >();
  const progressByPair = new Map<
    string,
    {
      correct: number;
      total: number;
      placed: number;
      percent: number;
      complete: boolean;
      score: number;
    }
  >();
  if (round) {
    const entries = await Promise.all(
      pairs.map(async (pair) => {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (!pr) return null;
        const [list, placements] = await Promise.all([
          repo.listBriefsForPairRound(pr.id),
          repo.listPlacements(pr.id),
        ]);
        const builder = list.find((b) => b.role === "builder");
        const guider = list.find((b) => b.role === "guider");
        const goal = (pr.goal_pattern as GoalPattern) ?? [];
        const breakdown = scorePlacements(placements, goal, {
          correctPts: game.scoring_correct_pts,
          wrongPts: game.scoring_wrong_pts,
        });
        const total = breakdown.total;
        const percent =
          total > 0 ? Math.round((breakdown.correct / total) * 100) : 0;
        return {
          pair_id: pair.id,
          briefs: {
            builder: builder
              ? { title: builder.title, rules: builder.rules }
              : null,
            guider: guider
              ? { title: guider.title, rules: guider.rules }
              : null,
          },
          progress: {
            correct: breakdown.correct,
            total,
            placed: placements.length,
            percent,
            complete: total > 0 && breakdown.correct === total,
            score: breakdown.score,
          },
        };
      }),
    );
    for (const e of entries) {
      if (!e) continue;
      briefsByPair.set(e.pair_id, e.briefs);
      progressByPair.set(e.pair_id, e.progress);
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
    // Drives the "Add vs Change brief" relabel + the
    // reveal-briefs disable on the GM dashboard's super-power rail.
    // The flags are mutated by the change-brief super-power when
    // either side was originally off — see the accelerants route.
    briefs_enabled: {
      builder: game.builder_brief_on,
      guider: game.guider_brief_on,
    },
    participants,
    pairs: pairs.map((p) => ({
      id: p.id,
      builder_id: p.builder_id,
      guider_id: p.guider_id,
      created_at: p.created_at,
      briefs: briefsByPair.get(p.id) ?? { builder: null, guider: null },
      progress: progressByPair.get(p.id) ?? null,
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
    // Defensive: drop any events the storage layer can't fully
    // hydrate. Saw a playtest where one event landed with kind=null /
    // triggered_at=null (DB enum drift, possibly mid-deploy). The UI
    // can't render those usefully and surfacing nulls confuses
    // downstream consumers, so we filter rather than echo broken rows.
    superpower_events: superpowerEvents
      .filter((e) => e.kind != null && e.triggered_at != null)
      .map((e) => ({
        kind: e.kind,
        scope: e.scope,
        pair_id: e.pair_id,
        triggered_at: e.triggered_at,
      })),
  });
}
