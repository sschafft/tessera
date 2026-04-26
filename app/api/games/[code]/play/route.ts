import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import type { GoalPattern } from "@/lib/pattern/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Player play-state snapshot. Role-aware:
 *   - builder: round info, no goal pattern
 *   - guider:  round info + goal pattern
 *   - observer: round info + goal pattern (placements snapshot in 3.2)
 *   - lobby:   round info only (so the page can show "waiting")
 *
 * Polled at 2 Hz from the play page.
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
  if (claims.role === "gm") {
    return NextResponse.json({ error: "gm_should_use_master" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const me = await repo.findParticipantById(claims.sub);
  if (!me || me.released_at !== null && false) {
    return NextResponse.json({ error: "participant_gone" }, { status: 404 });
  }
  if (!me) {
    return NextResponse.json({ error: "participant_gone" }, { status: 404 });
  }

  const round = await repo.findLatestRound(game.id);

  // No allocation yet — just return participant + game shell.
  if (!me.pair_id) {
    return NextResponse.json({
      code,
      workshop_name: game.workshop_name,
      video_call_url: game.video_call_url,
      whiteboard_url: game.whiteboard_url,
      role: me.role,
      me: meSummary(me),
      partner: null,
      pair: null,
      round: roundSummary(round),
      pair_round: null,
      goal: null,
    });
  }

  const pair = await repo.findPairById(me.pair_id);
  const partner = await partnerOf(repo, me, pair);

  const pairRound =
    round !== null ? await repo.findPairRound(round.id, me.pair_id) : null;

  // What the player can see — role-gated:
  //   builder: never sees the goal; sees own placements
  //   guider:  always sees the goal once the round exists; placements
  //            gated by Agile share accelerant (M6) — empty for now
  //   observer: always sees the goal + builder's placements live
  const showGoal = me.role === "guider" || me.role === "observer";
  const showPlacements = me.role === "builder" || me.role === "observer";
  const goal: GoalPattern | null =
    showGoal && pairRound
      ? (pairRound.goal_pattern as GoalPattern)
      : null;
  const placements =
    showPlacements && pairRound
      ? await repo.listPlacements(pairRound.id)
      : [];

  // Each player sees only their own brief (until Reveal Briefs in M6).
  // Observers don't have a brief themselves; we surface null.
  const myBrief =
    pairRound && (me.role === "builder" || me.role === "guider")
      ? await repo.findBrief(pairRound.id, me.role)
      : null;

  return NextResponse.json({
    code,
    workshop_name: game.workshop_name,
    video_call_url: game.video_call_url,
    whiteboard_url: game.whiteboard_url,
    role: me.role,
    me: meSummary(me),
    partner: partner
      ? {
          id: partner.id,
          display_name: partner.display_name,
          role: partner.role,
          color: partner.color,
        }
      : null,
    pair: pair ? { id: pair.id } : null,
    round: roundSummary(round),
    pair_round: pairRound
      ? {
          id: pairRound.id,
          test_enabled: pairRound.test_enabled,
          shares_remaining: pairRound.shares_remaining,
        }
      : null,
    goal,
    placements: placements.map((p) => ({
      id: p.id,
      shape: p.shape,
      color: p.color,
      q: p.q,
      r: p.r,
      rot: p.rot,
    })),
    brief: myBrief
      ? {
          role: myBrief.role,
          title: myBrief.title,
          rules: myBrief.rules,
        }
      : null,
  });
}

function meSummary(p: NonNullable<Awaited<ReturnType<ReturnType<typeof getRepository>["findParticipantById"]>>>) {
  return {
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    color: p.color,
  };
}

function roundSummary(
  r:
    | { id: string; index: number; complexity: number; duration_seconds: number; status: string; started_at: string | null; ended_at: string | null }
    | null,
) {
  if (!r) return null;
  return {
    id: r.id,
    index: r.index,
    complexity: r.complexity,
    duration_seconds: r.duration_seconds,
    status: r.status,
    started_at: r.started_at,
    ended_at: r.ended_at,
  };
}

async function partnerOf(
  repo: ReturnType<typeof getRepository>,
  me: NonNullable<Awaited<ReturnType<ReturnType<typeof getRepository>["findParticipantById"]>>>,
  pair: Awaited<ReturnType<ReturnType<typeof getRepository>["findPairById"]>>,
) {
  if (!pair) return null;
  if (me.role === "builder" && pair.guider_id) {
    return repo.findParticipantById(pair.guider_id);
  }
  if (me.role === "guider" && pair.builder_id) {
    return repo.findParticipantById(pair.builder_id);
  }
  if (me.role === "observer") {
    // Observers see both — we surface the builder as "partner" for the
    // top-bar pill; the canvas view shows both.
    if (pair.builder_id) return repo.findParticipantById(pair.builder_id);
  }
  return null;
}
