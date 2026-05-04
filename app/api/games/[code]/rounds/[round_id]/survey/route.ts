import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; round_id: string }>;
}

interface SurveyPayload {
  comm_balance?: number;
  attr_self?: number;
  attr_partner?: number;
  attr_system?: number;
}

/**
 * Player-side end-of-round reflection. Two questions:
 *
 *   1. comm_balance (0..100): who carried the communication.
 *   2. friction attribution (3 sliders summing to 100): how much of
 *      the round's friction came from the player themself, the
 *      partner, and the game/system. Replaces the v1 4-way
 *      `what_made_harder` enum (2026-05-04 design pass) so the
 *      aggregator can surface magnitudes + builder-vs-guider
 *      asymmetry instead of just a coarse pick.
 *
 *   POST → idempotent upsert keyed by (round_id, participant_id).
 *   GET  → returns this participant's previous response, or null.
 *
 * Only builders + guiders submit (observers + GM are excluded server-
 * side). The route also rejects writes when the round didn't have
 * `reflection_survey_requested` set — players can't surface a
 * survey card the GM didn't opt into.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code, round_id } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { me } = session;
  if (me.released_at !== null) {
    return NextResponse.json({ error: "participant_gone" }, { status: 404 });
  }
  if (me.role !== "builder" && me.role !== "guider") {
    // Observers + lobby + gm don't fill out the player reflection.
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: SurveyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const balance = Number(body.comm_balance);
  if (!Number.isFinite(balance) || balance < 0 || balance > 100) {
    return NextResponse.json(
      { error: "comm_balance must be a number 0..100" },
      { status: 400 },
    );
  }

  const attrSelf = Number(body.attr_self);
  const attrPartner = Number(body.attr_partner);
  const attrSystem = Number(body.attr_system);
  for (const [name, v] of [
    ["attr_self", attrSelf],
    ["attr_partner", attrPartner],
    ["attr_system", attrSystem],
  ] as const) {
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return NextResponse.json(
        { error: `${name} must be a number 0..100` },
        { status: 400 },
      );
    }
  }
  // Forced-choice contract: the three axes must sum to exactly 100.
  // The DB CHECK enforces the same, but rejecting here returns a
  // typed error instead of letting the upsert throw a 5xx.
  const sum = attrSelf + attrPartner + attrSystem;
  if (sum !== 100) {
    return NextResponse.json(
      {
        error: "attr_sum_must_equal_100",
        message: `attr_self + attr_partner + attr_system must sum to 100 (got ${sum}).`,
      },
      { status: 400 },
    );
  }

  const repo = getRepository();
  // Confirm the round belongs to this participant's game (defence in
  // depth — a malicious client could try to write to a different
  // game's round_id).
  const round = await repo.rounds.findLatest(me.game_id);
  if (!round || round.id !== round_id) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  // Only accept submissions for rounds the GM opted into. Without
  // this gate, a player could POST a fabricated survey for a round
  // that never asked for one and pollute the aggregate.
  if (!round.reflection_survey_requested) {
    return NextResponse.json(
      { error: "survey_not_requested" },
      { status: 400 },
    );
  }

  const record = await repo.roundSurveys.upsert({
    round_id,
    participant_id: me.id,
    comm_balance: Math.round(balance),
    attr_self: Math.round(attrSelf),
    attr_partner: Math.round(attrPartner),
    attr_system: Math.round(attrSystem),
  });
  return NextResponse.json({
    ok: true,
    survey: {
      comm_balance: record.comm_balance,
      attr_self: record.attr_self,
      attr_partner: record.attr_partner,
      attr_system: record.attr_system,
      submitted_at: record.submitted_at,
    },
  });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { code, round_id } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const repo = getRepository();
  const record = await repo.roundSurveys.findForParticipant(
    round_id,
    session.me.id,
  );
  return NextResponse.json({
    survey: record
      ? {
          comm_balance: record.comm_balance,
          attr_self: record.attr_self,
          attr_partner: record.attr_partner,
          attr_system: record.attr_system,
          submitted_at: record.submitted_at,
        }
      : null,
  });
}
