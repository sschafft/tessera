import type { BriefSource } from "@/lib/game/repository";

/**
 * Hard ceiling on `participant_cap` whenever a game opts into AI brief
 * generation on either side. The brief router preflights pairs
 * sequentially so it can pass `exclude_titles` forward to keep titles
 * unique across the room; with both AI providers capping each call at
 * ~6 s, round-start latency scales linearly with pair count. We were
 * advertising 50-participant workshops while the AI path was already
 * exceeding the route's `maxDuration` at half that — surfaced by the
 * 2026-05-03 tessera-tl review.
 *
 * 15 participants ≈ 7-8 pairs which keeps worst-case round-start
 * inside the 30 s budget. Library-only games keep the original 50 cap.
 */
export const AI_PARTICIPANT_CAP_MAX = 15;

export function usesAIBriefs(
  builderSource: BriefSource | null | undefined,
  guiderSource: BriefSource | null | undefined,
): boolean {
  return builderSource === "gemini" || guiderSource === "gemini";
}
