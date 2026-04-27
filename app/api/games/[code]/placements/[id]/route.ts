import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { publishGameEvent } from "@/lib/realtime/publish";
import { getRepository } from "@/lib/game/getRepository";
import { MAX_GRID } from "@/lib/grid/coords";
import { PlacementCellTakenError } from "@/lib/game/repository.memory";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; id: string }>;
}

async function loadOwnedPlacement(code: string, id: string) {
  if (!isValidGameCode(code)) {
    return { error: NextResponse.json({ error: "invalid_code" }, { status: 400 }) } as const;
  }
  const session = await readSessionAndParticipant(code);
  if (!session) {
    return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) } as const;
  }
  if (session.me.role !== "builder") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  const repo = getRepository();
  const placement = await repo.findPlacement(id);
  if (!placement) {
    return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) } as const;
  }
  if (placement.placed_by !== session.me.id) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  return { session, repo, placement } as const;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { code, id } = await params;
  const loaded = await loadOwnedPlacement(code, id);
  if ("error" in loaded) return loaded.error;
  const ok = await loaded.repo.deletePlacement(id);
  if (ok) {
    void publishGameEvent(loaded.session.claims.game_id, "placement_removed");
  }
  return NextResponse.json({ ok });
}

interface PatchPayload {
  q?: number;
  r?: number;
  rot?: number;
  shape?: string;
  color?: string;
}

// Same tightened palette as the POST sibling — only the four shipped
// builder shapes. Retired tri-dn / hex / pent get a 400 here too.
const VALID_SHAPES = new Set(["sq", "tri-up", "rhomb", "trap"]);
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

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { code, id } = await params;
  const loaded = await loadOwnedPlacement(code, id);
  if ("error" in loaded) return loaded.error;

  let body: PatchPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    body.q === undefined &&
    body.r === undefined &&
    body.rot === undefined &&
    body.shape === undefined &&
    body.color === undefined
  ) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }
  if (body.q !== undefined && (!isInt(body.q) || body.q < 0 || body.q >= MAX_GRID)) {
    return NextResponse.json({ error: "invalid_q" }, { status: 400 });
  }
  if (body.r !== undefined && (!isInt(body.r) || body.r < 0 || body.r >= MAX_GRID)) {
    return NextResponse.json({ error: "invalid_r" }, { status: 400 });
  }
  if (body.rot !== undefined && (!isInt(body.rot) || body.rot < 0 || body.rot > 3)) {
    return NextResponse.json({ error: "invalid_rot" }, { status: 400 });
  }
  if (body.shape !== undefined && (typeof body.shape !== "string" || !VALID_SHAPES.has(body.shape))) {
    return NextResponse.json({ error: "invalid_shape" }, { status: 400 });
  }
  if (body.color !== undefined && (typeof body.color !== "string" || !VALID_COLORS.has(body.color))) {
    return NextResponse.json({ error: "invalid_color" }, { status: 400 });
  }

  try {
    const placement = await loaded.repo.updatePlacement(id, body);
    if (!placement) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    void publishGameEvent(loaded.session.claims.game_id, "placement_moved");
    return NextResponse.json({ ok: true, placement });
  } catch (err) {
    if (err instanceof PlacementCellTakenError) {
      return NextResponse.json({ error: "cell_taken" }, { status: 409 });
    }
    throw err;
  }
}
