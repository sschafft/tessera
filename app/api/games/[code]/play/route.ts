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
      game_status: game.status,
      role: me.role,
      me: meSummary(me),
      partner: null,
      pair: null,
      round: roundSummary(round),
      pair_round: null,
      goal: null,
      placements: [],
      accuracy: null,
      test_enabled: false,
      briefs_revealed: false,
      brief: null,
      partner_brief: null,
      observer_briefs: null,
      prototype: null,
      builder_snapshot: null,
      shares_remaining: 0,
      available_pairs: null,
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
  // After the round ends, everyone sees the goal + everyone's
  // placements + everyone's brief, so the pair can debrief together.
  const roundEnded = round?.status === "ended";

  // Observers get a list of all pairs (with names) so they can
  // switch between them via the bottom strip.
  let availablePairs: Array<{
    id: string;
    builder_name: string | null;
    guider_name: string | null;
  }> | null = null;
  if (me.role === "observer") {
    const pairs = await repo.listPairs(game.id);
    const allParticipants = await repo.listActiveParticipants(game.id);
    const byId = new Map(allParticipants.map((p) => [p.id, p]));
    availablePairs = pairs.map((p) => ({
      id: p.id,
      builder_name: p.builder_id
        ? byId.get(p.builder_id)?.display_name ?? null
        : null,
      guider_name: p.guider_id
        ? byId.get(p.guider_id)?.display_name ?? null
        : null,
    }));
  }

  const showGoal =
    me.role === "guider" || me.role === "observer" || roundEnded;
  const showPlacements =
    me.role === "builder" || me.role === "observer" || roundEnded;
  const goal: GoalPattern | null =
    showGoal && pairRound
      ? (pairRound.goal_pattern as GoalPattern)
      : null;
  const placements =
    showPlacements && pairRound
      ? await repo.listPlacements(pairRound.id)
      : [];

  // Each player sees only their own brief by default. Reveal Briefs
  // accelerant flips pair_rounds.briefs_revealed; once set, builder +
  // guider can see each other's. Observers see neither (until the
  // accelerant fires, then they see both too). After round end,
  // everyone sees both briefs (debrief mode).
  const briefsOpen = pairRound && (pairRound.briefs_revealed || roundEnded);
  const myBrief =
    pairRound && (me.role === "builder" || me.role === "guider")
      ? await repo.findBrief(pairRound.id, me.role)
      : null;
  const partnerBrief =
    pairRound && briefsOpen
      ? me.role === "builder"
        ? await repo.findBrief(pairRound.id, "guider")
        : me.role === "guider"
          ? await repo.findBrief(pairRound.id, "builder")
          : null
      : null;
  const observerBriefs =
    pairRound && briefsOpen && me.role === "observer"
      ? await repo.listBriefsForPairRound(pairRound.id)
      : null;

  // Test-build accelerant: builder + observer get per-placement
  // correctness flags computed against the goal. After the round ends,
  // we surface correctness to everyone for the debrief regardless of
  // whether Test Build was triggered.
  const testEnabled = (pairRound?.test_enabled ?? false) || roundEnded;
  let placementsWithCorrect: Array<{
    id: string;
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
    correct?: boolean;
  }> = placements.map((p) => ({
    id: p.id,
    shape: p.shape,
    color: p.color,
    q: p.q,
    r: p.r,
    rot: p.rot,
  }));
  let accuracy: { correct: number; total: number } | null = null;
  if (testEnabled && pairRound) {
    const goalPieces = (pairRound.goal_pattern as GoalPattern) ?? [];
    const goalKey = (g: { shape: string; color: string; q: number; r: number; rot: number }) =>
      `${g.shape}|${g.color}|${g.q},${g.r}|${g.rot}`;
    const goalSet = new Set(goalPieces.map(goalKey));
    let correctCount = 0;
    placementsWithCorrect = placementsWithCorrect.map((p) => {
      const ok = goalSet.has(goalKey(p));
      if (ok) correctCount += 1;
      return { ...p, correct: ok };
    });
    accuracy = { correct: correctCount, total: goalPieces.length };
  }

  return NextResponse.json({
    code,
    workshop_name: game.workshop_name,
    video_call_url: game.video_call_url,
    whiteboard_url: game.whiteboard_url,
    game_status: game.status,
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
    placements: placementsWithCorrect,
    accuracy,
    test_enabled: testEnabled,
    briefs_revealed: pairRound?.briefs_revealed ?? false,
    // Prototype glimpse — when active, builder gets a degraded preview.
    prototype: prototypeWindow(pairRound, me.role),
    // Agile share — guider gets the most recent builder snapshot.
    builder_snapshot:
      pairRound && (me.role === "guider" || me.role === "observer")
        ? (pairRound.builder_snapshot as Array<{
            shape: string;
            color: string;
            q: number;
            r: number;
            rot: number;
          }> | null)
        : null,
    shares_remaining: pairRound?.shares_remaining ?? 0,
    brief: myBrief
      ? {
          role: myBrief.role,
          title: myBrief.title,
          rules: myBrief.rules,
        }
      : null,
    partner_brief: partnerBrief
      ? {
          role: partnerBrief.role,
          title: partnerBrief.title,
          rules: partnerBrief.rules,
        }
      : null,
    observer_briefs: observerBriefs
      ? observerBriefs.map((b) => ({
          role: b.role,
          title: b.title,
          rules: b.rules,
        }))
      : null,
    available_pairs: availablePairs,
  });
}

/**
 * Build the Prototype-glimpse payload for the requester. Only the
 * builder gets a payload; everyone else gets null. Returns null when
 * the window has lapsed. The glimpse is a degraded copy of the goal:
 * randomly drops ~25% of pieces and corrupts another ~15% of colours,
 * so it's "close to but not the goal" — same intent as the design's
 * prototype-but-flawed metaphor.
 */
function prototypeWindow(
  pairRound:
    | {
        prototype_until: string | null;
        goal_pattern: unknown;
        pattern_seed: string;
      }
    | null,
  role: string,
): { goal: unknown; ends_at: string } | null {
  if (!pairRound || !pairRound.prototype_until) return null;
  if (role !== "builder") return null;
  const endsMs = new Date(pairRound.prototype_until).getTime();
  if (endsMs <= Date.now()) return null;
  const pieces = (pairRound.goal_pattern as Array<{
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
  }>) ?? [];
  const seedHash = (s: string, k: number) => {
    let h = 2166136261 ^ k;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  };
  const palette = [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "teal",
  ];
  const degraded: typeof pieces = [];
  for (let i = 0; i < pieces.length; i++) {
    const dropRoll = seedHash(pairRound.pattern_seed, i);
    if (dropRoll < 0.25) continue; // drop ~25% of pieces
    const piece = { ...pieces[i]! };
    const colorRoll = seedHash(pairRound.pattern_seed, i + 1000);
    if (colorRoll < 0.15) {
      // Replace colour with a random different one ~15% of the time.
      const idx = Math.floor(seedHash(pairRound.pattern_seed, i + 2000) * palette.length);
      const swap = palette[idx % palette.length]!;
      piece.color = swap === piece.color ? palette[(idx + 1) % palette.length]! : swap;
    }
    degraded.push(piece);
  }
  return {
    goal: degraded,
    ends_at: pairRound.prototype_until,
  };
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
