import { NextResponse, type NextRequest } from "next/server";
import { mintSession } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookie";
import { generateHostToken, hashHostToken } from "@/lib/auth/hostToken";
import { generateGameCode } from "@/lib/game/code";
import { getRepository } from "@/lib/game/getRepository";
import type {
  BriefSource,
  CreateGameInput,
  TeamMode,
} from "@/lib/game/repository";

// Node runtime — bcryptjs uses some Node APIs that work on Edge but
// the consensus is Node is the safer default for auth/crypto routes.
export const runtime = "nodejs";

interface CreateGamePayload {
  workshop_name?: string;
  video_call_url?: string;
  whiteboard_url?: string | null;
  team_mode?: TeamMode;
  default_complexity?: number;
  builder_brief_on?: boolean;
  guider_brief_on?: boolean;
  builder_brief_source?: BriefSource;
  guider_brief_source?: BriefSource;
  round_count?: number;
  round_duration_seconds?: number;
  participant_cap?: number;
  sound_on?: boolean;
}

function isUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function validate(payload: CreateGamePayload): CreateGameInput | { error: string } {
  if (!payload.workshop_name || typeof payload.workshop_name !== "string") {
    return { error: "workshop_name is required" };
  }
  if (!isUrl(payload.video_call_url)) {
    return { error: "video_call_url must be a valid URL" };
  }
  if (
    payload.whiteboard_url != null &&
    payload.whiteboard_url !== "" &&
    !isUrl(payload.whiteboard_url)
  ) {
    return { error: "whiteboard_url must be a valid URL when provided" };
  }
  if (payload.team_mode !== "gm_picks" && payload.team_mode !== "players_pick") {
    return { error: "team_mode must be gm_picks or players_pick" };
  }
  const c = payload.default_complexity;
  if (typeof c !== "number" || c < 1 || c > 8 || !Number.isInteger(c)) {
    return { error: "default_complexity must be an integer 1..8" };
  }
  const r = payload.round_count;
  if (typeof r !== "number" || r < 1 || r > 5 || !Number.isInteger(r)) {
    return { error: "round_count must be an integer 1..5" };
  }
  const dur = payload.round_duration_seconds;
  if (typeof dur !== "number" || dur < 60 || dur > 60 * 60) {
    return { error: "round_duration_seconds must be 60..3600" };
  }
  const cap = payload.participant_cap;
  if (typeof cap !== "number" || cap < 3 || cap > 50) {
    return { error: "participant_cap must be 3..50" };
  }
  for (const role of ["builder", "guider"] as const) {
    const src = payload[`${role}_brief_source`];
    if (src !== "library" && src !== "gm" && src !== "gemini") {
      return { error: `${role}_brief_source must be library, gm, or gemini` };
    }
  }

  return {
    workshop_name: payload.workshop_name.trim().slice(0, 80),
    video_call_url: payload.video_call_url!,
    whiteboard_url: payload.whiteboard_url || null,
    team_mode: payload.team_mode,
    default_complexity: c,
    builder_brief_on: Boolean(payload.builder_brief_on),
    guider_brief_on: Boolean(payload.guider_brief_on),
    builder_brief_source: payload.builder_brief_source!,
    guider_brief_source: payload.guider_brief_source!,
    round_count: r,
    round_duration_seconds: dur,
    participant_cap: cap,
    sound_on: payload.sound_on ?? true,
  };
}

export async function POST(req: NextRequest) {
  let body: CreateGamePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validated = validate(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const code = generateGameCode();
  const hostToken = generateHostToken();
  const hostTokenHash = await hashHostToken(hostToken);
  const gmParticipantId = crypto.randomUUID();

  const repo = getRepository();
  const game = await repo.createGame({
    ...validated,
    code,
    host_token_hash: hostTokenHash,
    gm_participant_id: gmParticipantId,
  });

  const token = await mintSession({
    sub: gmParticipantId,
    game_id: game.id,
    role: "gm",
    code: game.code,
  });

  const res = NextResponse.json({
    code: game.code,
    host_token: hostToken, // shown once in the create-confirmation modal
  });
  setSessionCookie(res.cookies, game.code, token);
  return res;
}
