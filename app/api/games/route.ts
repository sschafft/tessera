import { NextResponse, type NextRequest } from "next/server";
import { mintSession } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookie";
import {
  generateRecoveryToken,
  hashRecoveryToken,
} from "@/lib/auth/recoveryToken";
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

interface CustomBriefPayload {
  title?: string;
  rules?: string[];
}

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
  builder_brief_custom?: CustomBriefPayload | null;
  guider_brief_custom?: CustomBriefPayload | null;
  round_count?: number;
  round_duration_seconds?: number;
  participant_cap?: number;
  sound_on?: boolean;
  breakouts_enabled?: boolean;
}

const CUSTOM_TITLE_MAX = 80;
const CUSTOM_RULE_MAX = 280;
const CUSTOM_RULES_MAX = 5;

function sanitiseCustom(b: CustomBriefPayload | null | undefined) {
  if (!b) return null;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return null;
  if (title.length > CUSTOM_TITLE_MAX) return { error: "title_too_long" } as const;
  const rules = Array.isArray(b.rules)
    ? b.rules
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
    : [];
  if (rules.length === 0) return { error: "rules_required" } as const;
  if (rules.length > CUSTOM_RULES_MAX) return { error: "too_many_rules" } as const;
  if (rules.some((r) => r.length > CUSTOM_RULE_MAX)) {
    return { error: "rule_too_long" } as const;
  }
  return { title, rules };
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
  // Both URLs are optional. Empty string and undefined are normalised
  // to null at the column level. When provided, the value still has
  // to be a real http(s) URL — saves the player views from rendering
  // a broken CTA on a typoed link.
  if (
    payload.video_call_url != null &&
    payload.video_call_url !== "" &&
    !isUrl(payload.video_call_url)
  ) {
    return { error: "video_call_url must be a valid URL when provided" };
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

  // Validate custom briefs when source='gm'.
  let builderCustom: { title: string; rules: string[] } | null = null;
  if (payload.builder_brief_on && payload.builder_brief_source === "gm") {
    const v = sanitiseCustom(payload.builder_brief_custom);
    if (!v) return { error: "builder_brief_custom required when source='gm'" };
    if ("error" in v) return { error: `builder_brief_${v.error}` };
    builderCustom = v;
  }
  let guiderCustom: { title: string; rules: string[] } | null = null;
  if (payload.guider_brief_on && payload.guider_brief_source === "gm") {
    const v = sanitiseCustom(payload.guider_brief_custom);
    if (!v) return { error: "guider_brief_custom required when source='gm'" };
    if ("error" in v) return { error: `guider_brief_${v.error}` };
    guiderCustom = v;
  }

  return {
    workshop_name: payload.workshop_name.trim().slice(0, 80),
    video_call_url: payload.video_call_url || null,
    whiteboard_url: payload.whiteboard_url || null,
    team_mode: payload.team_mode,
    default_complexity: c,
    builder_brief_on: Boolean(payload.builder_brief_on),
    guider_brief_on: Boolean(payload.guider_brief_on),
    builder_brief_source: payload.builder_brief_source!,
    guider_brief_source: payload.guider_brief_source!,
    builder_brief_custom: builderCustom,
    guider_brief_custom: guiderCustom,
    round_count: r,
    round_duration_seconds: dur,
    participant_cap: cap,
    sound_on: payload.sound_on ?? true,
    breakouts_enabled: Boolean(payload.breakouts_enabled),
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
  const hostToken = generateRecoveryToken();
  const hostTokenHash = await hashRecoveryToken(hostToken);
  const gmParticipantId = crypto.randomUUID();

  const repo = getRepository();
  const game = await repo.createGame({
    ...validated,
    code,
    host_token_hash: hostTokenHash,
    gm_participant_id: gmParticipantId,
  });
  // Insert a corresponding participants row so the GM can satisfy
  // foreign-key references (accelerant_events.triggered_by, etc.).
  // The lobby UI filters by role='lobby', so this row never appears
  // in the player-facing list.
  await repo.createParticipant({
    id: gmParticipantId,
    game_id: game.id,
    display_name: "Facilitator",
    role: "gm",
    color: "red",
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
