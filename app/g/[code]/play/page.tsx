import { notFound, redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
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

  const claims = await readSessionForGame(code);
  if (!claims) redirect(`/g/${code}/join`);
  if (claims.role === "gm") redirect(`/g/${code}/master`);

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) notFound();
  const me = await repo.findParticipantById(claims.sub);
  if (!me) redirect(`/g/${code}/join`);

  const round = await repo.findLatestRound(game.id);
  let pair = null;
  let pairRound = null;
  let partner = null;
  let placementsRaw: Awaited<ReturnType<typeof repo.listPlacements>> = [];
  if (me.pair_id) {
    pair = await repo.findPairById(me.pair_id);
    if (round) {
      pairRound = await repo.findPairRound(round.id, me.pair_id);
    }
    if (pair) {
      const partnerId =
        me.role === "builder"
          ? pair.guider_id
          : me.role === "guider"
            ? pair.builder_id
            : pair.builder_id;
      if (partnerId) partner = await repo.findParticipantById(partnerId);
    }
    if (pairRound && (me.role === "builder" || me.role === "observer")) {
      placementsRaw = await repo.listPlacements(pairRound.id);
    }
  }

  const myBrief =
    pairRound && (me.role === "builder" || me.role === "guider")
      ? await repo.findBrief(pairRound.id, me.role)
      : null;

  const showGoal = me.role === "guider" || me.role === "observer";
  const goal: GoalPattern | null =
    showGoal && pairRound
      ? (pairRound.goal_pattern as GoalPattern)
      : null;

  const initial: PlayState = {
    code,
    workshop_name: game.workshop_name,
    video_call_url: game.video_call_url,
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
    pair: pair ? { id: pair.id } : null,
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
    pair_round: pairRound
      ? {
          id: pairRound.id,
          test_enabled: pairRound.test_enabled,
          shares_remaining: pairRound.shares_remaining,
        }
      : null,
    goal,
    placements: placementsRaw.map((p) => ({
      id: p.id,
      shape: p.shape as PlayState["placements"][number]["shape"],
      color: p.color as TileColor,
      q: p.q,
      r: p.r,
      rot: p.rot,
    })),
    accuracy: null,
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
