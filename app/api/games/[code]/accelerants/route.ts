import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { generatePattern } from "@/lib/pattern/generator";
import { gridSizeFor } from "@/lib/grid/coords";
import { pickBrief } from "@/lib/briefs/orchestrator";
import { publishGameEvent } from "@/lib/realtime/publish";

export const maxDuration = 15;
import {
  POLICIES,
  checkPolicy,
  type AccelerantKind,
  type AccelerantScope,
} from "@/lib/accelerants/policy";
import type {
  GoalPattern,
  GoalPiece,
} from "@/lib/pattern/types";
import { BUILDER_COLORS, BUILDER_SHAPES } from "@/lib/pattern/palette";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface TriggerPayload {
  kind?: AccelerantKind;
  scope?: AccelerantScope;
  pair_id?: string | null;
  /** Per-kind options. Currently used: time_pressure { delta_seconds }. */
  payload?: Record<string, unknown>;
}

const KINDS: ReadonlySet<AccelerantKind> = new Set(
  Object.keys(POLICIES) as AccelerantKind[],
);

export async function POST(req: NextRequest, { params }: RouteParams) {
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

  let body: TriggerPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.kind || !KINDS.has(body.kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (body.scope !== "pair" && body.scope !== "all") {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  if (body.scope === "pair" && !body.pair_id) {
    return NextResponse.json({ error: "pair_id_required" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  const round = await repo.findLatestRound(game.id);
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }

  // Policy check (caps, cooldowns, implementation status).
  const rawEvents = await repo.listAccelerantEvents(round.id);
  const events = rawEvents.map((e) => ({
    kind: e.kind as AccelerantKind,
    scope: e.scope,
    pair_id: e.pair_id,
    triggered_at: e.triggered_at,
  }));
  const policy = checkPolicy({
    events,
    kind: body.kind,
    scope: body.scope,
    pair_id: body.scope === "pair" ? (body.pair_id ?? null) : null,
    now: new Date(),
  });
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason }, { status: 409 });
  }

  // Gather affected pair_rounds.
  const allPairs = await repo.listPairs(game.id);
  const targetedPairs =
    body.scope === "all"
      ? allPairs
      : allPairs.filter((p) => p.id === body.pair_id);
  if (targetedPairs.length === 0) {
    return NextResponse.json({ error: "pair_not_found" }, { status: 400 });
  }

  // Apply per-kind side effects.
  switch (body.kind) {
    case "reveal_briefs":
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (pr) await repo.setBriefsRevealed(pr.id);
      }
      break;

    case "test_build":
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (pr) await repo.setTestEnabled(pr.id, true);
      }
      break;

    case "time_pressure": {
      const raw = body.payload?.delta_seconds;
      const delta = typeof raw === "number" ? raw : 180; // default −3:00
      await repo.decrementRoundDuration(round.id, delta);
      break;
    }

    case "vocab_swap":
    case "change_builder_brief": {
      const role: "builder" | "guider" =
        body.kind === "change_builder_brief" ? "builder" : "guider";
      const source =
        role === "builder" ? game.builder_brief_source : game.guider_brief_source;
      const custom =
        role === "builder" ? game.builder_brief_custom : game.guider_brief_custom;
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (!pr) continue;
        const current = await repo.findBrief(pr.id, role);
        const exclude = current ? [current.title] : [];
        const fresh = await pickBrief({
          role,
          complexity: round.complexity,
          source,
          game_id: game.id,
          custom,
          exclude_titles: exclude,
        });
        await repo.upsertBrief({
          pair_round_id: pr.id,
          role,
          source: fresh.source,
          title: fresh.title,
          rules: fresh.rules,
        });
      }
      break;
    }

    case "randomizer":
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (!pr) continue;
        // Re-seed deterministically with the event timestamp so two
        // randomizer triggers in a row don't collide.
        const newSeed = `${pr.pattern_seed}:rand:${Date.now()}`;
        const newPattern = generatePattern({
          complexity: round.complexity,
          seed: newSeed,
        });
        await repo.updateGoalPattern(pr.id, newPattern, newSeed);
      }
      break;

    case "harder":
    case "easier": {
      const delta = body.kind === "harder" ? 1 : -1;
      const newComplexity = Math.max(
        1,
        Math.min(8, round.complexity + delta),
      );
      // Hold the round's grid envelope so existing placements stay
      // on-canvas — only piece count + colour variety shift.
      const grid = gridSizeFor(round.complexity);
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (!pr) continue;
        const newSeed = `${pr.pattern_seed}:${body.kind}:${Date.now()}`;
        const newPattern = generatePattern({
          complexity: newComplexity,
          seed: newSeed,
          grid,
        });
        await repo.updateGoalPattern(pr.id, newPattern, newSeed);
      }
      break;
    }

    case "requirement_change":
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (!pr) continue;
        const current = pr.goal_pattern as GoalPattern;
        if (!Array.isArray(current) || current.length === 0) continue;
        const grid = gridSizeFor(round.complexity);
        const mutated = mutateOne(current, grid);
        const newSeed = `${pr.pattern_seed}:req:${Date.now()}`;
        await repo.updateGoalPattern(pr.id, mutated, newSeed);
      }
      break;

    case "prototype": {
      // Builder gets a 5-second glimpse window starting now. We persist
      // an absolute timestamp so all clients agree on expiry without
      // server-side ticking.
      const seconds =
        typeof body.payload?.duration_seconds === "number"
          ? body.payload.duration_seconds
          : 5;
      const until = new Date(Date.now() + seconds * 1000);
      for (const pair of targetedPairs) {
        const pr = await repo.findPairRound(round.id, pair.id);
        if (pr) await repo.setPrototypeUntil(pr.id, until);
      }
      break;
    }

    case "agile_share":
      // No DB side-effect on trigger; the accelerant unlocks the
      // builder's "Share progress" button. The actual snapshot capture
      // happens via the dedicated /agile-share endpoint when the
      // builder clicks. We log the trigger here for the audit.
      break;

    default:
      break;
  }

  // Audit log.
  await repo.createAccelerantEvent({
    round_id: round.id,
    scope: body.scope,
    pair_id: body.scope === "pair" ? body.pair_id! : null,
    kind: body.kind,
    payload: body.payload ?? {},
    triggered_by: claims.sub,
  });
  await publishGameEvent(game.id, "accelerant_triggered", {
    kind: body.kind,
  });

  return NextResponse.json({
    ok: true,
    kind: body.kind,
    scope: body.scope,
    affected_pairs: targetedPairs.length,
  });
}

/**
 * Mutate exactly one piece in a goal pattern. Picks one of {color,
 * shape, position, rotation} at random; for position, swaps with a
 * random unoccupied cell on the supplied grid envelope.
 */
function mutateOne(
  pattern: GoalPattern,
  grid: { w: number; h: number },
): GoalPattern {
  const out = pattern.map((p) => ({ ...p })) as GoalPiece[];
  const idx = Math.floor(Math.random() * out.length);
  const target = out[idx]!;
  const facet = Math.floor(Math.random() * 4);
  switch (facet) {
    case 0: {
      const others = BUILDER_COLORS.filter((c) => c !== target.color);
      target.color = others[Math.floor(Math.random() * others.length)]!;
      break;
    }
    case 1: {
      const others = BUILDER_SHAPES.filter((s) => s !== target.shape);
      target.shape = others[Math.floor(Math.random() * others.length)]!;
      break;
    }
    case 2: {
      // Pick a different rotation in the 0..3 / 90° space.
      target.rot = (target.rot + 1 + Math.floor(Math.random() * 3)) % 4;
      break;
    }
    case 3: {
      const occupied = new Set(out.map((p) => `${p.q},${p.r}`));
      const candidates: { q: number; r: number }[] = [];
      for (let q = 0; q < grid.w; q++) {
        for (let r = 0; r < grid.h; r++) {
          if (!occupied.has(`${q},${r}`)) candidates.push({ q, r });
        }
      }
      if (candidates.length > 0) {
        const pick =
          candidates[Math.floor(Math.random() * candidates.length)]!;
        target.q = pick.q;
        target.r = pick.r;
      }
      break;
    }
  }
  return out;
}
