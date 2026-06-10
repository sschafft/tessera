import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; round_id: string }>;
}

interface SurveyPayload {
  fric_puzzle?: number;
  fric_communication?: number;
  fric_time_pressure?: number;
  fric_game_adjustments?: number;
  fric_other?: number;
  fric_other_text?: string | null;
}

const MAX_OTHER_TEXT = 280;

const NUMERIC_FIELDS = [
  "fric_puzzle",
  "fric_communication",
  "fric_time_pressure",
  "fric_game_adjustments",
  "fric_other",
] as const;

/**
 * Player-side end-of-round reflection. Five independent
 * 0..100 sliders capturing how much each category added friction
 * in the round, plus an optional 280-char free-text note tied to
 * the "other" axis:
 *
 *   fric_puzzle             — the goal pattern itself / the grid
 *   fric_communication      — talking past each other
 *   fric_time_pressure      — the round clock
 *   fric_game_adjustments   — mid-round changes the GM made
 *   fric_other              — anything else
 *   fric_other_text         — only meaningful when fric_other > 0
 *
 * Each axis is independent — no sum constraint, players rate the
 * categories on their own merits.
 *
 *   POST → idempotent upsert keyed by (round_id, participant_id).
 *   GET  → returns this participant's previous response, or null.
 *
 * Only builders + guiders submit (observers + GM are excluded
 * server-side). Writes are rejected when the round didn't have
 * `reflection_survey_requested` set so a player can't surface a
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
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: SurveyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const values: Record<(typeof NUMERIC_FIELDS)[number], number> = {
    fric_puzzle: 0,
    fric_communication: 0,
    fric_time_pressure: 0,
    fric_game_adjustments: 0,
    fric_other: 0,
  };
  for (const name of NUMERIC_FIELDS) {
    const raw = body[name];
    const n = Number(raw ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json(
        { error: `${name} must be a number 0..100` },
        { status: 400 },
      );
    }
    values[name] = Math.round(n);
  }

  let otherText: string | null = null;
  if (typeof body.fric_other_text === "string") {
    const trimmed = body.fric_other_text.trim();
    if (trimmed.length > MAX_OTHER_TEXT) {
      return NextResponse.json(
        {
          error: "fric_other_text_too_long",
          message: `fric_other_text must be ${MAX_OTHER_TEXT} chars or fewer.`,
        },
        { status: 400 },
      );
    }
    otherText = trimmed.length > 0 ? trimmed : null;
  }

  const repo = getRepository();
  const round = await repo.rounds.findLatest(me.game_id);
  if (!round || round.id !== round_id) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  if (!round.reflection_survey_requested) {
    return NextResponse.json(
      { error: "survey_not_requested" },
      { status: 400 },
    );
  }

  const record = await repo.roundSurveys.upsert({
    round_id,
    participant_id: me.id,
    fric_puzzle: values.fric_puzzle,
    fric_communication: values.fric_communication,
    fric_time_pressure: values.fric_time_pressure,
    fric_game_adjustments: values.fric_game_adjustments,
    fric_other: values.fric_other,
    fric_other_text: otherText,
  });
  return NextResponse.json({
    ok: true,
    survey: surveyShape(record),
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
    survey: record ? surveyShape(record) : null,
  });
}

function surveyShape(record: {
  fric_puzzle: number;
  fric_communication: number;
  fric_time_pressure: number;
  fric_game_adjustments: number;
  fric_other: number;
  fric_other_text: string | null;
  submitted_at: string;
}) {
  return {
    fric_puzzle: record.fric_puzzle,
    fric_communication: record.fric_communication,
    fric_time_pressure: record.fric_time_pressure,
    fric_game_adjustments: record.fric_game_adjustments,
    fric_other: record.fric_other,
    fric_other_text: record.fric_other_text,
    submitted_at: record.submitted_at,
  };
}
