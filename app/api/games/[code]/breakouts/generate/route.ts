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
  deleteSession,
  getValidAccessToken,
} from "@/lib/google/tokenStore";
import { isGoogleConfigured } from "@/lib/google/oauth";
import { jitsiUrlForPair } from "@/lib/breakouts/jitsi";
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
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }
  if (game.status === "ended" || game.status === "purged") {
    return NextResponse.json({ error: "game_closed" }, { status: 400 });
  }
  if (game.breakout_provider === "none") {
    return NextResponse.json({ error: "breakouts_disabled" }, { status: 400 });
  }

  const pairs = await repo.pairs.list(game.id);
  const todo = pairs.filter((p) => !p.breakout_call_url);
  if (todo.length === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: pairs.length });
  }

  // Jitsi: deterministic URLs per pair, no Google session needed. We
  // store a sentinel event_id so the cleanup loop can identify these
  // rows as no-op (jitsi rooms are stateless on the public server —
  // there's nothing to delete at game-end).
  if (game.breakout_provider === "jitsi") {
    let created = 0;
    for (const pair of todo) {
      const url = jitsiUrlForPair({ gameCode: code, pairId: pair.id });
      await repo.pairs.setBreakout(pair.id, {
        call_url: url,
        event_id: `jitsi:${pair.id}`,
      });
      created += 1;
    }
    await publishGameEvent(game.id, "breakouts_changed", { created });
    return NextResponse.json({
      ok: created > 0,
      created,
      skipped: pairs.length - todo.length,
      failed: 0,
      first_error: null,
    });
  }

  // Google Meet path — needs a valid OAuth session for the GM AND the
  // deployment must have client id/secret on its env. Without the env
  // vars the start route would 503 too; surfacing here as oauth_
  // unconfigured saves the GM a confusing round-trip to /start.
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "oauth_unconfigured" },
      { status: 503 },
    );
  }
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(game.id);
  } catch (err) {
    if (err instanceof GoogleSessionLost) {
      // The stored token is unusable — drop the row so the next lobby
      // snapshot returns google_connected:false and the dashboard
      // re-renders the SignInState rather than offering Generate.
      await deleteSession(game.id);
      return NextResponse.json(
        { error: "google_session_lost", reason: err.reason },
        { status: 412 },
      );
    }
    throw err;
  }

  const participants = await repo.participants.listActive(game.id);
  const nameById = new Map(participants.map((p) => [p.id, p.display_name]));
  const emailById = new Map(
    participants.filter((p) => p.email).map((p) => [p.id, p.email as string]),
  );
  // Resolve a human label per pair so the calendar event title is
  // legible at a glance ("Tessera breakout · Sam ↔ Jules · Workshop").
  const labelFor = (p: (typeof pairs)[number]) => {
    if (p.display_name) return p.display_name;
    const builderName = p.builder_id ? nameById.get(p.builder_id) : null;
    const guiderName = p.guider_id ? nameById.get(p.guider_id) : null;
    if (builderName && guiderName) return `${builderName} ↔ ${guiderName}`;
    return `Pair ${p.id.slice(0, 6)}`;
  };
  const emailsFor = (p: (typeof pairs)[number]): string[] => {
    const out: string[] = [];
    if (p.builder_id) {
      const e = emailById.get(p.builder_id);
      if (e) out.push(e);
    }
    if (p.guider_id) {
      const e = emailById.get(p.guider_id);
      if (e) out.push(e);
    }
    return out;
  };

  let created = 0;
  let firstError: { pair_id: string; reason: string } | null = null;
  let authLostMidLoop = false;
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
        attendeeEmails: emailsFor(pair),
      });
      await repo.pairs.setBreakout(pair.id, {
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
      // all fail the same way. Drop the token row too so the dashboard
      // re-renders the SignInState on the next snapshot.
      if (err instanceof CalendarApiError && err.isAuthError) {
        authLostMidLoop = true;
        break;
      }
    }
  }

  if (authLostMidLoop) {
    await deleteSession(game.id);
  }
  await publishGameEvent(game.id, "breakouts_changed", { created });

  // Mid-loop auth loss is the only error that needs the GM to take
  // action (re-sign-in). Surface it as 412 so the dashboard can drop
  // back to the SignInState — same shape as the pre-loop session-lost
  // exit above. Any created pairs are still persisted.
  if (authLostMidLoop) {
    return NextResponse.json(
      {
        error: "google_session_lost",
        reason: firstError?.reason ?? "calendar_auth_lost",
        created,
        skipped: pairs.length - todo.length,
        failed: todo.length - created,
      },
      { status: 412 },
    );
  }

  return NextResponse.json({
    ok: created > 0,
    created,
    skipped: pairs.length - todo.length,
    failed: todo.length - created,
    first_error: firstError,
  });
}
