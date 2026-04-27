import "server-only";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { BriefRole } from "@/lib/game/repository";

// gemini-1.5-flash was deprecated in late 2025; gemini-2.0-flash is
// the current free-tier replacement and uses the same API surface.
const MODEL = "gemini-2.0-flash";

export class GeminiUnavailableError extends Error {
  constructor() {
    super("GEMINI_API_KEY not configured");
    this.name = "GeminiUnavailableError";
  }
}

export class GeminiResponseError extends Error {}

export interface GeminiBriefInput {
  role: BriefRole;
  complexity: number;
  exclude_titles?: string[];
}

export interface GeminiBriefOutput {
  source: "gemini";
  title: string;
  rules: string[];
}

const COMPLEXITY_HINT: Record<string, string> = {
  low: "icebreaker. One simple rule, max two short sentences total.",
  mid: "workshop. 2-3 rules with subtle interactions; clever but tractable.",
  high: "punishing. 3-4 interlocking rules that compound; ambitious wordplay.",
};

function bucket(c: number): "low" | "mid" | "high" {
  if (c <= 3) return "low";
  if (c <= 6) return "mid";
  return "high";
}

const ROLE_DESCRIPTION: Record<BriefRole, string> = {
  builder:
    "secret instruction telling the BUILDER to systematically mistranslate, invert, or transform the directions their guider gives them — examples: swap left/right, halve numbers, treat colours as their complement, mirror coordinates",
  guider:
    "secret instruction telling the GUIDER to constrain how they describe the goal pattern — examples: use only nautical terms, only emotions, only questions, no plain shape names, three-word utterances only",
};

/**
 * Generate a brief via Gemini. Returns a typed brief or throws.
 * Caller is responsible for budget reservation (via repo.reserveGeminiCall)
 * BEFORE calling this; the budget shouldn't be touched for failures.
 */
export async function generateBriefViaGemini(
  input: GeminiBriefInput,
): Promise<GeminiBriefOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailableError();

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          rules: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["title", "rules"],
      },
      temperature: 1.0,
      maxOutputTokens: 512,
    },
  });

  const exclude =
    input.exclude_titles && input.exclude_titles.length > 0
      ? `Avoid these titles: ${input.exclude_titles.map((t) => `"${t}"`).join(", ")}.`
      : "";
  const prompt = `Generate ONE secret brief for a facilitation game called Tessera.

Role: ${input.role}
Complexity: ${COMPLEXITY_HINT[bucket(input.complexity)]}

A ${input.role} brief is a ${ROLE_DESCRIPTION[input.role]}.

Constraints:
- title: 1-60 chars, evocative.
- rules: 1-4 short imperative sentences, each ≤ 100 chars.
- Plain text only. No markdown, no HTML, no emoji.
- ${exclude}

Return only valid JSON matching the schema.`;

  // Cap the per-call wall-clock at 6s. The /rounds/start handler has
  // maxDuration=30 and processes pairs sequentially (with builder +
  // guider parallelised within each pair); a single hung Gemini call
  // could otherwise gobble the whole budget. A timeout throws
  // GeminiResponseError which the orchestrator catches and falls back
  // to library when allow_library_fallback is set.
  const TIMEOUT_MS = 6_000;
  const generated = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new GeminiResponseError("timeout")),
        TIMEOUT_MS,
      ),
    ),
  ]);
  const text = generated.response.text();
  let parsed: { title?: unknown; rules?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiResponseError("invalid_json");
  }
  if (
    typeof parsed.title !== "string" ||
    !Array.isArray(parsed.rules) ||
    parsed.rules.length === 0 ||
    !parsed.rules.every((r) => typeof r === "string")
  ) {
    throw new GeminiResponseError("schema_violation");
  }
  // Strip any HTML/script-ish content as defence in depth.
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 280);
  const title = stripTags(parsed.title).slice(0, 60);
  const rules = (parsed.rules as string[])
    .map(stripTags)
    .filter(Boolean)
    .slice(0, 4);
  if (!title || rules.length === 0) {
    throw new GeminiResponseError("empty_after_sanitise");
  }
  return { source: "gemini", title, rules };
}
