/**
 * Normalise a pair's display name into a URL-safe slug used by the
 * `/g/[code]/[team]` breakout-alias redirect.
 *
 * The aliasing flow needs a stable, predictable transform so two
 * people typing "The Pelicans" and "the pelicans" both land on the
 * same pair. Rules:
 *   - lowercase
 *   - strip diacritics (Café → Cafe)
 *   - collapse anything non-alphanumeric to a single `-`
 *   - trim leading/trailing `-`
 *
 * Returns `""` when nothing alphanumeric survives — callers treat
 * that as "no usable slug, fall back to pair id" rather than minting
 * an empty path segment.
 */
export function pairSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs that already resolve to a concrete `/g/[code]/*` page or
 * API route. The alias resolver must refuse to match these so a
 * pair named "Play" or "Join" can never overshadow a real route —
 * Next.js already prefers static segments over dynamic ones, but
 * keeping an explicit guard means we can also reject these names
 * at pair-rename time (future work) and report a useful error
 * instead of silently routing away.
 */
export const RESERVED_PAIR_SLUGS: ReadonlySet<string> = new Set([
  "join",
  "master",
  "play",
  "lobby",
  "observe",
  "recover",
  "host-recover",
  "summary",
  "briefs",
  "breakouts",
  "pairs",
  "participants",
  "placements",
  "rounds",
  "scoring",
  "superpowers",
  "agile-share",
  "replay",
  "return-to-main",
  "end",
]);
