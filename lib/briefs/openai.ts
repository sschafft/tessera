import "server-only";

import OpenAI from "openai";
import type { BriefRole } from "@/lib/game/repository";

// gpt-4o-mini is the cheapest current OpenAI model with structured-
// output support. We deliberately don't reach for a frontier model —
// the brief-generation prompt is short and the failure mode of a
// less-capable model is "boring brief", not "broken game". The
// orchestrator routes here when Gemini fails or is unavailable.
const MODEL = "gpt-4o-mini";

export class OpenAIUnavailableError extends Error {
  constructor() {
    super("OPENAI_API_KEY not configured");
    this.name = "OpenAIUnavailableError";
  }
}

export class OpenAIResponseError extends Error {}

export interface OpenAIBriefInput {
  role: BriefRole;
  complexity: number;
  exclude_titles?: string[];
}

export interface OpenAIBriefOutput {
  source: "openai";
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
 * Generate a brief via OpenAI's chat completions endpoint with
 * structured output (json_schema). Used by lib/briefs/router.ts as
 * the fallback when Gemini fails or is unavailable.
 *
 * Caller is responsible for budget tracking — there's no equivalent
 * to reserveGeminiCall today; we trust the orchestrator's per-game
 * cap (PER_GAME_MAX) to bound spend until OpenAI usage warrants its
 * own RPC counter.
 */
export async function generateBriefViaOpenAI(
  input: OpenAIBriefInput,
): Promise<OpenAIBriefOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIUnavailableError();

  const client = new OpenAI({ apiKey });

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

  // Cap wall-clock at 6s — same budget as Gemini. The orchestrator
  // route's maxDuration is 30s; with parallel pairs and a router
  // that may try Gemini first, we can't let either provider stall.
  const TIMEOUT_MS = 6_000;
  const completion = await Promise.race([
    client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tessera_brief",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "rules"],
            properties: {
              title: { type: "string" },
              rules: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
      max_tokens: 512,
      temperature: 1.0,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new OpenAIResponseError("timeout")), TIMEOUT_MS),
    ),
  ]);

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new OpenAIResponseError("empty_response");
  }

  let parsed: { title?: unknown; rules?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OpenAIResponseError("invalid_json");
  }
  if (
    typeof parsed.title !== "string" ||
    !Array.isArray(parsed.rules) ||
    parsed.rules.length === 0 ||
    !parsed.rules.every((r) => typeof r === "string")
  ) {
    throw new OpenAIResponseError("schema_violation");
  }
  // Strip any HTML/script-ish content as defence in depth (mirrors
  // gemini.ts).
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
    throw new OpenAIResponseError("empty_after_sanitise");
  }
  return { source: "openai", title, rules };
}
