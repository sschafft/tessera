import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import type { GoalPattern } from "@/lib/pattern/types";
import { scorePlacements } from "@/lib/scoring/score";

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

  // Use the live participants row (not the JWT claim) for role checks.
  // A participant who was promoted/demoted by the GM keeps their stale
  // role on the cookie until they re-join — trusting claims.role here
  // re-introduced the gm_should_use_master kick the recovery flow was
  // originally trying to fix (TDD §15.1).
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { claims, me } = session;
  if (me.released_at !== null) {
    return NextResponse.json({ error: "participant_gone" }, { status: 404 });
  }
  if (me.role === "gm") {
    return NextResponse.json({ error: "gm_should_use_master" }, { status: 400 });
  }

  const repo = getRepository();
  // Wave 1: game lookup + latest round in parallel — both depend only
  // on game_id (which we already have from the JWT claim, and which
  // findGameByCode confirms still exists).
  const [game, round] = await Promise.all([
    repo.games.findByCode(code),
    repo.rounds.findLatest(claims.game_id),
  ]);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  // No allocation yet — just return participant + game shell.
  if (!me.pair_id) {
    return NextResponse.json({
      code,
      workshop_name: game.workshop_name,
      video_call_url: game.video_call_url,
      whiteboard_url: game.whiteboard_url,
      game_status: game.status,
      sound_on: game.sound_on,
      game_id: game.id,
      role: me.role,
      me: meSummary(me),
      partner: null,
      pair: null,
      round: roundSummary(round),
      pair_round: null,
      goal: null,
      goal_count: 0,
      placements: [],
      accuracy: null,
      live_score: null,
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

  // Wave 2: pair + pair_round in parallel — neither depends on the
  // other. partnerOf would be a third here but it needs the pair
  // result, so it lands in wave 3 after pair resolves.
  const [pair, pairRound] = await Promise.all([
    repo.pairs.findById(me.pair_id),
    round !== null ? repo.pairRounds.find(round.id, me.pair_id) : Promise.resolve(null),
  ]);
  const partner = await partnerOf(repo, me, pair);

  // What the player can see — role-gated:
  //   builder: never sees the goal; sees own placements
  //   guider:  always sees the goal once the round exists; placements
  //            gated by Agile share super-power (M6) — empty for now
  //   observer: always sees the goal + builder's placements live
  // After the round ends, everyone sees the goal + everyone's
  // placements + everyone's brief, so the pair can debrief together.
  const roundEnded = round?.status === "ended";

  // Wave 3: parallelise everything that needs pairRound — placements,
  // every brief lookup, the observer-pairs index. Was previously up to
  // 5 sequential awaits at the bottom of the route; now they fan out.
  const showGoal =
    me.role === "guider" || me.role === "observer" || roundEnded;
  const showPlacements =
    me.role === "builder" || me.role === "observer" || roundEnded;
  const briefsOpen = pairRound && (pairRound.briefs_revealed || roundEnded);

  // Always fetch the placements when a pair_round exists; the role
  // gating below decides whether to expose the *layout* to this
  // role. Even when we hide the layout (guider, default), we still
  // surface the *count* via builder_placements_count so the guider
  // gets a live "your builder is building" pulse without leaking
  // where pieces are. Playtest 2026-04-28 surfaced the gap — guiders
  // sat watching a static board for minutes between Test events.
  const placementsPromise = pairRound
    ? repo.placements.list(pairRound.id)
    : Promise.resolve(
        [] as Awaited<ReturnType<typeof repo.placements.list>>,
      );
  const myBriefPromise =
    pairRound && (me.role === "builder" || me.role === "guider")
      ? repo.briefs.find(pairRound.id, me.role)
      : Promise.resolve(null);
  const partnerBriefPromise =
    pairRound && briefsOpen
      ? me.role === "builder"
        ? repo.briefs.find(pairRound.id, "guider")
        : me.role === "guider"
          ? repo.briefs.find(pairRound.id, "builder")
          : Promise.resolve(null)
      : Promise.resolve(null);
  const observerBriefsPromise =
    pairRound && briefsOpen && me.role === "observer"
      ? repo.briefs.listForPairRound(pairRound.id)
      : Promise.resolve(
          null as Awaited<
            ReturnType<typeof repo.briefs.listForPairRound>
          > | null,
        );
  const observerPairsPromise =
    me.role === "observer"
      ? Promise.all([
          repo.pairs.list(game.id),
          repo.participants.listActive(game.id),
        ])
      : Promise.resolve(null);

  const [
    placements,
    myBrief,
    partnerBrief,
    observerBriefs,
    observerPairsResult,
  ] = await Promise.all([
    placementsPromise,
    myBriefPromise,
    partnerBriefPromise,
    observerBriefsPromise,
    observerPairsPromise,
  ]);

  // Observers get a list of all pairs (with names) so they can
  // switch between them via the bottom strip.
  let availablePairs: Array<{
    id: string;
    builder_name: string | null;
    guider_name: string | null;
  }> | null = null;
  if (observerPairsResult) {
    const [pairs, allParticipants] = observerPairsResult;
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

  const goal: GoalPattern | null =
    showGoal && pairRound
      ? (pairRound.goal_pattern as GoalPattern)
      : null;

  // Builder placement count is exposed to every role (no layout
  // leak — just a number). Used by GuiderView to render a live
  // progress chip alongside the goal canvas.
  const builderPlacementsCount = placements.length;

  // Apply role-gating on the actual placement layout: guider gets
  // [] (no layout leak); builder + observer + post-round get the
  // full array for rendering on their canvas.
  const visiblePlacements = showPlacements ? placements : [];

  // v1.3 made testing live by default. The historical Test build
  // super-power gated correctness on `pair_rounds.test_enabled`; the
  // 2026-04-30 default-true migration plus the v1.3 always-on UX
  // means every running round (and every ended round) surfaces
  // per-placement correctness. The pairRound check is retained so
  // the lookup doesn't crash on a missing pair_round row.
  const testEnabled = pairRound !== null || roundEnded;
  let placementsWithCorrect: Array<{
    id: string;
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
    correct?: boolean;
    /**
     * When `correct === false` AND a goal piece exists at the same
     * cell, a per-attribute breakdown of which axes are wrong (used
     * by the BuilderView wrong-because tooltip). `null` when the
     * placement is correct or when the cell has no goal piece —
     * leaking the goal layout would break the asymmetry.
     */
    wrong_reasons?: {
      shape: boolean;
      color: boolean;
      rotation: boolean;
    } | null;
  }> = visiblePlacements.map((p) => ({
    id: p.id,
    shape: p.shape,
    color: p.color,
    q: p.q,
    r: p.r,
    rot: p.rot,
  }));
  let accuracy: { correct: number; total: number } | null = null;
  let liveScore:
    | {
        score: number;
        correct: number;
        wrong: number;
        total: number;
        penalty_applied: boolean;
      }
    | null = null;
  // Per-goal-piece correctness, parallel to `goal`. Surfaced to roles
  // that see the goal (guider + observer + post-round), but only
  // when test_enabled — keeps the asymmetry intact pre-Test-Build.
  let goalCorrectness: boolean[] | null = null;
  if (testEnabled && pairRound) {
    const goalPieces = (pairRound.goal_pattern as GoalPattern) ?? [];
    // Score against the FULL placements (not the role-gated
    // visiblePlacements). The guider's view is [] of placements but
    // the breakdown still needs to reflect every builder placement.
    const breakdown = scorePlacements(placements, goalPieces, {
      correctPts: game.scoring_correct_pts,
      wrongPts: game.scoring_wrong_pts,
    });
    const correctById = new Map(
      breakdown.placements.map((p) => [p.id, p.correct]),
    );
    const wrongReasonsById = new Map(
      breakdown.placements.map((p) => [p.id, p.wrong_reasons]),
    );
    placementsWithCorrect = placementsWithCorrect.map((p) => ({
      ...p,
      correct: correctById.get(p.id) ?? false,
      wrong_reasons: wrongReasonsById.get(p.id) ?? null,
    }));
    accuracy = { correct: breakdown.correct, total: breakdown.total };
    liveScore = {
      score: breakdown.score,
      correct: breakdown.correct,
      wrong: breakdown.wrong,
      total: breakdown.total,
      penalty_applied: breakdown.penaltyApplied,
    };
    goalCorrectness = breakdown.goalCorrectness;
  }

  return NextResponse.json({
    code,
    game_id: game.id,
    workshop_name: game.workshop_name,
    video_call_url: game.video_call_url,
    whiteboard_url: game.whiteboard_url,
    game_status: game.status,
    sound_on: game.sound_on,
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
    pair: pair
      ? {
          id: pair.id,
          display_name: pair.display_name ?? null,
          // Per-pair breakout Meet URL when the GM has minted one.
          // Becomes the primary "Join your pair's call" CTA on the
          // player views; the workshop-level video_call_url
          // demotes to a small "main room" secondary link.
          breakout_call_url: pair.breakout_call_url ?? null,
        }
      : null,
    round: roundSummary(round),
    pair_round: pairRound
      ? {
          id: pairRound.id,
          test_enabled: pairRound.test_enabled,
          shares_remaining: pairRound.shares_remaining,
        }
      : null,
    goal,
    /**
     * Goal piece count, exposed even to the builder (who can't see
     * the goal pattern). Powers the "X / Y placed" progress counter
     * without leaking the actual layout / shapes / colors.
     */
    goal_count: pairRound
      ? ((pairRound.goal_pattern as GoalPattern) ?? []).length
      : 0,
    /**
     * How many pieces the builder has placed right now. Exposed to
     * every role (no layout leak — just an integer). Drives the
     * guider's live "your builder is building" progress chip so they
     * stop sitting on a static board between Test/Share events.
     */
    builder_placements_count: builderPlacementsCount,
    placements: placementsWithCorrect,
    accuracy,
    live_score: liveScore,
    /**
     * Per-goal-piece correctness, aligned to `goal`. Null until
     * test_enabled (preserves asymmetry pre-Test-Build). Drives the
     * guider's mirrored "✓ this position satisfied" overlay so they
     * see live progress alongside the score chip.
     */
    goal_correctness: goalCorrectness,
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

function meSummary(p: NonNullable<Awaited<ReturnType<ReturnType<typeof getRepository>["participants"]["findById"]>>>) {
  return {
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    color: p.color,
  };
}

function roundSummary(
  r:
    | {
        id: string;
        index: number;
        complexity: number;
        duration_seconds: number;
        status: string;
        started_at: string | null;
        ended_at: string | null;
        reflection_survey_requested?: boolean;
      }
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
    reflection_survey_requested: r.reflection_survey_requested ?? false,
  };
}

async function partnerOf(
  repo: ReturnType<typeof getRepository>,
  me: NonNullable<Awaited<ReturnType<ReturnType<typeof getRepository>["participants"]["findById"]>>>,
  pair: Awaited<ReturnType<ReturnType<typeof getRepository>["pairs"]["findById"]>>,
) {
  if (!pair) return null;
  if (me.role === "builder" && pair.guider_id) {
    return repo.participants.findById(pair.guider_id);
  }
  if (me.role === "guider" && pair.builder_id) {
    return repo.participants.findById(pair.builder_id);
  }
  if (me.role === "observer") {
    // Observers see both — we surface the builder as "partner" for the
    // top-bar pill; the canvas view shows both.
    if (pair.builder_id) return repo.participants.findById(pair.builder_id);
  }
  return null;
}
