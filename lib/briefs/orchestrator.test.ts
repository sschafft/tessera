import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only so we can import a "server-only" module under test.
vi.mock("server-only", () => ({}));

// Repository + Gemini are mocked at module level. Each test resets the
// mock implementations so we don't bleed state across cases.
vi.mock("@/lib/game/getRepository", () => {
  return {
    getRepository: () => ({
      reserveGeminiCall: reserveGeminiMock,
      listLibraryBriefs: listLibraryMock,
    }),
  };
});

vi.mock("./gemini", () => ({
  generateBriefViaGemini: (...args: unknown[]) => geminiMock(...args),
  GeminiUnavailableError: class GeminiUnavailableError extends Error {},
  GeminiResponseError: class GeminiResponseError extends Error {},
}));

let reserveGeminiMock = vi.fn();
let listLibraryMock = vi.fn();
let geminiMock = vi.fn();

beforeEach(() => {
  reserveGeminiMock = vi.fn();
  listLibraryMock = vi.fn();
  geminiMock = vi.fn();
});
afterEach(() => {
  vi.clearAllMocks();
});

import {
  GeminiBriefFailedError,
  pickBrief,
} from "./orchestrator";

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
    // Should NOT have hit Gemini or the library.
    expect(reserveGeminiMock).not.toHaveBeenCalled();
    expect(listLibraryMock).not.toHaveBeenCalled();
    expect(geminiMock).not.toHaveBeenCalled();
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

describe("pickBrief — gemini path", () => {
  it("succeeds when reservation OK and Gemini returns a brief", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    geminiMock.mockResolvedValue({
      source: "gemini",
      title: "AI Brief",
      rules: ["AI rule"],
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
    expect(geminiMock).toHaveBeenCalledOnce();
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
    expect(geminiMock).not.toHaveBeenCalled();
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

  it("falls back to library when Gemini call rejects and fallback enabled", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    geminiMock.mockRejectedValue(new Error("network"));
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

  it("throws GeminiBriefFailedError when Gemini call rejects and fallback disabled", async () => {
    reserveGeminiMock.mockResolvedValue({ ok: true, perGame: 1, perDay: 1 });
    geminiMock.mockRejectedValue(new Error("timeout"));
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

  it("Gemini reservation throw also routes through fallback semantics", async () => {
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
    expect(geminiMock).not.toHaveBeenCalled();
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
