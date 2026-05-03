import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only so we can import a "server-only" module under test.
vi.mock("server-only", () => ({}));

// Repository + AI router are mocked at module level. Each test resets
// the mock implementations so we don't bleed state across cases.
vi.mock("@/lib/game/getRepository", () => {
  return {
    getRepository: () => ({
      games: { reserveGeminiCall: reserveGeminiMock },
      briefs: { listLibrary: listLibraryMock },
    }),
  };
});

// The orchestrator delegates AI brief generation to lib/briefs/router,
// which fans across providers (currently openai → gemini, library is
// the orchestrator-level final fallback). Mocking the router lets us
// drive every fallback branch without touching provider internals;
// the per-provider call sequence is the router's responsibility and
// is covered by router-level tests rather than here.
vi.mock("./router", () => ({
  generateBriefViaAI: (...args: unknown[]) => routerMock(...args),
  AIBriefRouterError: class AIBriefRouterError extends Error {
    constructor(
      public readonly reason: string,
      public readonly attempts: Array<{ provider: string; ok: boolean }>,
    ) {
      super(`router exhausted: ${reason}`);
      this.name = "AIBriefRouterError";
    }
  },
}));

let reserveGeminiMock = vi.fn();
let listLibraryMock = vi.fn();
let routerMock = vi.fn();

beforeEach(() => {
  reserveGeminiMock = vi.fn();
  listLibraryMock = vi.fn();
  routerMock = vi.fn();
});
afterEach(() => {
  vi.clearAllMocks();
});

import {
  GeminiBriefFailedError,
  pickBrief,
} from "./orchestrator";
import { AIBriefRouterError } from "./router";

describe("pickBrief — gm source", () => {
  it("returns the GM-supplied custom brief verbatim", async () => {
    const result = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gm",
      game_id: "g1",
      custom: { title: "Custom B", rules: ["one rule"] },
    });
    expect(result).toEqual({
      source: "gm",
      title: "Custom B",
      rules: ["one rule"],
    });
    // Should NOT have hit the AI router or the library.
    expect(reserveGeminiMock).not.toHaveBeenCalled();
    expect(listLibraryMock).not.toHaveBeenCalled();
    expect(routerMock).not.toHaveBeenCalled();
  });

  it("falls back to library when source=gm but custom is null", async () => {
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "Library B",
        rules: ["lib rule"],
      },
    ]);
    const result = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gm",
      game_id: "g1",
      custom: null,
    });
    expect(result.source).toBe("library");
    expect(result.title).toBe("Library B");
  });
});

describe("pickBrief — gemini path (AI router)", () => {
  it("returns the router brief when reservation OK and router resolves", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    routerMock.mockResolvedValue({
      brief: { source: "gemini", title: "AI Brief", rules: ["AI rule"] },
      attempts: [{ provider: "openai", ok: true }],
    });
    const r = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gemini",
      game_id: "g1",
    });
    expect(r.source).toBe("gemini");
    expect(r.title).toBe("AI Brief");
    expect(reserveGeminiMock).toHaveBeenCalledOnce();
    expect(routerMock).toHaveBeenCalledOnce();
    expect(listLibraryMock).not.toHaveBeenCalled();
  });

  it("falls back to library when budget exhausted and allow_library_fallback (default true)", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: false, reason: "per_day_cap" });
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "Fallback B",
        rules: ["fb"],
      },
    ]);
    const r = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gemini",
      game_id: "g1",
    });
    expect(r.source).toBe("library");
    expect(r.title).toBe("Fallback B");
    expect(routerMock).not.toHaveBeenCalled();
  });

  it("throws GeminiBriefFailedError when budget exhausted and fallback disabled", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: false, reason: "per_day_cap" });
    await expect(
      pickBrief({
        role: "builder",
        complexity: 5,
        source: "gemini",
        game_id: "g1",
        allow_library_fallback: false,
      }),
    ).rejects.toBeInstanceOf(GeminiBriefFailedError);
  });

  it("falls back to library when the router throws AIBriefRouterError and fallback enabled", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    routerMock.mockRejectedValue(
      new AIBriefRouterError("all_providers_failed", [
        { provider: "openai", ok: false },
        { provider: "gemini", ok: false },
      ]),
    );
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "FB",
        rules: ["x"],
      },
    ]);
    const r = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gemini",
      game_id: "g1",
      allow_library_fallback: true,
    });
    expect(r.source).toBe("library");
  });

  it("throws GeminiBriefFailedError when router fails and fallback disabled", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    routerMock.mockRejectedValue(
      new AIBriefRouterError("all_providers_failed", []),
    );
    await expect(
      pickBrief({
        role: "builder",
        complexity: 5,
        source: "gemini",
        game_id: "g1",
        allow_library_fallback: false,
      }),
    ).rejects.toBeInstanceOf(GeminiBriefFailedError);
  });

  it("library fallback also triggers when reservation throws unexpectedly", async () => {
    reserveGeminiMock.mockRejectedValue(new Error("rpc oops"));
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "FB",
        rules: ["x"],
      },
    ]);
    const r = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gemini",
      game_id: "g1",
    });
    expect(r.source).toBe("library");
  });

  it("library fallback also triggers when the router throws a non-AIBriefRouterError", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    routerMock.mockRejectedValue(new Error("network blip"));
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "FB",
        rules: ["x"],
      },
    ]);
    const r = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "gemini",
      game_id: "g1",
    });
    expect(r.source).toBe("library");
  });
});

describe("pickBrief — library source", () => {
  it("returns a library brief when source=library", async () => {
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "L1",
        rules: ["r"],
      },
    ]);
    const r = await pickBrief({
      role: "builder",
      complexity: 5,
      source: "library",
      game_id: "g1",
    });
    expect(r.source).toBe("library");
    expect(r.title).toBe("L1");
    expect(reserveGeminiMock).not.toHaveBeenCalled();
    expect(routerMock).not.toHaveBeenCalled();
  });

  it("library passes exclude_titles through (caller is responsible for matching)", async () => {
    listLibraryMock.mockResolvedValue([
      {
        id: "lib1",
        role: "builder",
        complexity: 5,
        title: "Pick-me",
        rules: ["r"],
      },
    ]);
    await pickBrief({
      role: "builder",
      complexity: 5,
      source: "library",
      game_id: "g1",
      exclude_titles: ["Used Already"],
    });
    expect(listLibraryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "builder",
        complexity: 5,
        exclude_titles: ["Used Already"],
      }),
    );
  });
});
