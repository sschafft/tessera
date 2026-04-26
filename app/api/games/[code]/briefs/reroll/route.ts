import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { pickLibraryBrief } from "@/lib/briefs/library";
import type { BriefRole } from "@/lib/game/repository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface RerollPayload {
  pair_id?: string;
  role?: BriefRole;
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

  let body: RerollPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.pair_id || (body.role !== "builder" && body.role !== "guider")) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const role: BriefRole = body.role;

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  const round = await repo.findLatestRound(game.id);
  if (!round) {
    return NextResponse.json({ error: "no_round" }, { status: 400 });
  }
  const pairRound = await repo.findPairRound(round.id, body.pair_id);
  if (!pairRound) {
    return NextResponse.json({ error: "no_pair_round" }, { status: 400 });
  }

  const current = await repo.findBrief(pairRound.id, role);
  const exclude = current ? [current.title] : [];
  const fresh = await pickLibraryBrief({
    role,
    complexity: round.complexity,
    exclude_titles: exclude,
  });
  const inserted = await repo.upsertBrief({
    pair_round_id: pairRound.id,
    role,
    source: fresh.source,
    title: fresh.title,
    rules: fresh.rules,
  });

  return NextResponse.json({
    ok: true,
    brief: {
      id: inserted.id,
      role: inserted.role,
      title: inserted.title,
      rules: inserted.rules,
    },
  });
}
