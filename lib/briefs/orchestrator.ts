import "server-only";

import { getRepository } from "@/lib/game/getRepository";
import type { BriefRole, BriefSource, CustomBrief } from "@/lib/game/repository";
import { pickLibraryBrief, type PickedBrief } from "./library";
import { AIBriefRouterError, generateBriefViaAI } from "./router";

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
    // The "gemini" brief source is a runtime router (lib/briefs/
    // router.ts) that tries OpenAI first, then Gemini, then falls
    // through to library. Source label kept as "gemini" for stored-
    // row compatibility (the briefs.source enum is library/gm/gemini);
    // the actual answering provider is logged for observability.
    let aiFailReason: string | null = null;
    try {
      const repo = getRepository();
      const reservation = await repo.games.reserveGeminiCall({
        game_id: input.game_id,
        perGameMax: PER_GAME_MAX,
        perDayMax: PER_DAY_MAX,
      });
      if (reservation.ok) {
        try {
          const result = await generateBriefViaAI({
            role: input.role,
            complexity: input.complexity,
            exclude_titles: input.exclude_titles,
          });
          const provider =
            result.attempts.find((a) => a.ok)?.provider ?? "unknown";
          console.info(
            `[briefs] ai ok provider=${provider} role=${input.role} attempts=${result.attempts
              .map((a) => `${a.provider}:${a.ok ? "ok" : a.reason ?? "fail"}`)
              .join(",")} title="${result.brief.title.slice(0, 40)}"`,
          );
          return result.brief;
        } catch (err) {
          if (err instanceof AIBriefRouterError) {
            aiFailReason = `router:${err.reason}`;
            console.warn(
              `[briefs] ai router exhausted role=${input.role}: ${err.attempts
                .map((a) => `${a.provider}:${a.ok ? "ok" : a.reason ?? "fail"}`)
                .join(",")}`,
            );
          } else {
            aiFailReason = err instanceof Error ? err.message : String(err);
            console.warn(
              `[briefs] ai router unexpected role=${input.role}: ${aiFailReason}`,
            );
          }
        }
      } else {
        aiFailReason = `budget_${reservation.reason}`;
        console.info(`[briefs] ai budget exhausted (${reservation.reason})`);
      }
    } catch (err) {
      aiFailReason = err instanceof Error ? err.message : String(err);
      console.warn(`[briefs] ai reservation failed: ${aiFailReason}`);
    }

    if (aiFailReason && !allowFallback) {
      throw new GeminiBriefFailedError(input.role, aiFailReason);
    }
  }

  return pickLibraryBrief({
    role: input.role,
    complexity: input.complexity,
    exclude_titles: input.exclude_titles,
  });
}
