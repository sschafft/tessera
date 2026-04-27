import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { publishGameEvent } from "@/lib/realtime/publish";
import { getRepository } from "@/lib/game/getRepository";
import { SnapshotShareCapError } from "@/lib/game/repository.memory";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Agile share — the builder captures a snapshot of their current
 * placements and sends it to the guider's preview thumbnail. Gated by
 * pair_round.shares_remaining > 0; the GM unlocks the first share via
 * the Agile share accelerant (which triggers the policy event but
 * doesn't itself capture). Each capture decrements shares_remaining.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.me.role !== "builder") {
    return NextResponse.json(
      { error: "only_builder_can_share" },
      { status: 403 },
    );
  }

  const repo = getRepository();
  const me = session.me;
  if (!me.pair_id) {
    return NextResponse.json({ error: "not_in_pair" }, { status: 400 });
  }
  const round = await repo.findLatestRound(session.claims.game_id);
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }
  const pairRound = await repo.findPairRound(round.id, me.pair_id);
  if (!pairRound) {
    return NextResponse.json({ error: "no_pair_round" }, { status: 400 });
  }
  // The pre-check below is racy on its own (two parallel POSTs both
  // observe shares_remaining=1), but the captureBuilderSnapshot RPC
  // is the authoritative gate — see SnapshotShareCapError handling
  // below. We keep the pre-check so a clean "no shares left" hit
  // returns 409 without an extra round-trip.
  if (pairRound.shares_remaining <= 0) {
    return NextResponse.json(
      { error: "no_shares_remaining" },
      { status: 409 },
    );
  }

  const placements = await repo.listPlacements(pairRound.id);
  const snapshot = placements.map((p) => ({
    shape: p.shape,
    color: p.color,
    q: p.q,
    r: p.r,
    rot: p.rot,
  }));

  let remaining: number;
  try {
    remaining = await repo.captureBuilderSnapshot(pairRound.id, snapshot);
  } catch (err) {
    if (err instanceof SnapshotShareCapError) {
      return NextResponse.json(
        { error: err.reason },
        { status: err.reason === "pair_round_not_found" ? 404 : 409 },
      );
    }
    throw err;
  }
  await publishGameEvent(session.claims.game_id, "snapshot_shared");
  return NextResponse.json({
    ok: true,
    shares_remaining: remaining,
    pieces_shared: snapshot.length,
  });
}
