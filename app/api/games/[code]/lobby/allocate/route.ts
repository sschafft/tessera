import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";
import type { ParticipantRecord } from "@/lib/game/repository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

type AllocatePayload =
  | { kind: "auto" }
  | { kind: "auto_pairs"; count: number }
  | { kind: "auto_observers" }
  | { kind: "pair"; participant_ids: [string, string]; builder_id: string }
  | { kind: "observer"; participant_ids: string[]; pair_id: string };

function isAllocatePayload(b: unknown): b is AllocatePayload {
  if (!b || typeof b !== "object") return false;
  const k = (b as { kind?: unknown }).kind;
  if (k === "auto") return true;
  if (k === "auto_pairs") {
    const o = b as { count?: unknown };
    return (
      Number.isInteger(o.count) &&
      typeof o.count === "number" &&
      o.count > 0 &&
      o.count <= 32
    );
  }
  if (k === "auto_observers") return true;
  if (k === "pair") {
    const o = b as { participant_ids?: unknown; builder_id?: unknown };
    return (
      Array.isArray(o.participant_ids) &&
      o.participant_ids.length === 2 &&
      o.participant_ids.every((s) => typeof s === "string") &&
      typeof o.builder_id === "string" &&
      o.participant_ids.includes(o.builder_id)
    );
  }
  if (k === "observer") {
    const o = b as { participant_ids?: unknown; pair_id?: unknown };
    return (
      Array.isArray(o.participant_ids) &&
      o.participant_ids.length > 0 &&
      o.participant_ids.every((s) => typeof s === "string") &&
      typeof o.pair_id === "string"
    );
  }
  return false;
}

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isAllocatePayload(body)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const participants = await repo.listActiveParticipants(game.id);
  const byId = new Map(participants.map((p) => [p.id, p]));

  if (body.kind === "auto") {
    const result = await autoAllocate({ repo, game_id: game.id, participants });
    void publishGameEvent(game.id, "allocation_changed");
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.kind === "auto_pairs") {
    const result = await autoCreatePairs({
      repo,
      game_id: game.id,
      participants,
      count: body.count,
    });
    void publishGameEvent(game.id, "allocation_changed");
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.kind === "auto_observers") {
    const existingPairs = await repo.listPairs(game.id);
    if (existingPairs.length === 0) {
      return NextResponse.json(
        { error: "no_pairs", message: "Create at least one pair first." },
        { status: 400 },
      );
    }
    const lobby = participants.filter(
      (p) => p.role === "lobby" && p.pair_id === null,
    );
    let assigned = 0;
    for (let i = 0; i < lobby.length; i++) {
      const target = existingPairs[i % existingPairs.length]!;
      await repo.assignObserver(lobby[i]!.id, target.id);
      assigned += 1;
    }
    void publishGameEvent(game.id, "allocation_changed");
    return NextResponse.json({ ok: true, observers_assigned: assigned });
  }

  if (body.kind === "pair") {
    const [aId, bId] = body.participant_ids;
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) {
      return NextResponse.json(
        { error: "participant_not_in_game" },
        { status: 400 },
      );
    }
    const builderId = body.builder_id;
    const guiderId = builderId === aId ? bId : aId;
    await repo.createPair(game.id, builderId, guiderId);
    void publishGameEvent(game.id, "allocation_changed");
    return NextResponse.json({ ok: true });
  }

  // observer
  const pairs = await repo.listPairs(game.id);
  const pair = pairs.find((p) => p.id === body.pair_id);
  if (!pair) {
    return NextResponse.json({ error: "pair_not_found" }, { status: 400 });
  }
  for (const pid of body.participant_ids) {
    const p = byId.get(pid);
    if (!p) continue;
    await repo.assignObserver(pid, pair.id);
  }
  void publishGameEvent(game.id, "allocation_changed");
  return NextResponse.json({ ok: true });
}

interface AutoResult {
  pairs_created: number;
  observers_assigned: number;
  unallocated: number;
}

async function autoAllocate({
  repo,
  game_id,
  participants,
}: {
  repo: ReturnType<typeof getRepository>;
  game_id: string;
  participants: ParticipantRecord[];
}): Promise<AutoResult> {
  // Reset all roles first so re-running auto-allocate is idempotent.
  await repo.clearAllocations(game_id);

  const lobbyOnly = participants.filter((p) => p.role !== "gm");
  shuffle(lobbyOnly);

  const pairs: { builder: string; guider: string }[] = [];
  let i = 0;
  while (i + 1 < lobbyOnly.length) {
    const a = lobbyOnly[i]!;
    const b = lobbyOnly[i + 1]!;
    pairs.push({ builder: a.id, guider: b.id });
    i += 2;
  }

  const createdPairs: string[] = [];
  for (const p of pairs) {
    const created = await repo.createPair(game_id, p.builder, p.guider);
    createdPairs.push(created.id);
  }

  let observers = 0;
  if (i < lobbyOnly.length && createdPairs.length > 0) {
    // Distribute leftover players as observers, round-robin into pairs.
    const leftovers = lobbyOnly.slice(i);
    for (let j = 0; j < leftovers.length; j++) {
      const target = createdPairs[j % createdPairs.length]!;
      await repo.assignObserver(leftovers[j]!.id, target);
      observers += 1;
    }
  }

  const unallocated =
    createdPairs.length === 0 ? lobbyOnly.length : 0;
  return {
    pairs_created: createdPairs.length,
    observers_assigned: observers,
    unallocated,
  };
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/**
 * Build N pairs from the lobby pool, picking 2*N players at random and
 * letting builder/guider fall to coin-flip order. Lobby members beyond
 * the 2*N needed stay where they are; the GM can run "auto-assign
 * observers" afterwards to slot them onto pairs.
 */
async function autoCreatePairs({
  repo,
  game_id,
  participants,
  count,
}: {
  repo: ReturnType<typeof getRepository>;
  game_id: string;
  participants: ParticipantRecord[];
  count: number;
}): Promise<{ pairs_created: number; needed_more: number }> {
  const lobby = participants.filter(
    (p) => p.role === "lobby" && p.pair_id === null,
  );
  shuffle(lobby);
  const cap = Math.min(count, Math.floor(lobby.length / 2));
  let created = 0;
  for (let i = 0; i < cap; i++) {
    const a = lobby[i * 2]!;
    const b = lobby[i * 2 + 1]!;
    await repo.createPair(game_id, a.id, b.id);
    created += 1;
  }
  return {
    pairs_created: created,
    needed_more: Math.max(0, count - created),
  };
}
