import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { GRID_HEIGHT, GRID_WIDTH } from "@/lib/grid/coords";
import { PlacementCellTakenError } from "@/lib/game/repository.memory";
import { publishGameEvent } from "@/lib/realtime/publish";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface PlacePayload {
  shape?: string;
  color?: string;
  q?: number;
  r?: number;
  rot?: number;
}

const VALID_SHAPES = new Set([
  "tri-up",
  "tri-dn",
  "sq",
  "rhomb",
  "trap",
  "hex",
  "pent",
]);
const VALID_COLORS = new Set([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "teal",
]);

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const session = await readSessionAndParticipant(code);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.me.role !== "builder") {
    return NextResponse.json(
      { error: "only_builder_can_place" },
      { status: 403 },
    );
  }

  let body: PlacePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.shape || !VALID_SHAPES.has(body.shape)) {
    return NextResponse.json({ error: "invalid_shape" }, { status: 400 });
  }
  if (!body.color || !VALID_COLORS.has(body.color)) {
    return NextResponse.json({ error: "invalid_color" }, { status: 400 });
  }
  if (!isInt(body.q) || body.q < 0 || body.q >= GRID_WIDTH) {
    return NextResponse.json({ error: "invalid_q" }, { status: 400 });
  }
  if (!isInt(body.r) || body.r < 0 || body.r >= GRID_HEIGHT) {
    return NextResponse.json({ error: "invalid_r" }, { status: 400 });
  }
  if (!isInt(body.rot) || body.rot < 0 || body.rot > 5) {
    return NextResponse.json({ error: "invalid_rot" }, { status: 400 });
  }

  const repo = getRepository();
  const me = session.me;
  if (!me.pair_id) {
    return NextResponse.json({ error: "not_in_pair" }, { status: 400 });
  }

  const round = await repo.findLatestRound(session.claims.game_id);
  if (!round || round.status !== "running") {
    return NextResponse.json({ error: "round_not_running" }, { status: 400 });
  }
  const pairRound = await repo.findPairRound(round.id, me.pair_id);
  if (!pairRound) {
    return NextResponse.json({ error: "no_pair_round" }, { status: 400 });
  }

  try {
    const placement = await repo.createPlacement({
      pair_round_id: pairRound.id,
      shape: body.shape,
      color: body.color,
      q: body.q,
      r: body.r,
      rot: body.rot,
      placed_by: me.id,
    });
    void publishGameEvent(session.claims.game_id, "placement_added");
    return NextResponse.json({ ok: true, placement });
  } catch (err) {
    if (err instanceof PlacementCellTakenError) {
      return NextResponse.json({ error: "cell_taken" }, { status: 409 });
    }
    throw err;
  }
}
