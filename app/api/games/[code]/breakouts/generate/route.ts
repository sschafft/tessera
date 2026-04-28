import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import {
  CalendarApiError,
  createBreakoutEvent,
} from "@/lib/google/calendar";
import {
  GoogleSessionLost,
  getValidAccessToken,
} from "@/lib/google/tokenStore";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Mint a Google Meet link per pair (idempotent — pairs that already
 * have a breakout_call_url are skipped). The GM must be signed in
 * with Google for this game; if not, returns 412 so the dashboard
 * can prompt re-auth.
 *
 * Each pair gets one calendar event:
 *   - Anchored 1 hour in the past, 5 minutes long
 *   - private visibility (only the GM sees it)
 *   - title "Tessera breakout · <pair name> · <workshop name>"
 *   - body explains the auto-cleanup at game-end
 *
 * The Meet URL attached to the event is what the players see.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
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

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "ended" || game.status === "purged") {
    return NextResponse.json({ error: "game_closed" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(game.id);
  } catch (err) {
    if (err instanceof GoogleSessionLost) {
      return NextResponse.json(
        { error: "google_session_lost", reason: err.reason },
        { status: 412 },
      );
    }
    throw err;
  }

  const pairs = await repo.listPairs(game.id);
  const todo = pairs.filter((p) => !p.breakout_call_url);
  if (todo.length === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: pairs.length });
  }

  const participants = await repo.listActiveParticipants(game.id);
  const nameById = new Map(participants.map((p) => [p.id, p.display_name]));
  // Resolve a human label per pair so the calendar event title is
  // legible at a glance ("Tessera breakout · Sam ↔ Jules · Workshop").
  const labelFor = (p: (typeof pairs)[number]) => {
    if (p.display_name) return p.display_name;
    const builderName = p.builder_id ? nameById.get(p.builder_id) : null;
    const guiderName = p.guider_id ? nameById.get(p.guider_id) : null;
    if (builderName && guiderName) return `${builderName} ↔ ${guiderName}`;
    return `Pair ${p.id.slice(0, 6)}`;
  };

  let created = 0;
  let firstError: { pair_id: string; reason: string } | null = null;
  // Sequential — Calendar API rate limits sit around 50 QPS but
  // conferenceData.createRequest is heavier; one-at-a-time keeps the
  // workshop-scale (1-25 pairs) well inside any quota and gives us
  // clean partial-success semantics if one pair errors.
  for (const pair of todo) {
    try {
      const result = await createBreakoutEvent({
        accessToken,
        workshopName: game.workshop_name,
        pairLabel: labelFor(pair),
        gameCode: code,
      });
      await repo.setPairBreakout(pair.id, {
        call_url: result.meetUrl,
        event_id: result.eventId,
      });
      created += 1;
    } catch (err) {
      const reason =
        err instanceof CalendarApiError
          ? err.isAuthError
            ? "google_session_lost"
            : `calendar_${err.status}`
          : err instanceof Error
            ? err.message
            : "unknown";
      console.warn(
        `[breakouts] pair ${pair.id} create failed: ${reason}`,
      );
      if (!firstError) firstError = { pair_id: pair.id, reason };
      // If we lost auth mid-loop, no point continuing — the rest will
      // all fail the same way.
      if (err instanceof CalendarApiError && err.isAuthError) break;
    }
  }

  await publishGameEvent(game.id, "breakouts_changed", { created });

  return NextResponse.json({
    ok: created > 0,
    created,
    skipped: pairs.length - todo.length,
    failed: todo.length - created,
    first_error: firstError,
  });
}
