import { describe, expect, it } from "vitest";
import {
  POLICIES,
  checkPolicy,
  countPriorEvents,
  type PriorEvent,
} from "./policy";

const at = (offsetSec: number, base = new Date("2026-04-27T12:00:00Z")) =>
  new Date(base.getTime() + offsetSec * 1000).toISOString();

const event = (
  kind: PriorEvent["kind"],
  scope: PriorEvent["scope"],
  pair_id: string | null,
  triggered_at: string,
): PriorEvent => ({ kind, scope, pair_id, triggered_at });

describe("countPriorEvents", () => {
  it("separates per-pair and per-all counts for the queried pair", () => {
    const events: PriorEvent[] = [
      event("prototype", "pair", "p1", at(0)),
      event("prototype", "pair", "p1", at(10)),
      event("prototype", "pair", "p2", at(20)),
      event("prototype", "all", null, at(30)),
    ];
    const { perPair, perAll } = countPriorEvents(events, "prototype", "p1");
    expect(perPair).toBe(2);
    expect(perAll).toBe(1);
  });

  it("zero counts when no events of the kind exist", () => {
    const events: PriorEvent[] = [event("reveal_briefs", "all", null, at(0))];
    const { perPair, perAll } = countPriorEvents(events, "prototype", "p1");
    expect(perPair).toBe(0);
    expect(perAll).toBe(0);
  });
});

describe("checkPolicy — caps", () => {
  const now = new Date("2026-04-27T12:30:00Z");

  it("allows the first trigger", () => {
    const r = checkPolicy({
      events: [],
      kind: "reveal_briefs",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects past-cap pair-scoped trigger", () => {
    const events: PriorEvent[] = [
      event("reveal_briefs", "pair", "p1", at(-300, now)),
    ];
    const r = checkPolicy({
      events,
      kind: "reveal_briefs",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cap_exceeded");
  });

  it("an all-scope trigger counts toward the per-pair cap", () => {
    const events: PriorEvent[] = [
      event("reveal_briefs", "all", null, at(-300, now)),
    ];
    const r = checkPolicy({
      events,
      kind: "reveal_briefs",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(false);
  });

  it("but the same all-scope event leaves a different pair untouched? — actually counts globally", () => {
    const events: PriorEvent[] = [
      event("reveal_briefs", "all", null, at(-300, now)),
    ];
    const r = checkPolicy({
      events,
      kind: "reveal_briefs",
      scope: "pair",
      pair_id: "p2",
      now,
    });
    // perPair=0 (no prior pair-scope event for p2), perAll=1, cap=1.
    // For pair-scope trigger we sum perPair + perAll = 1 ≥ cap → reject.
    expect(r.ok).toBe(false);
  });

  it("uncapped kinds always allow", () => {
    // change_builder_brief is uncapped (the 'change/add brief' super-power
    // can fire as many times as the GM wants in a round). Verify the
    // policy doesn't reject by count.
    const events: PriorEvent[] = Array.from({ length: 50 }, (_, i) =>
      event("change_builder_brief", "pair", "p1", at(i * 10, now)),
    );
    expect(POLICIES.change_builder_brief.maxPerRound).toBeNull();
    const r = checkPolicy({
      events,
      kind: "change_builder_brief",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("prototype is uncapped (always returns ok regardless of prior usage)", () => {
    // Prototype was previously capped at 4 per pair; the 2026-04-28
    // playtest cycle removed the cap (GMs hit it at the wrong moment
    // and had no escape valve). Cooldown still applies — see the
    // cooldown describe block below.
    expect(POLICIES.prototype.maxPerRound).toBeNull();
    const events: PriorEvent[] = Array.from({ length: 12 }, (_, i) =>
      event("prototype", "pair", "p1", at(i * 30 - 600, now)),
    );
    const r = checkPolicy({
      events,
      kind: "prototype",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("agile_share is uncapped per the playtest revision", () => {
    expect(POLICIES.agile_share.maxPerRound).toBeNull();
    const events: PriorEvent[] = Array.from({ length: 8 }, (_, i) =>
      event("agile_share", "pair", "p1", at(i * 60 - 600, now)),
    );
    const r = checkPolicy({
      events,
      kind: "agile_share",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });
});

describe("checkPolicy — cooldown", () => {
  const now = new Date("2026-04-27T12:30:00Z");

  it("blocks a trigger inside the cooldown window", () => {
    const events: PriorEvent[] = [
      event("prototype", "pair", "p1", at(-5, now)), // 5s ago, cooldown is 12s
    ];
    const r = checkPolicy({
      events,
      kind: "prototype",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cooldown_active");
  });

  it("allows a trigger past the cooldown window", () => {
    const events: PriorEvent[] = [
      event("prototype", "pair", "p1", at(-30, now)), // 30s ago, well past 12s
    ];
    const r = checkPolicy({
      events,
      kind: "prototype",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("kinds with cooldown=0 don't gate even on identical-timestamp events", () => {
    // reveal_briefs has cooldownSeconds=0; firing it twice with no
    // gap is a per-round-cap problem (cap=1), not a cooldown problem.
    // Use change_builder_brief which is uncapped + no cooldown.
    const events: PriorEvent[] = [
      event("change_builder_brief", "pair", "p1", at(0, now)),
    ];
    const r = checkPolicy({
      events,
      kind: "change_builder_brief",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("cooldown is keyed off most-recent same-kind event for the pair OR all-scope", () => {
    const events: PriorEvent[] = [
      event("prototype", "pair", "p2", at(-5, now)), // unrelated pair
      event("prototype", "pair", "p1", at(-30, now)), // p1, well past
    ];
    const r = checkPolicy({
      events,
      kind: "prototype",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });
});

describe("checkPolicy — implementation flag", () => {
  it("rejects unimplemented kinds with not_implemented", () => {
    const original = POLICIES.harder.implemented;
    POLICIES.harder.implemented = false;
    try {
      const r = checkPolicy({
        events: [],
        kind: "harder",
        scope: "all",
        pair_id: null,
        now: new Date(),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("not_implemented");
    } finally {
      POLICIES.harder.implemented = original;
    }
  });
});
