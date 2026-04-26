import { NextResponse, type NextRequest } from "next/server";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ code: string; id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { code, id } = await params;
  if (!isValidGameCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  const claims = await readSessionForGame(code);
  if (!claims) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (claims.role !== "builder") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const repo = getRepository();
  const placement = await repo.findPlacement(id);
  if (!placement) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (placement.placed_by !== claims.sub) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ok = await repo.deletePlacement(id);
  return NextResponse.json({ ok });
}
