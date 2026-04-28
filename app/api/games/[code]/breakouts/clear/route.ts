import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import {
  CalendarApiError,
  deleteBreakoutEvent,
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
 * Delete every breakout calendar event we created for this game and
 * clear the breakout fields on the pair rows. Called manually from
 * the dashboard ("Clear breakouts" affordance, e.g. before a Shuffle)
 * and automatically by /end (game-end cleanup modal).
 *
 * Idempotent. Failures on individual events are logged + swallowed
 * so a bad row doesn't block the whole cleanup.
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

  const breakouts = await repo.listPairsWithBreakouts(game.id);
  if (breakouts.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getValidAccessToken(game.id);
  } catch (err) {
    // No Google session — can't issue DELETEs. Still clear the local
    // pair fields so the dashboard reads as cleaned-up; calendar
    // events are orphaned but only visible to the GM.
    if (err instanceof GoogleSessionLost) {
      for (const b of breakouts) {
        await repo.clearPairBreakout(b.id);
      }
      await publishGameEvent(game.id, "breakouts_changed", { cleared: true });
      return NextResponse.json({
        ok: true,
        deleted: 0,
        cleared_local: breakouts.length,
        warning: "google_session_lost_events_orphaned",
      });
    }
    throw err;
  }

  let deleted = 0;
  for (const b of breakouts) {
    try {
      await deleteBreakoutEvent({
        accessToken,
        eventId: b.event_id,
      });
      deleted += 1;
    } catch (err) {
      // Auth error — token went away mid-loop. Stop hitting Google,
      // but still clear the local rows so the dashboard reflects the
      // attempt.
      if (err instanceof CalendarApiError && err.isAuthError) {
        console.warn(
          `[breakouts] clear: google session lost mid-loop, ${breakouts.length - deleted} events orphaned`,
        );
        break;
      }
      // Other errors (5xx, transient): log and proceed; we still
      // want to clear the local row since the link is no longer
      // useful to the players.
      console.warn(
        `[breakouts] delete event ${b.event_id} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    await repo.clearPairBreakout(b.id);
  }

  // Catch up on any local rows we didn't reach in the loop.
  for (const b of breakouts.slice(deleted)) {
    await repo.clearPairBreakout(b.id).catch(() => undefined);
  }

  await publishGameEvent(game.id, "breakouts_changed", { cleared: true });
  return NextResponse.json({ ok: true, deleted, total: breakouts.length });
}
