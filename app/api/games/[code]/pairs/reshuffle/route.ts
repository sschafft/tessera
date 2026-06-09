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
 * GM-only bulk reshuffle — re-randomises WHO is partnered with WHOM
 * across every fully-paired pair in the game. Different from
 * /swap-all (which flips builder ↔ guider WITHIN each pair): this
 * one keeps the pair slots but re-deals participants into different
 * partnerships so the GM can mix things up between rounds.
 *
 * Observers stay pinned to their pair_id (they still watch the same
 * pair slot, just with new occupants). Any GM-set display_name is
 * cleared as part of the reshuffle so a stale "The Pelicans" rename
 * can't follow a pair after its occupants change.
 *
 * Pre-round only — refuses with 409 when a round is in flight.
 * Realtime fires once at the end so every tab refetches the new
 * roster atomically.
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
    return NextResponse.json({ error: "round_running" }, { status: 409 });
  }

  const changed = await repo.pairs.reshufflePartners(game.id);
  if (changed > 0) {
    await publishGameEvent(game.id, "lobby_changed");
  }
  return NextResponse.json({ ok: true, changed });
}
