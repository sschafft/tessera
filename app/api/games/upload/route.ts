import { NextResponse, type NextRequest } from "next/server";
import { mintSession } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookie";
import {
  generateRecoveryToken,
  hashRecoveryToken,
} from "@/lib/auth/recoveryToken";
import { generateGameCode } from "@/lib/game/code";
import { getRepository } from "@/lib/game/getRepository";
import { colorFor } from "@/lib/game/colors";
import {
  groupByTeam,
  pairsCsvWithJoinUrls,
  parsePairsCsv,
  type ParsedRow,
} from "@/lib/csv/pairs";

export const runtime = "nodejs";
export const maxDuration = 30;

interface UploadSettings {
  workshop_name?: string;
  default_complexity?: number;
  round_count?: number;
  round_duration_seconds?: number;
  builder_brief_on?: boolean;
  guider_brief_on?: boolean;
  meeting_mode?: "remote" | "in_person";
  breakout_provider?: "none" | "google_meet" | "jitsi";
  video_call_url?: string | null;
}

/**
 * Pre-built game upload. Parses a CSV with columns
 * `name, email, team_name, role`, creates the game, every
 * participant + their recovery token, every pair grouped by
 * team_name, then returns a populated CSV (now with `join_url` column)
 * for the GM to hand out.
 *
 * The recovery URLs the route generates are the same shape as the
 * regular /join flow's recovery URL — `/recover/<code>?p=<id>#<token>`
 * — so participants land directly on /play with their seat reclaimed.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected_multipart_form" }, { status: 400 });
  }
  const file = form.get("csv");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "csv_file_required" }, { status: 400 });
  }
  const settingsRaw = form.get("settings");
  let settings: UploadSettings = {};
  if (typeof settingsRaw === "string") {
    try {
      settings = JSON.parse(settingsRaw);
    } catch {
      return NextResponse.json({ error: "settings_invalid_json" }, { status: 400 });
    }
  }

  // Parse CSV.
  const text = await file.text();
  const { rows, errors } = parsePairsCsv(text);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "csv_parse_failed", errors },
      { status: 400 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "csv_empty" }, { status: 400 });
  }
  if (rows.length > 50) {
    return NextResponse.json(
      { error: "too_many_participants", detail: "Max 50." },
      { status: 400 },
    );
  }

  const teams = groupByTeam(rows);
  // Sanity-check team allocations.
  const teamErrors: { team_name: string; message: string }[] = [];
  for (const t of teams) {
    if (!t.builder || !t.guider) {
      teamErrors.push({
        team_name: t.team_name,
        message: `team needs one builder and one guider (got builder=${t.builder ? "yes" : "no"}, guider=${t.guider ? "yes" : "no"})`,
      });
    }
    if (t.conflicts.length > 0) {
      teamErrors.push({
        team_name: t.team_name,
        message: `team has more than one builder or guider (extras: ${t.conflicts.map((c) => c.name).join(", ")})`,
      });
    }
  }
  if (teamErrors.length > 0) {
    return NextResponse.json(
      { error: "team_allocation_failed", team_errors: teamErrors },
      { status: 400 },
    );
  }

  // Settings validation. Reuse the constraints from /api/games.
  const workshopName = (settings.workshop_name ?? "").trim();
  if (!workshopName) {
    return NextResponse.json({ error: "workshop_name required" }, { status: 400 });
  }
  const complexity = settings.default_complexity ?? 5;
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 8) {
    return NextResponse.json(
      { error: "default_complexity must be 1..8" },
      { status: 400 },
    );
  }
  const roundCount = settings.round_count ?? 1;
  if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 5) {
    return NextResponse.json(
      { error: "round_count must be 1..5" },
      { status: 400 },
    );
  }
  const roundDuration = settings.round_duration_seconds ?? 480;
  if (
    typeof roundDuration !== "number" ||
    roundDuration < 60 ||
    roundDuration > 3600
  ) {
    return NextResponse.json(
      { error: "round_duration_seconds must be 60..3600" },
      { status: 400 },
    );
  }
  const meetingMode: "remote" | "in_person" =
    settings.meeting_mode === "in_person" ? "in_person" : "remote";
  const provider: "none" | "google_meet" | "jitsi" =
    settings.breakout_provider === "google_meet"
      ? "google_meet"
      : settings.breakout_provider === "jitsi"
        ? "jitsi"
        : "none";
  if (meetingMode === "in_person" && provider !== "none") {
    return NextResponse.json(
      { error: "in_person cannot have breakouts" },
      { status: 400 },
    );
  }
  // Email required for google_meet — every participant must carry one.
  if (provider === "google_meet") {
    const missingEmail = rows.filter((r) => !r.email);
    if (missingEmail.length > 0) {
      return NextResponse.json(
        {
          error: "email_required_for_google_meet",
          detail: `Rows missing email: ${missingEmail.map((r) => r.name).join(", ")}`,
        },
        { status: 400 },
      );
    }
  }

  // Mint identity.
  const code = generateGameCode();
  const hostToken = generateRecoveryToken();
  const hostTokenHash = await hashRecoveryToken(hostToken);
  const gmParticipantId = crypto.randomUUID();

  const repo = getRepository();
  const game = await repo.games.create({
    code,
    host_token_hash: hostTokenHash,
    gm_participant_id: gmParticipantId,
    workshop_name: workshopName.slice(0, 80),
    video_call_url:
      meetingMode === "in_person" ? null : settings.video_call_url || null,
    whiteboard_url: null,
    team_mode: "gm_picks",
    default_complexity: complexity,
    builder_brief_on: settings.builder_brief_on ?? true,
    guider_brief_on: settings.guider_brief_on ?? true,
    builder_brief_source: "library",
    guider_brief_source: "library",
    builder_brief_custom: null,
    guider_brief_custom: null,
    round_count: roundCount,
    round_duration_seconds: roundDuration,
    // Pad cap so the GM can later add walk-ins. CSV rows + 4 buffer,
    // capped at 50.
    participant_cap: Math.min(50, Math.max(rows.length + 4, rows.length)),
    sound_on: true,
    meeting_mode: meetingMode,
    breakout_provider: provider,
  });

  // GM participants row (so super-power audit FK is satisfied).
  await repo.participants.create({
    id: gmParticipantId,
    game_id: game.id,
    display_name: "Facilitator",
    role: "gm",
    color: "red",
  });

  // Create one participant per CSV row, capturing per-row recovery token.
  const baseUrl = pickBaseUrl(req);
  const enriched: Array<ParsedRow & { join_url: string }> = [];
  // Map row → participant id, used in pair creation below.
  const participantIdByName = new Map<string, string>();

  for (const r of rows) {
    const recoveryToken = generateRecoveryToken();
    const recoveryTokenHash = await hashRecoveryToken(recoveryToken);
    // The CSV `role` is the desired final role. We seat the player at
    // that role directly (skipping the lobby state) so they land on
    // /play already paired/observing on first visit.
    const participant = await repo.participants.create({
      game_id: game.id,
      display_name: r.name,
      role: "lobby", // overwritten by pair creation below for builder/guider; observers updated separately
      color: colorFor(r.name, game.id),
      recovery_token_hash: recoveryTokenHash,
      email: r.email,
    });
    participantIdByName.set(r.name, participant.id);
    const join_url = `${baseUrl}/recover/${code}?p=${participant.id}#${recoveryToken}`;
    enriched.push({ ...r, join_url });
  }

  // Create pairs from team groups.
  for (const team of teams) {
    if (!team.builder || !team.guider) continue;
    const builderId = participantIdByName.get(team.builder.name);
    const guiderId = participantIdByName.get(team.guider.name);
    if (!builderId || !guiderId) continue;
    const pair = await repo.pairs.create(game.id, builderId, guiderId);
    if (team.team_name) {
      await repo.pairs.setDisplayName(pair.id, team.team_name);
    }
    for (const obs of team.observers) {
      const obsId = participantIdByName.get(obs.name);
      if (obsId) {
        await repo.pairs.assignObserver(obsId, pair.id);
      }
    }
  }

  const token = await mintSession({
    sub: gmParticipantId,
    game_id: game.id,
    role: "gm",
    code: game.code,
  });

  const csv = pairsCsvWithJoinUrls(enriched);
  const res = NextResponse.json({
    code: game.code,
    host_token: hostToken,
    participant_count: rows.length,
    pair_count: teams.filter((t) => t.builder && t.guider).length,
    csv,
    participants: enriched.map((r) => ({
      name: r.name,
      email: r.email,
      team_name: r.team_name,
      role: r.role,
      join_url: r.join_url,
    })),
  });
  setSessionCookie(res.cookies, game.code, token);
  return res;
}

/** Best-effort base URL from the request. Keeps the recovery link
 * pointing at the deployment that minted it. */
function pickBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
