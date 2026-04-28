import "server-only";

import type { BriefRole } from "@/lib/game/repository";
import {
  GeminiUnavailableError,
  generateBriefViaGemini,
} from "./gemini";
import {
  OpenAIUnavailableError,
  generateBriefViaOpenAI,
} from "./openai";

/**
 * Router-shaped brief. The persisted `source` is always `"gemini"`
 * regardless of which provider answered — the storage enum is
 * (library | gm | gemini) and we don't extend it. The actual
 * provider is reported via `attempts` for logging/telemetry.
 */
export interface AIBriefOutput {
  source: "gemini";
  title: string;
  rules: string[];
}

export interface RouterAttempt {
  provider: "gemini" | "openai";
  ok: boolean;
  reason?: string;
}

export interface RouterResult {
  brief: AIBriefOutput;
  attempts: RouterAttempt[];
}

export interface AIBriefInput {
  role: BriefRole;
  complexity: number;
  exclude_titles?: string[];
  /**
   * Cap on attempts. Defaults to ["gemini", "openai"] in that order.
   * Pass a shorter list to force a single provider (e.g. for unit
   * testing the OpenAI path without hitting Gemini).
   */
  providers?: Array<"gemini" | "openai">;
}

/**
 * Provider-agnostic brief generator. Tries Gemini first (cheaper +
 * already used elsewhere in the project), falls back to OpenAI on
 * any failure. Throws only when ALL providers fail or none are
 * configured.
 *
 * Earlier passes called Gemini directly with no fallback, so any
 * outage / rate-limit / schema-violation silently routed everyone to
 * the static library — GMs reported "AI briefs never work". The
 * router pattern (LiteLLM-style) keeps the AI path live whenever any
 * configured provider is healthy, and exposes per-attempt diagnostics
 * so the orchestrator can log which path actually succeeded.
 */
export async function generateBriefViaAI(
  input: AIBriefInput,
): Promise<RouterResult> {
  const providers = input.providers ?? ["gemini", "openai"];
  const attempts: RouterAttempt[] = [];
  let lastReason = "no_providers_configured";

  for (const provider of providers) {
    try {
      if (provider === "gemini") {
        const brief = await generateBriefViaGemini({
          role: input.role,
          complexity: input.complexity,
          exclude_titles: input.exclude_titles,
        });
        attempts.push({ provider: "gemini", ok: true });
        return {
          brief: {
            source: "gemini",
            title: brief.title,
            rules: brief.rules,
          },
          attempts,
        };
      }
      if (provider === "openai") {
        const brief = await generateBriefViaOpenAI({
          role: input.role,
          complexity: input.complexity,
          exclude_titles: input.exclude_titles,
        });
        attempts.push({ provider: "openai", ok: true });
        return {
          brief: {
            // Normalised to "gemini" for storage compatibility; the
            // attempts array carries the actual provider.
            source: "gemini",
            title: brief.title,
            rules: brief.rules,
          },
          attempts,
        };
      }
    } catch (err) {
      const reason =
        err instanceof GeminiUnavailableError
          ? "unconfigured"
          : err instanceof OpenAIUnavailableError
            ? "unconfigured"
            : err instanceof Error
              ? err.message
              : String(err);
      attempts.push({ provider, ok: false, reason });
      lastReason = reason;
      // Log so the GM-facing surface can correlate failures even
      // before we wire structured telemetry. console.warn is the
      // canonical noisy-but-non-fatal path used by lib/realtime.
      console.warn(
        `[briefs] ${provider} provider failed: ${reason}; trying next provider if any.`,
      );
    }
  }

  throw new AIBriefRouterError(lastReason, attempts);
}

/**
 * Thrown when every configured provider failed. Carries the list of
 * per-provider attempts so the caller (orchestrator) can decide
 * whether to fall back to library or surface a typed error to the
 * GM.
 */
export class AIBriefRouterError extends Error {
  constructor(
    public readonly reason: string,
    public readonly attempts: RouterAttempt[],
  ) {
    super(`AI brief router exhausted all providers: ${reason}`);
    this.name = "AIBriefRouterError";
  }
}
