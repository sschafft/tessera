import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; pair_id: string }>;
}

/**
 * GM-only "swap builder ↔ guider" for a single pair. Pre-round only —
 * once a round is running, the pair's builder canvas + guider goal
 * have diverged and swapping mid-round would corrupt placements.
 *
 * Atomically updates the pair row's builder_id + guider_id and the
 * two participants' role columns.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { code, pair_id } = await params;
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

  // Refuse swaps mid-round: once placements have started accumulating
  // against a builder_id, swapping would orphan them.
  const round = await repo.rounds.findLatest(game.id);
  if (round && round.status === "running") {
    return NextResponse.json(
      { error: "round_running" },
      { status: 409 },
    );
  }

  const pair = await repo.pairs.findById(pair_id);
  if (!pair || pair.game_id !== game.id) {
    return NextResponse.json({ error: "pair_not_found" }, { status: 404 });
  }
  if (!pair.builder_id || !pair.guider_id) {
    return NextResponse.json({ error: "pair_incomplete" }, { status: 400 });
  }

  await repo.pairs.swapRoles(pair_id);
  await publishGameEvent(game.id, "lobby_changed");
  return NextResponse.json({ ok: true });
}
