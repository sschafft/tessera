import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  readSessionAndParticipant: () => Promise.resolve(sessionMock()),
}));
vi.mock("@/lib/game/getRepository", () => ({
  getRepository: () => repoMock(),
}));

interface MeMock {
  id: string;
  game_id: string;
  role: "builder" | "guider" | "observer" | "lobby" | "gm";
  released_at: string | null;
}

let sessionMock: () => { claims: { game_id: string }; me: MeMock } | null;
let repoMock: () => {
  rounds: {
    findLatest: (game_id: string) => Promise<{
      id: string;
      reflection_survey_requested: boolean;
      status: "pending" | "running" | "ended";
    } | null>;
  };
  roundSurveys: {
    upsert: (input: {
      round_id: string;
      participant_id: string;
      comm_balance: number;
      attr_self: number;
      attr_partner: number;
      attr_system: number;
    }) => Promise<{
      comm_balance: number;
      attr_self: number;
      attr_partner: number;
      attr_system: number;
      submitted_at: string;
    }>;
    findForParticipant: (
      round_id: string,
      participant_id: string,
    ) => Promise<unknown>;
  };
};

let upsertCalls: Array<unknown>;

function makeRequest(body: unknown): NextRequest {
  return new Request(
    "http://localhost/api/games/ABC-XYZ/rounds/round-1/survey",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  ) as unknown as NextRequest;
}

beforeEach(() => {
  upsertCalls = [];
  sessionMock = () => ({
    claims: { game_id: "g1" },
    me: {
      id: "p-builder",
      game_id: "g1",
      role: "builder",
      released_at: null,
    },
  });
  repoMock = () => ({
    rounds: {
      findLatest: () =>
        Promise.resolve({
          id: "round-1",
          reflection_survey_requested: true,
          status: "ended",
        }),
    },
    roundSurveys: {
      upsert: (input) => {
        upsertCalls.push(input);
        return Promise.resolve({
          comm_balance: input.comm_balance,
          attr_self: input.attr_self,
          attr_partner: input.attr_partner,
          attr_system: input.attr_system,
          submitted_at: new Date().toISOString(),
        });
      },
      findForParticipant: () => Promise.resolve(null),
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST .../rounds/[round_id]/survey — attribution payload", () => {
  it("rejects when attr_* don't sum to 100", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        comm_balance: 50,
        attr_self: 40,
        attr_partner: 40,
        attr_system: 10, // sums to 90
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("attr_sum_must_equal_100");
    expect(upsertCalls.length).toBe(0);
  });

  it("rejects each attr_* outside 0..100", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        comm_balance: 50,
        attr_self: 150, // out of range
        attr_partner: -50,
        attr_system: 0,
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(400);
    expect(upsertCalls.length).toBe(0);
  });

  it("rejects when the round didn't request a survey", async () => {
    repoMock = () => ({
      rounds: {
        findLatest: () =>
          Promise.resolve({
            id: "round-1",
            reflection_survey_requested: false,
            status: "ended",
          }),
      },
      roundSurveys: {
        upsert: (input) => {
          upsertCalls.push(input);
          return Promise.resolve({
            comm_balance: 50,
            attr_self: 33,
            attr_partner: 33,
            attr_system: 34,
            submitted_at: new Date().toISOString(),
          });
        },
        findForParticipant: () => Promise.resolve(null),
      },
    });
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        comm_balance: 50,
        attr_self: 33,
        attr_partner: 33,
        attr_system: 34,
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("survey_not_requested");
    expect(upsertCalls.length).toBe(0);
  });

  it("upserts the survey on the happy path", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        comm_balance: 60,
        attr_self: 33,
        attr_partner: 33,
        attr_system: 34,
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(200);
    expect(upsertCalls).toEqual([
      {
        round_id: "round-1",
        participant_id: "p-builder",
        comm_balance: 60,
        attr_self: 33,
        attr_partner: 33,
        attr_system: 34,
      },
    ]);
  });

  it("forbids observers from submitting", async () => {
    sessionMock = () => ({
      claims: { game_id: "g1" },
      me: {
        id: "p-observer",
        game_id: "g1",
        role: "observer",
        released_at: null,
      },
    });
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        comm_balance: 50,
        attr_self: 33,
        attr_partner: 33,
        attr_system: 34,
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(403);
    expect(upsertCalls.length).toBe(0);
  });
});
