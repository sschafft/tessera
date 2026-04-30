import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GM-only "reset all pairs" — wipes pair allocations and returns every
 * builder/guider/observer to the lobby state. Pre-round only; refuses
 * once a round is running because mid-round wipes would orphan
 * placements + briefs.
 *
 * Surfaces an "I just paired the wrong people" escape hatch the
 * sidebar's per-pair swap can't cover (e.g. wholesale re-pairing
 * after a CSV import landed people in the wrong teams).
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

  const round = await repo.rounds.findLatest(game.id);
  if (round && round.status === "running") {
    return NextResponse.json(
      { error: "round_running" },
      { status: 409 },
    );
  }

  await repo.pairs.clearAllocations(game.id);
  await publishGameEvent(game.id, "lobby_changed");
  return NextResponse.json({ ok: true });
}
