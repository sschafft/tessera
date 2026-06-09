import { notFound, redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { PlayContent, type PlayState } from "@/components/play/PlayContent";
import type { GoalPattern } from "@/lib/pattern/types";
import type { TileColor } from "@/components/canvas/Tile";

type PlayRole = PlayState["role"];

function asPlayRole(r: string): PlayRole {
  if (r === "builder" || r === "guider" || r === "observer" || r === "lobby") {
    return r;
  }
  // GMs are redirected to /master before reaching this code; if a stray
  // GM token shows up, treat them as lobby so nothing leaks.
  return "lobby";
}

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * /g/[code]/play — the player canvas. Server-side: auth-gates the
 * request, fetches the initial play state (so SSR renders the goal
 * pattern for the guider on first paint), then delegates to the
 * PlayContent client component which polls + handles role routing.
 */
export default async function PlayPage({ params }: PageProps) {
  const { code } = await params;
  if (!isValidGameCode(code)) notFound();

  // Pull the live participant row (not just the JWT claim) so the SSR
  // payload honours the same revocation gate the snapshot API enforces
  // (see app/api/games/[code]/play/route.ts:39). Without this, a
  // released observer/guider could hard-refresh /play and walk away
  // with a stale SSR copy of the goal + brief data.
  const session = await readSessionAndParticipant(code);
  if (!session) redirect(`/g/${code}/join`);
  const { claims, me } = session;
  if (claims.role === "gm") redirect(`/g/${code}/master`);
  if (me.released_at !== null) redirect(`/g/${code}/join`);

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) notFound();

  const round = await repo.rounds.findLatest(game.id);
  let pair = null;
  let pairRound = null;
  let partner = null;
  let placementsRaw: Awaited<ReturnType<typeof repo.placements.list>> = [];
  if (me.pair_id) {
    pair = await repo.pairs.findById(me.pair_id);
    if (round) {
      pairRound = await repo.pairRounds.find(round.id, me.pair_id);
    }
    if (pair) {
      const partnerId =
        me.role === "builder"
          ? pair.guider_id
          : me.role === "guider"
            ? pair.builder_id
            : pair.builder_id;
      if (partnerId) partner = await repo.participants.findById(partnerId);
    }
    if (pairRound && (me.role === "builder" || me.role === "observer")) {
      placementsRaw = await repo.placements.list(pairRound.id);
    }
  }

  const myBrief =
    pairRound && (me.role === "builder" || me.role === "guider")
      ? await repo.briefs.find(pairRound.id, me.role)
      : null;

  const showGoal = me.role === "guider" || me.role === "observer";
  const goal: GoalPattern | null =
    showGoal && pairRound
      ? (pairRound.goal_pattern as GoalPattern)
      : null;

  const initial: PlayState = {
    code,
    game_id: game.id,
    workshop_name: game.workshop_name,
    video_call_url: game.video_call_url ?? null,
    whiteboard_url: game.whiteboard_url ?? null,
    game_status: game.status,
    sound_on: game.sound_on,
    role: asPlayRole(me.role),
    me: {
      id: me.id,
      display_name: me.display_name,
      role: asPlayRole(me.role),
      color: me.color as TileColor,
    },
    partner: partner
      ? {
          id: partner.id,
          display_name: partner.display_name,
          role: asPlayRole(partner.role),
          color: partner.color as TileColor,
        }
      : null,
    pair: pair
      ? {
          id: pair.id,
          display_name: pair.display_name ?? null,
          breakout_call_url: pair.breakout_call_url ?? null,
        }
      : null,
    round: round
      ? {
          id: round.id,
          index: round.index,
          complexity: round.complexity,
          duration_seconds: round.duration_seconds,
          status: round.status,
          started_at: round.started_at,
          ended_at: round.ended_at,
          reflection_survey_requested: round.reflection_survey_requested,
        }
      : null,
    round_count: game.round_count,
    pair_round: pairRound
      ? {
          id: pairRound.id,
          test_enabled: pairRound.test_enabled,
          shares_remaining: pairRound.shares_remaining,
        }
      : null,
    goal,
    goal_count: pairRound
      ? ((pairRound.goal_pattern as GoalPattern) ?? []).length
      : 0,
    goal_correctness: null,
    builder_placements_count: placementsRaw.length,
    placements: placementsRaw.map((p) => ({
      id: p.id,
      shape: p.shape as PlayState["placements"][number]["shape"],
      color: p.color as TileColor,
      q: p.q,
      r: p.r,
      rot: p.rot,
    })),
    accuracy: null,
    live_score: null,
    test_enabled: pairRound?.test_enabled ?? false,
    briefs_revealed: pairRound?.briefs_revealed ?? false,
    brief: myBrief
      ? {
          role: myBrief.role,
          title: myBrief.title,
          rules: myBrief.rules,
        }
      : null,
    partner_brief: null,
    observer_briefs: null,
    prototype: null,
    builder_snapshot: null,
    shares_remaining: pairRound?.shares_remaining ?? 0,
    available_pairs: null,
  };

  return <PlayContent code={code} initial={initial} />;
}
