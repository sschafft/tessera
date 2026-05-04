import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface EndRoundPayload {
  /**
   * Optional GM opt-in for the player-side reflection survey. When
   * true, the route flips `rounds.reflection_survey_requested`
   * before sealing the round so the player tabs know to mount the
   * card. Auto-expiry from the timer hitting zero passes false (or
   * omits the field) — an absent GM can't choose to ask.
   */
  request_survey?: boolean;
}

/**
 * End the active round. Idempotent. Either the GM clicks End round, or
 * the dashboard auto-fires this when the timer hits zero.
 */
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

  let body: EndRoundPayload = {};
  try {
    const json = await req.json();
    if (json && typeof json === "object") {
      body = json as EndRoundPayload;
    }
  } catch {
    // Empty body is fine — auto-end / legacy callers omit it.
  }
  const requestSurvey = body.request_survey === true;

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  const round = await repo.rounds.findLatest(game.id);
  if (!round) {
    return NextResponse.json({ error: "no_round" }, { status: 400 });
  }
  if (round.status === "ended") {
    return NextResponse.json({ ok: true, already_ended: true });
  }
  // Set the survey-requested flag BEFORE end() so the player tab's
  // round-status flip from running → ended sees the boolean already
  // true on the same snapshot. Order matters for the realtime
  // refetch on the player side: a refetch racing past end() but
  // before the flag flip would render the round-ended view without
  // the survey card.
  if (requestSurvey) {
    await repo.rounds.setReflectionSurveyRequested(round.id, true);
  }
  await repo.rounds.end(round.id);
  await publishGameEvent(game.id, "round_ended");
  return NextResponse.json({
    ok: true,
    round_id: round.id,
    reflection_survey_requested: requestSurvey,
  });
}
