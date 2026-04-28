import "server-only";

import { getRepository } from "@/lib/game/getRepository";
import type { BriefRole, BriefSource, CustomBrief } from "@/lib/game/repository";
import { pickLibraryBrief, type PickedBrief } from "./library";
import { generateBriefViaGemini } from "./gemini";

const PER_GAME_MAX = 30;
const PER_DAY_MAX = 800;

/**
 * Thrown when source='gemini' and the Gemini path fails (network,
 * malformed output, budget exhausted, etc.) AND the caller passed
 * `allow_library_fallback: false`. Lets /rounds/start surface the
 * failure to the GM instead of silently downgrading to library briefs,
 * so the GM can choose between library / custom / retry.
 */
export class GeminiBriefFailedError extends Error {
  constructor(
    public readonly role: BriefRole,
    public readonly reason: string,
  ) {
    super(`gemini brief failed for ${role}: ${reason}`);
    this.name = "GeminiBriefFailedError";
  }
}

export interface OrchestrateInput {
  role: BriefRole;
  complexity: number;
  source: BriefSource;
  game_id: string;
  /** Used when source='gm'. Falls back to library if missing. */
  custom?: CustomBrief | null;
  /** Avoids re-rolling the same title twice in a row. */
  exclude_titles?: string[];
  /**
   * When source='gemini' and the call fails:
   *   true  → silently fall back to a library brief
   *   false → throw GeminiBriefFailedError
   * Defaults to true (re-roll path keeps working through outages);
   * /rounds/start passes false so the GM is told and can choose.
   */
  allow_library_fallback?: boolean;
}

/**
 * Pick a brief based on the configured source. Falls back gracefully:
 *   gm     → library when custom is missing
 *   gemini → library when allow_library_fallback (default), else throws
 */
export async function pickBrief(input: OrchestrateInput): Promise<PickedBrief> {
  const allowFallback = input.allow_library_fallback ?? true;

  if (input.source === "gm" && input.custom) {
    return {
      source: "gm",
      title: input.custom.title,
      rules: input.custom.rules,
    };
  }

  if (input.source === "gemini") {
    let geminiFailReason: string | null = null;
    try {
      const repo = getRepository();
      const reservation = await repo.reserveGeminiCall({
        game_id: input.game_id,
        perGameMax: PER_GAME_MAX,
        perDayMax: PER_DAY_MAX,
      });
      if (reservation.ok) {
        try {
          const brief = await generateBriefViaGemini({
            role: input.role,
            complexity: input.complexity,
            exclude_titles: input.exclude_titles,
          });
          console.info(
            `[briefs] gemini ok role=${input.role} title="${brief.title.slice(0, 40)}"`,
          );
          return brief;
        } catch (err) {
          geminiFailReason = err instanceof Error ? err.message : String(err);
          console.warn(
            `[briefs] gemini call failed role=${input.role}: ${geminiFailReason}`,
          );
        }
      } else {
        geminiFailReason = `budget_${reservation.reason}`;
        console.info(`[briefs] gemini budget exhausted (${reservation.reason})`);
      }
    } catch (err) {
      geminiFailReason = err instanceof Error ? err.message : String(err);
      console.warn(`[briefs] gemini reservation failed: ${geminiFailReason}`);
    }

    if (geminiFailReason && !allowFallback) {
      throw new GeminiBriefFailedError(input.role, geminiFailReason);
    }
  }

  return pickLibraryBrief({
    role: input.role,
    complexity: input.complexity,
    exclude_titles: input.exclude_titles,
  });
}
