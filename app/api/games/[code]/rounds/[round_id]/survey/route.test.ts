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

interface UpsertInput {
  round_id: string;
  participant_id: string;
  fric_puzzle: number;
  fric_communication: number;
  fric_time_pressure: number;
  fric_game_adjustments: number;
  fric_other: number;
  fric_other_text: string | null;
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
    upsert: (input: UpsertInput) => Promise<UpsertInput & { submitted_at: string }>;
    findForParticipant: (
      round_id: string,
      participant_id: string,
    ) => Promise<unknown>;
  };
};

let upsertCalls: UpsertInput[];

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
          ...input,
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

describe("POST .../rounds/[round_id]/survey — category sliders", () => {
  it("rejects each fric_* outside 0..100", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        fric_puzzle: 150,
        fric_communication: -5,
        fric_time_pressure: 0,
        fric_game_adjustments: 0,
        fric_other: 0,
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(400);
    expect(upsertCalls.length).toBe(0);
  });

  it("rejects fric_other_text longer than the cap", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        fric_puzzle: 10,
        fric_communication: 10,
        fric_time_pressure: 10,
        fric_game_adjustments: 10,
        fric_other: 40,
        fric_other_text: "x".repeat(300),
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("fric_other_text_too_long");
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
            ...input,
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
        fric_puzzle: 20,
        fric_communication: 20,
        fric_time_pressure: 20,
        fric_game_adjustments: 20,
        fric_other: 0,
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

  it("upserts the survey on the happy path (other text saved when fric_other > 0)", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        fric_puzzle: 30,
        fric_communication: 60,
        fric_time_pressure: 0,
        fric_game_adjustments: 15,
        fric_other: 45,
        fric_other_text: "  zoom audio kept dropping  ",
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
        fric_puzzle: 30,
        fric_communication: 60,
        fric_time_pressure: 0,
        fric_game_adjustments: 15,
        fric_other: 45,
        fric_other_text: "zoom audio kept dropping",
      },
    ]);
  });

  it("trims fric_other_text to null when only whitespace", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        fric_puzzle: 10,
        fric_communication: 10,
        fric_time_pressure: 10,
        fric_game_adjustments: 10,
        fric_other: 10,
        fric_other_text: "   ",
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(200);
    expect(upsertCalls[0]?.fric_other_text).toBeNull();
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
        fric_puzzle: 20,
        fric_communication: 20,
        fric_time_pressure: 20,
        fric_game_adjustments: 20,
        fric_other: 0,
      }),
      {
        params: Promise.resolve({ code: "ABC-XYZ", round_id: "round-1" }),
      },
    );
    expect(res.status).toBe(403);
    expect(upsertCalls.length).toBe(0);
  });
});
