import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import type { SurveyHarderReason } from "@/lib/game/repository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; round_id: string }>;
}

interface SurveyPayload {
  comm_balance?: number;
  what_made_harder?: string;
}

const HARDER_REASONS: ReadonlySet<SurveyHarderReason> = new Set([
  "me",
  "partner",
  "briefs",
  "puzzle",
]);

/**
 * Player-side end-of-round 2-question reflection.
 *
 *   POST → idempotent upsert keyed by (round_id, participant_id).
 *   GET  → returns this participant's previous response, or null.
 *
 * Both reasons (comm_balance, what_made_harder) are required on
 * write. Only the player whose JWT matches `participant_id` can
 * submit; the GM can read aggregated responses through a separate
 * /survey/aggregate route (added in a follow-up).
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
  const harder = (body.what_made_harder ?? "") as SurveyHarderReason;
  if (!HARDER_REASONS.has(harder)) {
    return NextResponse.json(
      { error: "what_made_harder must be one of me|partner|briefs|puzzle" },
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

  const record = await repo.roundSurveys.upsert({
    round_id,
    participant_id: me.id,
    comm_balance: Math.round(balance),
    what_made_harder: harder,
  });
  return NextResponse.json({
    ok: true,
    survey: {
      comm_balance: record.comm_balance,
      what_made_harder: record.what_made_harder,
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
          what_made_harder: record.what_made_harder,
          submitted_at: record.submitted_at,
        }
      : null,
  });
}
