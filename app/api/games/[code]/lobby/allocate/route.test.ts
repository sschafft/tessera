import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Repo, session, and realtime publish are mocked at module level so we
// can exercise the route's invariant gates without standing up Supabase.
vi.mock("@/lib/auth/session", () => ({
  readSessionForGame: () => Promise.resolve(sessionMock()),
}));
vi.mock("@/lib/game/getRepository", () => ({
  getRepository: () => repoMock(),
}));
vi.mock("@/lib/realtime/publish", () => ({
  publishGameEvent: () => Promise.resolve(),
}));

interface ParticipantRowMock {
  id: string;
  display_name: string;
  role: "builder" | "guider" | "observer" | "lobby" | "gm";
  pair_id: string | null;
  released_at: string | null;
}

interface PairRowMock {
  id: string;
  game_id: string;
  builder_id: string | null;
  guider_id: string | null;
}

let sessionMock: () => { code: string; role: string; game_id: string; sub: string } | null;
let repoMock: () => {
  games: { findByCode: (code: string) => Promise<{ id: string } | null> };
  rounds: {
    findLatest: (game_id: string) => Promise<
      { id: string; status: "pending" | "running" | "ended" } | null
    >;
  };
  participants: {
    listActive: (game_id: string) => Promise<ParticipantRowMock[]>;
  };
  pairs: {
    list: (game_id: string) => Promise<PairRowMock[]>;
    create: (
      game_id: string,
      builder_id: string,
      guider_id: string,
    ) => Promise<PairRowMock>;
    assignObserver: (
      participant_id: string,
      pair_id: string,
    ) => Promise<void>;
    clearAllocations: (game_id: string) => Promise<void>;
  };
};

let createCalls: Array<[string, string, string]>;
let assignObserverCalls: Array<[string, string]>;

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/games/ABC-XYZ/lobby/allocate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  createCalls = [];
  assignObserverCalls = [];
  sessionMock = () => ({
    code: "ABC-XYZ",
    role: "gm",
    game_id: "g1",
    sub: "gm-pid",
  });
  repoMock = () => ({
    games: { findByCode: () => Promise.resolve({ id: "g1" }) },
    rounds: { findLatest: () => Promise.resolve(null) },
    participants: { listActive: () => Promise.resolve([]) },
    pairs: {
      list: () => Promise.resolve([]),
      create: (game_id, builder_id, guider_id) => {
        createCalls.push([game_id, builder_id, guider_id]);
        return Promise.resolve({
          id: `pair-${createCalls.length}`,
          game_id,
          builder_id,
          guider_id,
        });
      },
      assignObserver: (participant_id, pair_id) => {
        assignObserverCalls.push([participant_id, pair_id]);
        return Promise.resolve();
      },
      clearAllocations: () => Promise.resolve(),
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/games/:code/lobby/allocate — invariants", () => {
  it("rejects with 409 round_running when the latest round is live", async () => {
    repoMock = () => ({
      games: { findByCode: () => Promise.resolve({ id: "g1" }) },
      rounds: {
        findLatest: () =>
          Promise.resolve({ id: "r1", status: "running" as const }),
      },
      participants: { listActive: () => Promise.resolve([]) },
      pairs: {
        list: () => Promise.resolve([]),
        create: () =>
          Promise.reject(new Error("create should not be called")),
        assignObserver: () =>
          Promise.reject(new Error("assignObserver should not be called")),
        clearAllocations: () =>
          Promise.reject(new Error("clearAllocations should not be called")),
      },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ kind: "auto" }), {
      params: Promise.resolve({ code: "ABC-XYZ" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("round_running");
  });

  it("rejects pair allocation when a participant is already paired", async () => {
    repoMock = () => ({
      games: { findByCode: () => Promise.resolve({ id: "g1" }) },
      rounds: { findLatest: () => Promise.resolve(null) },
      participants: {
        listActive: () =>
          Promise.resolve([
            {
              id: "p1",
              display_name: "Avery",
              role: "lobby",
              pair_id: null,
              released_at: null,
            },
            {
              id: "p2",
              display_name: "Bri",
              role: "builder",
              pair_id: "existing-pair",
              released_at: null,
            },
          ]),
      },
      pairs: {
        list: () => Promise.resolve([]),
        create: (game_id, builder_id, guider_id) => {
          createCalls.push([game_id, builder_id, guider_id]);
          return Promise.resolve({
            id: "p",
            game_id,
            builder_id,
            guider_id,
          });
        },
        assignObserver: () => Promise.resolve(),
        clearAllocations: () => Promise.resolve(),
      },
    });

    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        kind: "pair",
        participant_ids: ["p1", "p2"],
        builder_id: "p1",
      }),
      { params: Promise.resolve({ code: "ABC-XYZ" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("participant_not_in_lobby");
    expect(body.participant_id).toBe("p2");
    expect(createCalls.length).toBe(0);
  });

  it("rejects observer allocation when a participant isn't lobby + unpaired", async () => {
    repoMock = () => ({
      games: { findByCode: () => Promise.resolve({ id: "g1" }) },
      rounds: { findLatest: () => Promise.resolve(null) },
      participants: {
        listActive: () =>
          Promise.resolve([
            {
              id: "p1",
              display_name: "Avery",
              role: "observer",
              pair_id: "other-pair",
              released_at: null,
            },
          ]),
      },
      pairs: {
        list: () =>
          Promise.resolve([
            { id: "target-pair", game_id: "g1", builder_id: null, guider_id: null },
          ]),
        create: () => Promise.reject(new Error("not used")),
        assignObserver: () => Promise.reject(new Error("must not run")),
        clearAllocations: () => Promise.resolve(),
      },
    });

    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        kind: "observer",
        participant_ids: ["p1"],
        pair_id: "target-pair",
      }),
      { params: Promise.resolve({ code: "ABC-XYZ" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("participant_not_in_lobby");
    expect(body.participant_id).toBe("p1");
    expect(assignObserverCalls.length).toBe(0);
  });

  it("accepts a valid pair allocation in the happy-path lobby state", async () => {
    repoMock = () => ({
      games: { findByCode: () => Promise.resolve({ id: "g1" }) },
      rounds: { findLatest: () => Promise.resolve(null) },
      participants: {
        listActive: () =>
          Promise.resolve([
            {
              id: "p1",
              display_name: "Avery",
              role: "lobby",
              pair_id: null,
              released_at: null,
            },
            {
              id: "p2",
              display_name: "Bri",
              role: "lobby",
              pair_id: null,
              released_at: null,
            },
          ]),
      },
      pairs: {
        list: () => Promise.resolve([]),
        create: (game_id, builder_id, guider_id) => {
          createCalls.push([game_id, builder_id, guider_id]);
          return Promise.resolve({
            id: "pair-1",
            game_id,
            builder_id,
            guider_id,
          });
        },
        assignObserver: () => Promise.resolve(),
        clearAllocations: () => Promise.resolve(),
      },
    });

    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        kind: "pair",
        participant_ids: ["p1", "p2"],
        builder_id: "p1",
      }),
      { params: Promise.resolve({ code: "ABC-XYZ" }) },
    );
    expect(res.status).toBe(200);
    expect(createCalls).toEqual([["g1", "p1", "p2"]]);
  });
});
