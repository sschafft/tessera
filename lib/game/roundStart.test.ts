import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Suppress the orchestrator's network calls — we don't want them in
// unit tests, and the mock returns a deterministic library brief so
// the orchestrator's commit phase can run.
vi.mock("@/lib/briefs/orchestrator", () => ({
  pickBrief: (...args: unknown[]) => pickBriefMock(...args),
  GeminiBriefFailedError: class GeminiBriefFailedError extends Error {
    constructor(
      public readonly role: "builder" | "guider",
      public readonly reason: string,
    ) {
      super(`gemini brief failed for ${role}: ${reason}`);
      this.name = "GeminiBriefFailedError";
    }
  },
}));
// Realtime publish is a no-op in tests.
vi.mock("@/lib/realtime/publish", () => ({
  publishGameEvent: () => Promise.resolve(),
}));

let pickBriefMock = vi.fn();

beforeEach(() => {
  pickBriefMock = vi.fn(async ({ role, complexity }: { role: string; complexity: number }) => ({
    source: "library",
    title: `${role}-${complexity}`,
    rules: ["one"],
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});

import { startRound } from "./roundStart";
import type { GameRecord, GameRepository } from "./repository";
// `GeminiBriefFailedError` resolves through the vi.mock above so
// `pickBrief` rejections that match are typed correctly.
import { GeminiBriefFailedError } from "@/lib/briefs/orchestrator";

function makeGame(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: "g1",
    code: "ABC-XYZ",
    workshop_name: "test",
    video_call_url: null,
    whiteboard_url: null,
    team_mode: "gm_picks",
    default_complexity: 3,
    builder_brief_on: true,
    guider_brief_on: true,
    builder_brief_source: "library",
    guider_brief_source: "library",
    builder_brief_custom: null,
    guider_brief_custom: null,
    round_count: 1,
    round_duration_seconds: 600,
    participant_cap: 4,
    sound_on: true,
    breakout_provider: "none",
    meeting_mode: "remote",
    host_token_hash: "h",
    gm_participant_id: "gm",
    status: "lobby",
    scoring_correct_pts: 10,
    scoring_wrong_pts: 0,
    created_at: new Date().toISOString(),
    last_interaction_at: new Date().toISOString(),
    ended_at: null,
    gemini_calls_used: 0,
    ...overrides,
  };
}

interface MockRepoState {
  pairs: { id: string }[];
  latestRound:
    | { id: string; index: number; status: "pending" | "running" | "ended" }
    | null;
  createdRound:
    | { id: string; index: number; complexity: number; duration_seconds: number }
    | null;
  pairRoundsCreated: Array<{ pair_id: string; pattern_seed: string }>;
  briefsUpserted: Array<{ pair_round_id: string; role: string; title: string }>;
  pendingRoundsDeleted: string[];
  startedRounds: string[];
  setStatusCalls: Array<{ id: string; status: string }>;
}

function makeRepo(state: MockRepoState): GameRepository {
  return {
    games: {
      findByCode: () => Promise.resolve(null),
      create: () => Promise.reject(new Error("unused")),
      setStatus: (id: string, status: string) => {
        state.setStatusCalls.push({ id, status });
        return Promise.resolve();
      },
      updateScoring: () => Promise.resolve(),
      setBriefOn: () => Promise.resolve(),
      reserveGeminiCall: () =>
        Promise.resolve({ ok: true, perGame: 1, perDay: 1 }),
    },
    participants: {} as never,
    pairs: {
      list: () => Promise.resolve(state.pairs as never),
    } as never,
    rounds: {
      findLatest: () => Promise.resolve(state.latestRound as never),
      delete: (round_id: string) => {
        state.pendingRoundsDeleted.push(round_id);
        return Promise.resolve();
      },
      create: (input: {
        index: number;
        complexity: number;
        duration_seconds: number;
      }) => {
        state.createdRound = {
          id: `round-${input.index}`,
          index: input.index,
          complexity: input.complexity,
          duration_seconds: input.duration_seconds,
        };
        return Promise.resolve(state.createdRound as never);
      },
      start: (round_id: string) => {
        state.startedRounds.push(round_id);
        return Promise.resolve();
      },
    } as never,
    pairRounds: {
      create: (input: {
        pair_id: string;
        pattern_seed: string;
      }) => {
        state.pairRoundsCreated.push({
          pair_id: input.pair_id,
          pattern_seed: input.pattern_seed,
        });
        return Promise.resolve({
          id: `pr-${state.pairRoundsCreated.length}`,
        } as never);
      },
    } as never,
    briefs: {
      upsert: (input: {
        pair_round_id: string;
        role: string;
        title: string;
      }) => {
        state.briefsUpserted.push({
          pair_round_id: input.pair_round_id,
          role: input.role,
          title: input.title,
        });
        return Promise.resolve({} as never);
      },
    } as never,
    placements: {} as never,
    superPowers: {} as never,
    roundSurveys: {} as never,
  } as unknown as GameRepository;
}

function makeState(over: Partial<MockRepoState> = {}): MockRepoState {
  return {
    pairs: [{ id: "pair-a" }, { id: "pair-b" }],
    latestRound: null,
    createdRound: null,
    pairRoundsCreated: [],
    briefsUpserted: [],
    pendingRoundsDeleted: [],
    startedRounds: [],
    setStatusCalls: [],
    ...over,
  };
}

describe("startRound — shared start/replay orchestrator", () => {
  it("rejects when no pairs are allocated", async () => {
    const state = makeState({ pairs: [] });
    const r = await startRound(makeRepo(state), makeGame());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("no_pairs");
    expect(state.createdRound).toBeNull();
    expect(state.startedRounds.length).toBe(0);
  });

  it("rejects with round_already_running when a round is live (replay's missing gate)", async () => {
    const state = makeState({
      latestRound: { id: "r-prior", index: 1, status: "running" },
    });
    const r = await startRound(makeRepo(state), makeGame());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("round_already_running");
      expect(r.kind === "round_already_running" && r.round_id).toBe("r-prior");
    }
    expect(state.createdRound).toBeNull();
    expect(state.startedRounds.length).toBe(0);
  });

  it("drops a stale pending round before creating the new one", async () => {
    const state = makeState({
      latestRound: { id: "r-pending", index: 1, status: "pending" },
    });
    await startRound(makeRepo(state), makeGame());
    expect(state.pendingRoundsDeleted).toEqual(["r-pending"]);
    expect(state.createdRound?.index).toBe(1);
  });

  it("returns a typed gemini_failed result when AI brief fails (no DB writes)", async () => {
    pickBriefMock = vi.fn(async () => {
      throw new GeminiBriefFailedError("builder", "router_exhausted");
    });
    const state = makeState();
    const r = await startRound(makeRepo(state), makeGame());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("gemini_failed");
      expect(r.kind === "gemini_failed" && r.failed_role).toBe("builder");
    }
    // Critical: preflight failure must not leave any DB rows behind.
    expect(state.createdRound).toBeNull();
    expect(state.pairRoundsCreated.length).toBe(0);
    expect(state.briefsUpserted.length).toBe(0);
    expect(state.startedRounds.length).toBe(0);
  });

  it("commits round + pair_rounds + briefs and starts the round on the happy path", async () => {
    const state = makeState();
    const r = await startRound(makeRepo(state), makeGame());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.index).toBe(1);
      expect(r.pairs).toBe(2);
    }
    expect(state.createdRound?.index).toBe(1);
    expect(state.pairRoundsCreated.map((p) => p.pair_id)).toEqual([
      "pair-a",
      "pair-b",
    ]);
    expect(state.briefsUpserted.length).toBe(4); // 2 pairs × 2 roles
    expect(state.startedRounds.length).toBe(1);
    expect(state.setStatusCalls).toContainEqual({
      id: "g1",
      status: "running",
    });
  });

  it("dedupes brief titles across pairs (cross-pair exclude_titles)", async () => {
    // The orchestrator passes the same `usedBuilderTitles` array
    // reference into successive `pickBrief` calls and mutates it
    // in-flight. Snapshotting via `mock.calls` would observe the
    // final state for every call (reference semantics) — instead
    // capture the state at call time inside the mock implementation.
    const builderExcludesAtCall: string[][] = [];
    pickBriefMock = vi.fn(
      async (input: { role: string; complexity: number; exclude_titles?: string[] }) => {
        if (input.role === "builder") {
          builderExcludesAtCall.push([...(input.exclude_titles ?? [])]);
        }
        return {
          source: "library",
          title: `${input.role}-${input.complexity}`,
          rules: ["one"],
        };
      },
    );
    const state = makeState();
    await startRound(makeRepo(state), makeGame());
    expect(builderExcludesAtCall).toEqual([[], ["builder-3"]]);
  });

  it("clamps complexity to 1..8", async () => {
    const state = makeState();
    const r = await startRound(makeRepo(state), makeGame(), {
      complexity: 99,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.complexity).toBe(8);
  });

  it("uses next index after the last ended round", async () => {
    const state = makeState({
      latestRound: { id: "r-ended", index: 3, status: "ended" },
    });
    await startRound(makeRepo(state), makeGame());
    expect(state.createdRound?.index).toBe(4);
  });

  it("rejects when game.status === 'purged'", async () => {
    const state = makeState();
    const r = await startRound(makeRepo(state), makeGame({ status: "purged" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("game_purged");
    expect(state.createdRound).toBeNull();
  });
});
