import { NextResponse } from "next/server";
import { pairsTemplateCsv } from "@/lib/csv/pairs";

export const runtime = "nodejs";

/** Tiny static endpoint that returns the pre-built-game CSV template
 * as a download. Linked from the PreBuiltGameModal's "Download
 * template" CTA. */
export function GET() {
  const csv = pairsTemplateCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="tessera-pairs-template.csv"',
      "cache-control": "public, max-age=3600",
    },
  });
}
