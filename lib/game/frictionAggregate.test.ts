import { describe, expect, it, vi } from "vitest";

// `frictionAggregate.ts` imports `server-only` to gate it server-
// side; vitest needs that mocked away to load the module.
vi.mock("server-only", () => ({}));

import {
  ASYMMETRY_THRESHOLD,
  MIN_RESPONSES_FOR_AGGREGATE,
  aggregateFrictionByRound,
} from "./frictionAggregate";
import type { RoundSurveyRecord } from "./repository";

function row(
  participant_id: string,
  attr_self: number,
  attr_partner: number,
  attr_system: number,
  comm_balance = 50,
): RoundSurveyRecord {
  return {
    id: `survey-${participant_id}`,
    round_id: "r1",
    participant_id,
    comm_balance,
    attr_self,
    attr_partner,
    attr_system,
    submitted_at: new Date().toISOString(),
  };
}

function input(
  responses: RoundSurveyRecord[],
  roleByParticipantId: Map<string, "builder" | "guider"> = new Map(),
) {
  return {
    round_id: "r1",
    round_index: 1,
    responses,
    roleByParticipantId,
  };
}

describe("aggregateFrictionByRound — suppression floor", () => {
  it(`drops rounds with fewer than ${MIN_RESPONSES_FOR_AGGREGATE} v2 responses`, () => {
    const out = aggregateFrictionByRound([
      input([
        row("p1", 33, 33, 34),
        row("p2", 25, 25, 50),
        row("p3", 0, 50, 50),
      ]),
    ]);
    expect(out.rounds).toEqual([]);
    // Surfaces under-floor rounds so the GameEndedView can show a
    // suppression hint instead of vanishing the card silently.
    expect(out.suppressed).toEqual([
      { round_id: "r1", round_index: 1, response_count: 3 },
    ]);
  });

  it("emits the round once the floor is cleared", () => {
    const out = aggregateFrictionByRound([
      input([
        row("p1", 33, 33, 34),
        row("p2", 33, 33, 34),
        row("p3", 33, 33, 34),
        row("p4", 33, 33, 34),
      ]),
    ]);
    expect(out.rounds.length).toBe(1);
    expect(out.rounds[0]!.response_count).toBe(4);
  });

  it("ignores legacy v1 rows where attr_* sum is 0 (treated as absent)", () => {
    const v1 = row("p-old", 0, 0, 0);
    const v2 = [
      row("p1", 33, 33, 34),
      row("p2", 33, 33, 34),
      row("p3", 33, 33, 34),
      row("p4", 33, 33, 34),
    ];
    const out = aggregateFrictionByRound([input([v1, ...v2])]);
    expect(out.rounds[0]!.response_count).toBe(4);
  });

  it("rounds with zero v2 responses don't appear in suppressed", () => {
    // Survey wasn't filled; nothing to anonymise but also nothing
    // for the "below floor" hint to surface.
    const out = aggregateFrictionByRound([input([])]);
    expect(out.rounds).toEqual([]);
    expect(out.suppressed).toEqual([]);
  });
});

describe("aggregateFrictionByRound — means", () => {
  it("computes the overall friction mean across all v2 responses", () => {
    const out = aggregateFrictionByRound([
      input([
        row("p1", 50, 30, 20),
        row("p2", 50, 30, 20),
        row("p3", 50, 30, 20),
        row("p4", 50, 30, 20),
      ]),
    ]);
    expect(out.rounds[0]!.mean).toEqual({ self: 50, partner: 30, system: 20 });
  });

  it("splits means by role when both sides answered", () => {
    const roleMap = new Map<string, "builder" | "guider">([
      ["b1", "builder"],
      ["b2", "builder"],
      ["g1", "guider"],
      ["g2", "guider"],
    ]);
    const out = aggregateFrictionByRound([
      input(
        [
          row("b1", 60, 20, 20),
          row("b2", 60, 20, 20),
          row("g1", 20, 60, 20),
          row("g2", 20, 60, 20),
        ],
        roleMap,
      ),
    ]);
    expect(out.rounds[0]!.by_role.builder).toEqual({
      self: 60,
      partner: 20,
      system: 20,
    });
    expect(out.rounds[0]!.by_role.guider).toEqual({
      self: 20,
      partner: 60,
      system: 20,
    });
  });

  it("by_role.guider is null when no guider responded", () => {
    const roleMap = new Map<string, "builder" | "guider">([
      ["b1", "builder"],
      ["b2", "builder"],
      ["b3", "builder"],
      ["b4", "builder"],
    ]);
    const out = aggregateFrictionByRound([
      input(
        [
          row("b1", 50, 30, 20),
          row("b2", 50, 30, 20),
          row("b3", 50, 30, 20),
          row("b4", 50, 30, 20),
        ],
        roleMap,
      ),
    ]);
    expect(out.rounds[0]!.by_role.builder).not.toBeNull();
    expect(out.rounds[0]!.by_role.guider).toBeNull();
  });
});

describe("aggregateFrictionByRound — asymmetry detection", () => {
  it("flags axes where |builder - guider| >= threshold", () => {
    const roleMap = new Map<string, "builder" | "guider">([
      ["b1", "builder"],
      ["b2", "builder"],
      ["g1", "guider"],
      ["g2", "guider"],
    ]);
    // Builders blame self ~70%; guiders blame builders' partner side ~70%
    // (i.e. self~10) — axis "self" has a 60-point delta well above
    // the 15-point threshold.
    const out = aggregateFrictionByRound([
      input(
        [
          row("b1", 70, 20, 10),
          row("b2", 70, 20, 10),
          row("g1", 10, 70, 20),
          row("g2", 10, 70, 20),
        ],
        roleMap,
      ),
    ]);
    expect(out.rounds[0]!.asymmetry.length).toBeGreaterThan(0);
    expect(out.rounds[0]!.asymmetry[0]!.axis).toBe("self");
    expect(out.rounds[0]!.asymmetry[0]!.delta).toBeGreaterThanOrEqual(
      ASYMMETRY_THRESHOLD,
    );
  });

  it("emits no asymmetry when builder + guider averages converge", () => {
    const roleMap = new Map<string, "builder" | "guider">([
      ["b1", "builder"],
      ["b2", "builder"],
      ["g1", "guider"],
      ["g2", "guider"],
    ]);
    const out = aggregateFrictionByRound([
      input(
        [
          row("b1", 33, 33, 34),
          row("b2", 33, 33, 34),
          row("g1", 30, 35, 35),
          row("g2", 30, 35, 35),
        ],
        roleMap,
      ),
    ]);
    expect(out.rounds[0]!.asymmetry).toEqual([]);
  });

  it("sorts asymmetry by descending delta", () => {
    const roleMap = new Map<string, "builder" | "guider">([
      ["b1", "builder"],
      ["b2", "builder"],
      ["g1", "guider"],
      ["g2", "guider"],
    ]);
    // Build deltas: self ~30, partner ~30, system ~60.
    const out = aggregateFrictionByRound([
      input(
        [
          row("b1", 50, 50, 0),
          row("b2", 50, 50, 0),
          row("g1", 20, 20, 60),
          row("g2", 20, 20, 60),
        ],
        roleMap,
      ),
    ]);
    expect(out.rounds[0]!.asymmetry[0]!.axis).toBe("system");
    // The system delta is the largest; the other axes follow.
    expect(out.rounds[0]!.asymmetry[0]!.delta).toBeGreaterThanOrEqual(
      out.rounds[0]!.asymmetry[1]?.delta ?? 0,
    );
  });
});
