import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";
import {
  CalendarApiError,
  deleteBreakoutEvent,
} from "@/lib/google/calendar";
import {
  ClerkUnconfiguredError,
  getGoogleAccessToken,
} from "@/lib/google/clerkToken";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * End the entire game. Implicitly ends any running round. Marks
 * games.status='ended' and ended_at=now(). When breakouts were
 * generated, deletes every breakout calendar event from the GM's
 * Google Calendar before flipping the game — keeps the GM's calendar
 * tidy and revokes the OAuth grant on the way out.
 *
 * Returns a `cleanup` block so the dashboard's end-game modal can
 * surface "deleted N of M calendar events" before showing the
 * leaderboard.
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

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "ended") {
    return NextResponse.json({ ok: true, already_ended: true });
  }

  // Calendar cleanup BEFORE flipping the game so we still have a
  // running game to gate the GM session check on. Failures here
  // don't block game-end — orphaned calendar events are visible only
  // to the GM and easy to bulk-delete by searching "Tessera breakout".
  // Clerk holds the OAuth grant; we don't need to revoke anything
  // locally — the GM can disconnect Google from their Clerk account
  // settings if they want to drop the grant entirely.
  const breakouts = await repo.listPairsWithBreakouts(game.id);
  let deleted = 0;
  let cleanupWarning: string | null = null;
  if (breakouts.length > 0) {
    try {
      const session = await getGoogleAccessToken();
      if (!session) {
        cleanupWarning = "google_session_lost";
      } else {
        const accessToken = session.accessToken;
        for (const b of breakouts) {
          try {
            await deleteBreakoutEvent({ accessToken, eventId: b.event_id });
            deleted += 1;
          } catch (err) {
            if (err instanceof CalendarApiError && err.isAuthError) {
              cleanupWarning = "google_session_lost_mid_cleanup";
              break;
            }
            console.warn(
              `[end] delete event ${b.event_id} failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
          await repo.clearPairBreakout(b.id).catch(() => undefined);
        }
      }
    } catch (err) {
      if (err instanceof ClerkUnconfiguredError) {
        cleanupWarning = "clerk_unconfigured";
      } else {
        cleanupWarning = "cleanup_failed";
        console.warn(
          `[end] cleanup error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // Always clear local rows so the dashboard reads as cleaned up.
    for (const b of breakouts) {
      await repo.clearPairBreakout(b.id).catch(() => undefined);
    }
  }

  // End the active round first (idempotent), then flip the game.
  const round = await repo.findLatestRound(game.id);
  if (round && round.status === "running") {
    await repo.endRound(round.id);
  }
  await repo.setGameStatus(game.id, "ended");
  await publishGameEvent(game.id, "game_ended");
  return NextResponse.json({
    ok: true,
    cleanup: {
      total: breakouts.length,
      deleted,
      warning: cleanupWarning,
    },
  });
}
