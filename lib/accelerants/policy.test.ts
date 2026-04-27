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
    const events: PriorEvent[] = Array.from({ length: 50 }, (_, i) =>
      event("test_build", "pair", "p1", at(i * 10, now)),
    );
    expect(POLICIES.test_build.maxPerRound).toBeNull();
    const r = checkPolicy({
      events,
      kind: "test_build",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(true);
  });

  it("prototype caps at 4 per pair", () => {
    const events: PriorEvent[] = Array.from({ length: 4 }, (_, i) =>
      event("prototype", "pair", "p1", at(i * 30 - 600, now)),
    );
    const r = checkPolicy({
      events,
      kind: "prototype",
      scope: "pair",
      pair_id: "p1",
      now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cap_exceeded");
  });

  it("prototype 3 prior usages still allow the 4th", () => {
    const events: PriorEvent[] = Array.from({ length: 3 }, (_, i) =>
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
    const events: PriorEvent[] = [
      event("test_build", "pair", "p1", at(0, now)),
    ];
    const r = checkPolicy({
      events,
      kind: "test_build",
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
