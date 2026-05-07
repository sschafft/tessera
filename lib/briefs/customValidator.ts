/**
 * Shared validator for GM-supplied custom briefs.
 *
 * Two callers:
 *   - `/api/games` POST — validates the `builder_brief_custom` /
 *     `guider_brief_custom` payloads when a game is created with
 *     `brief_source = "gm"`.
 *   - `/api/games/upload` POST — validates the per-pair brief
 *     overrides (`brief_title` + `brief_rules` columns) before
 *     persisting them to `pairs.{builder,guider}_brief_override`.
 *
 * Lives in `lib/briefs/` (not `lib/util/`) because the size limits
 * are brief-domain decisions: 80-char title, 5-rule cap, 280-char
 * per rule. Bumping any limit means re-running the brief library
 * fixtures, so it's not a generic string clamp.
 */

export const CUSTOM_TITLE_MAX = 80;
export const CUSTOM_RULE_MAX = 280;
export const CUSTOM_RULES_MAX = 5;

export type CustomBriefValidationError =
  | "title_too_long"
  | "rules_required"
  | "too_many_rules"
  | "rule_too_long";

export interface CustomBriefInput {
  title?: unknown;
  rules?: unknown;
}

/**
 * Returns `null` when the input is missing/empty (caller decides
 * whether that's acceptable), `{ title, rules }` on success, or
 * `{ error }` with a typed code on validation failure.
 */
export function sanitiseCustomBrief(
  b: CustomBriefInput | null | undefined,
): { title: string; rules: string[] } | { error: CustomBriefValidationError } | null {
  if (!b) return null;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return null;
  if (title.length > CUSTOM_TITLE_MAX) {
    return { error: "title_too_long" } as const;
  }
  const rules = Array.isArray(b.rules)
    ? b.rules
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
    : [];
  if (rules.length === 0) return { error: "rules_required" } as const;
  if (rules.length > CUSTOM_RULES_MAX) {
    return { error: "too_many_rules" } as const;
  }
  if (rules.some((r) => r.length > CUSTOM_RULE_MAX)) {
    return { error: "rule_too_long" } as const;
  }
  return { title, rules };
}
