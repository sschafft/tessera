import "server-only";

import { getRepository } from "@/lib/game/getRepository";
import type { BriefRole } from "@/lib/game/repository";

/**
 * Hard-coded fallback briefs used when the library is unavailable
 * (e.g. running against the in-memory backend in tests). One bland
 * but functional brief per role.
 */
const FALLBACK_BRIEFS: Record<BriefRole, { title: string; rules: string[] }> = {
  builder: {
    title: "Translate, don't transcribe",
    rules: [
      'When they say "left", place right.',
      "Treat any color as its complement.",
      "Halve any number, round up.",
    ],
  },
  guider: {
    title: "No plain shape names",
    rules: [
      'Triangles are "sails", squares are "decks", hexagons are "buoys".',
      "Use everyday objects to describe shapes you don't have a word for.",
    ],
  },
};

export interface PickedBrief {
  source: "library" | "gm" | "gemini";
  title: string;
  rules: string[];
}

/**
 * Pick a library brief for (role, complexity), excluding any titles
 * already in play (used by re-roll). Returns the fallback brief if the
 * library is empty for some reason.
 */
export async function pickLibraryBrief({
  role,
  complexity,
  exclude_titles,
}: {
  role: BriefRole;
  complexity: number;
  exclude_titles?: string[];
}): Promise<PickedBrief> {
  const repo = getRepository();
  const candidates = await repo.briefs.listLibrary({
    role,
    complexity,
    exclude_titles,
  });

  if (candidates.length === 0) {
    // First retry without the exclude filter (we may have run out).
    const second =
      exclude_titles && exclude_titles.length > 0
        ? await repo.briefs.listLibrary({ role, complexity })
        : [];
    if (second.length === 0) {
      return { source: "library", ...FALLBACK_BRIEFS[role] };
    }
    const pick = second[Math.floor(Math.random() * second.length)]!;
    return { source: "library", title: pick.title, rules: pick.rules };
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  return { source: "library", title: pick.title, rules: pick.rules };
}
