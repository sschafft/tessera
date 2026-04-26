import "server-only";

import { getRepository } from "@/lib/game/getRepository";
import type { BriefRole, BriefSource, CustomBrief } from "@/lib/game/repository";
import { pickLibraryBrief, type PickedBrief } from "./library";
import {
  GeminiResponseError,
  GeminiUnavailableError,
  generateBriefViaGemini,
} from "./gemini";

const PER_GAME_MAX = 30;
const PER_DAY_MAX = 800;

export interface OrchestrateInput {
  role: BriefRole;
  complexity: number;
  source: BriefSource;
  game_id: string;
  /** Used when source='gm'. Falls back to library if missing. */
  custom?: CustomBrief | null;
  /** Avoids re-rolling the same title twice in a row. */
  exclude_titles?: string[];
}

/**
 * Pick a brief based on the configured source. Falls back gracefully:
 *   gm    → library when custom is missing
 *   gemini → library when API key absent, budget exhausted, or
 *            Gemini returns malformed output
 */
export async function pickBrief(input: OrchestrateInput): Promise<PickedBrief> {
  if (input.source === "gm" && input.custom) {
    return {
      source: "gm",
      title: input.custom.title,
      rules: input.custom.rules,
    };
  }

  if (input.source === "gemini") {
    const repo = getRepository();
    const reservation = await repo.reserveGeminiCall({
      game_id: input.game_id,
      perGameMax: PER_GAME_MAX,
      perDayMax: PER_DAY_MAX,
    });
    if (reservation.ok) {
      try {
        return await generateBriefViaGemini({
          role: input.role,
          complexity: input.complexity,
          exclude_titles: input.exclude_titles,
        });
      } catch (err) {
        if (
          err instanceof GeminiUnavailableError ||
          err instanceof GeminiResponseError
        ) {
          // Fall through to library; the budget already incremented but
          // the failure is rare enough that we don't refund it.
          console.warn("[briefs] gemini failed, falling back to library", err);
        } else {
          throw err;
        }
      }
    } else {
      console.info(
        "[briefs] gemini budget exhausted, falling back to library",
        reservation.reason,
      );
    }
  }

  return pickLibraryBrief({
    role: input.role,
    complexity: input.complexity,
    exclude_titles: input.exclude_titles,
  });
}
