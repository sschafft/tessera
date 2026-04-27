import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionAndParticipant } from "@/lib/auth/session";
import { publishGameEvent } from "@/lib/realtime/publish";
import { getRepository } from "@/lib/game/getRepository";
import { MAX_GRID, gridSizeFor } from "@/lib/grid/coords";
import { PlacementCellTakenError } from "@/lib/game/repository.memory";
import {
  BUILDER_COLOR_SET,
  BUILDER_SHAPE_SET,
} from "@/lib/pattern/palette";

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
    await publishGameEvent(loaded.session.claims.game_id, "placement_removed");
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
  if (
    body.shape !== undefined &&
    (typeof body.shape !== "string" ||
      !BUILDER_SHAPE_SET.has(body.shape as never))
  ) {
    return NextResponse.json({ error: "invalid_shape" }, { status: 400 });
  }
  if (
    body.color !== undefined &&
    (typeof body.color !== "string" ||
      !BUILDER_COLOR_SET.has(body.color as never))
  ) {
    return NextResponse.json({ error: "invalid_color" }, { status: 400 });
  }

  // Tighten q/r against the running round's actual grid envelope —
  // MAX_GRID above is the broad UI cap; this rejects a PATCH that
  // moves a piece outside the current round's per-complexity grid
  // (e.g. q=8 on a 3×3 round would land but never score).
  if (body.q !== undefined || body.r !== undefined) {
    const round = await loaded.repo.findLatestRound(
      loaded.session.claims.game_id,
    );
    if (round && round.status === "running") {
      const grid = gridSizeFor(round.complexity);
      const q = body.q ?? loaded.placement.q;
      const r = body.r ?? loaded.placement.r;
      if (q >= grid.w) {
        return NextResponse.json({ error: "invalid_q" }, { status: 400 });
      }
      if (r >= grid.h) {
        return NextResponse.json({ error: "invalid_r" }, { status: 400 });
      }
    }
  }

  try {
    const placement = await loaded.repo.updatePlacement(id, body);
    if (!placement) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await publishGameEvent(loaded.session.claims.game_id, "placement_moved");
    return NextResponse.json({ ok: true, placement });
  } catch (err) {
    if (err instanceof PlacementCellTakenError) {
      return NextResponse.json({ error: "cell_taken" }, { status: 409 });
    }
    throw err;
  }
}
