import "server-only";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Calendar API wrapper for the breakouts feature. We only need:
 *   - Create event with conferenceData.createRequest (mints a Meet link)
 *   - Delete event (cleanup at game end)
 *
 * All events live on the GM's primary calendar, set in the past so
 * they don't pollute the upcoming-agenda view, with private visibility
 * so only the GM can see them. The Meet link itself is what we surface
 * to players — the calendar event is just the container Google
 * requires for programmatic Meet creation on consumer accounts.
 */

export interface CreateBreakoutEventArgs {
  accessToken: string;
  workshopName: string;
  pairLabel: string;
  gameCode: string;
  /**
   * Email addresses to attach as event attendees. When set, Meet
   * recognises these accounts (if signed into Google) and lets them
   * join without the knock screen — the whole reason we collect email
   * at join time when breakout_provider='google_meet'.
   */
  attendeeEmails?: string[];
}

export interface CreateBreakoutEventResult {
  /** Calendar event ID — needed for later DELETE. */
  eventId: string;
  /** Google Meet URL the players will join. */
  meetUrl: string;
}

/**
 * Anchor every breakout event to "1 hour ago, 5 minutes long". Past
 * events don't appear in upcoming-agenda views in Google Calendar /
 * Gmail right-rail / mobile widgets, so they read as cleanup detritus
 * rather than scheduled meetings. Same anchor across pairs in one
 * game so the GM can spot them all in one calendar slot.
 */
function pastAnchorWindow(): { start: string; end: string } {
  const now = Date.now();
  const start = new Date(now - 60 * 60 * 1000); // 1 hour ago
  const end = new Date(start.getTime() + 5 * 60 * 1000); // 5 min duration
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function createBreakoutEvent(
  args: CreateBreakoutEventArgs,
): Promise<CreateBreakoutEventResult> {
  const { start, end } = pastAnchorWindow();
  const requestId = `tessera-${args.gameCode}-${args.pairLabel.replace(/\s+/g, "_")}-${Date.now()}`;
  const attendees =
    args.attendeeEmails && args.attendeeEmails.length > 0
      ? args.attendeeEmails.map((email) => ({ email, responseStatus: "accepted" }))
      : undefined;
  const body = {
    summary: `Tessera breakout · ${args.pairLabel} · ${args.workshopName}`,
    description:
      `Auto-created by Tessera as a breakout call for "${args.pairLabel}" ` +
      `during workshop "${args.workshopName}" (game ${args.gameCode}). ` +
      `This event will be deleted automatically when the GM ends the game.`,
    start: { dateTime: start },
    end: { dateTime: end },
    visibility: "private",
    transparency: "transparent",
    reminders: { useDefault: false },
    ...(attendees ? { attendees, guestsCanModify: false } : {}),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new CalendarApiError(res.status, text);
  }
  const data = (await res.json()) as {
    id: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: { entryPointType?: string; uri?: string }[];
    };
  };
  // hangoutLink is the canonical Meet URL on calendar events with a
  // Meet conference attached. entryPoints is the long-form fallback
  // if Google ever stops populating hangoutLink.
  const meetUrl =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video",
    )?.uri ||
    null;
  if (!meetUrl) {
    // Defensive: if Google didn't attach a Meet (rare — usually means
    // the conferenceData.createRequest was rate-limited or deferred),
    // the event isn't useful. Delete it and tell the caller to retry.
    await deleteBreakoutEvent({ accessToken: args.accessToken, eventId: data.id }).catch(
      () => undefined,
    );
    throw new CalendarApiError(502, "no_meet_url_attached");
  }
  return { eventId: data.id, meetUrl };
}

export async function deleteBreakoutEvent(args: {
  accessToken: string;
  eventId: string;
}): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(args.eventId)}?sendUpdates=none`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${args.accessToken}` },
    },
  );
  // 410 Gone (already-deleted) is treated as success — game-end
  // cleanup is idempotent.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const text = await res.text();
    throw new CalendarApiError(res.status, text);
  }
}

export class CalendarApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`calendar_api_${status}: ${body.slice(0, 200)}`);
    this.name = "CalendarApiError";
  }
  /** Token expired / revoked — caller should prompt re-auth. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}
