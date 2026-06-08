import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { startRound } from "@/lib/game/roundStart";
import type { BriefSource } from "@/lib/game/repository";

export const maxDuration = 30;
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface StartPayload {
  /** Optional override; defaults to the game's default_complexity. */
  complexity?: number;
  /** Optional override; defaults to the game's round_duration_seconds. */
  duration_seconds?: number;
  /**
   * Override the brief source for both sides for this round. The GM
   * sets this when retrying after a Gemini failure ('library'), or
   * when explicitly downgrading to presets without re-editing the
   * game. Falls through to game.{builder,guider}_brief_source when
   * absent.
   */
  brief_source_override?: BriefSource;
  /**
   * Per-round override for whether each side gets a brief. Omitting
   * either field falls back to the game-level builder_brief_on /
   * guider_brief_on. Lets the GM drop a brief for one round without
   * changing the game's default.
   */
  builder_brief_on?: boolean;
  guider_brief_on?: boolean;
}

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

  let body: StartPayload = {};
  try {
    body = (await req.json()) as StartPayload;
  } catch {
    // Empty body is fine.
  }
  const briefSourceOverride: BriefSource | undefined =
    body.brief_source_override === "library" ||
    body.brief_source_override === "gm" ||
    body.brief_source_override === "gemini"
      ? body.brief_source_override
      : undefined;

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const result = await startRound(repo, game, {
    complexity: body.complexity,
    duration_seconds: body.duration_seconds,
    briefSourceOverride,
    builder_brief_on:
      typeof body.builder_brief_on === "boolean"
        ? body.builder_brief_on
        : undefined,
    guider_brief_on:
      typeof body.guider_brief_on === "boolean"
        ? body.guider_brief_on
        : undefined,
  });

  if (!result.ok) {
    if (result.kind === "no_pairs") {
      return NextResponse.json(
        { error: "no_pairs", message: "Allocate at least one pair first." },
        { status: 400 },
      );
    }
    if (result.kind === "round_already_running") {
      return NextResponse.json(
        { error: "round_already_running", round_id: result.round_id },
        { status: 409 },
      );
    }
    if (result.kind === "gemini_failed") {
      return NextResponse.json(
        {
          error: "gemini_failed",
          failed_role: result.failed_role,
          reason: result.reason,
        },
        { status: 502 },
      );
    }
    if (result.kind === "game_purged") {
      return NextResponse.json({ error: "game_purged" }, { status: 410 });
    }
  }
  return NextResponse.json(result);
}
