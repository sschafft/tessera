import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { startRound } from "@/lib/game/roundStart";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * Replay the game with the same pairs and players. Wraps the shared
 * `startRound` orchestrator so replay inherits every safeguard the
 * primary `/rounds/start` path earned (single-active-round invariant,
 * AI preflight + cleanup, parallel builder/guider picks, cross-pair
 * title dedup, typed Gemini-failed return path).
 *
 * Used by the GM's "Start another round" CTA on the end-game summary.
 * No request body — replay always uses the game's default complexity
 * and configured brief sources. To customise, the GM uses the regular
 * Start round flow.
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
  if (game.status === "purged") {
    return NextResponse.json({ error: "game_purged" }, { status: 410 });
  }

  const result = await startRound(repo, game);

  if (!result.ok) {
    if (result.kind === "no_pairs") {
      return NextResponse.json(
        {
          error: "no_pairs",
          message: "Allocate at least one pair before replaying.",
        },
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
