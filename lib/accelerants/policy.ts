/**
 * Per-accelerant policy: caps per round and cooldown windows. The
 * accelerant route handler queries existing accelerant_events rows
 * and rejects new triggers that would exceed these limits.
 */

export type AccelerantKind =
  | "prototype"
  | "reveal_briefs"
  | "test_build"
  | "agile_share"
  | "time_pressure"
  | "vocab_swap"
  | "randomizer"
  | "requirement_change";

export type AccelerantScope = "pair" | "all";

export interface AccelerantPolicy {
  /** Max triggers per round; null = unlimited. */
  maxPerRound: number | null;
  /** Cooldown between triggers in seconds; 0 = none. Pair-scoped. */
  cooldownSeconds: number;
  /** Whether the kind is implemented in v1. Unimplemented kinds are
   *  surfaced in the UI with a "soon" badge but cannot be triggered. */
  implemented: boolean;
}

export const POLICIES: Record<AccelerantKind, AccelerantPolicy> = {
  prototype: { maxPerRound: 4, cooldownSeconds: 12, implemented: true },
  reveal_briefs: { maxPerRound: 1, cooldownSeconds: 0, implemented: true },
  test_build: { maxPerRound: null, cooldownSeconds: 0, implemented: true },
  agile_share: { maxPerRound: 3, cooldownSeconds: 0, implemented: true },
  time_pressure: { maxPerRound: 2, cooldownSeconds: 0, implemented: true },
  vocab_swap: { maxPerRound: 1, cooldownSeconds: 0, implemented: true },
  randomizer: { maxPerRound: null, cooldownSeconds: 0, implemented: true },
  requirement_change: {
    maxPerRound: null,
    cooldownSeconds: 0,
    implemented: true,
  },
};

export interface PriorEvent {
  kind: AccelerantKind;
  scope: AccelerantScope;
  pair_id: string | null;
  triggered_at: string;
}

/**
 * Counts of prior events for the round, used by both the server-side
 * cap check and the GM dashboard's "used / cap" indicator.
 */
export function countPriorEvents(
  events: PriorEvent[],
  kind: AccelerantKind,
  pair_id: string | null,
): { perPair: number; perAll: number } {
  let perPair = 0;
  let perAll = 0;
  for (const e of events) {
    if (e.kind !== kind) continue;
    if (e.scope === "all") perAll += 1;
    else if (e.pair_id === pair_id) perPair += 1;
  }
  return { perPair, perAll };
}

export interface CheckArgs {
  events: PriorEvent[];
  kind: AccelerantKind;
  scope: AccelerantScope;
  pair_id: string | null;
  now: Date;
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "not_implemented" | "cap_exceeded" | "cooldown_active" };

/**
 * Decide whether a trigger is allowed.
 *
 * Cap rule: count(prior_pair_events_for_this_pair) + count(prior_all_events) ≤ maxPerRound.
 * Cooldown: most-recent triggered_at + cooldownSeconds must be in the past.
 */
export function checkPolicy({
  events,
  kind,
  scope,
  pair_id,
  now,
}: CheckArgs): CheckResult {
  const policy = POLICIES[kind];
  if (!policy.implemented) return { ok: false, reason: "not_implemented" };

  if (policy.maxPerRound !== null) {
    const { perPair, perAll } = countPriorEvents(events, kind, pair_id);
    const used = scope === "pair" ? perPair + perAll : perAll;
    if (used >= policy.maxPerRound) {
      return { ok: false, reason: "cap_exceeded" };
    }
  }

  if (policy.cooldownSeconds > 0) {
    const last = events
      .filter(
        (e) =>
          e.kind === kind &&
          (e.scope === "all" || e.pair_id === pair_id),
      )
      .sort((a, b) => b.triggered_at.localeCompare(a.triggered_at))[0];
    if (last) {
      const lastMs = new Date(last.triggered_at).getTime();
      const elapsed = (now.getTime() - lastMs) / 1000;
      if (elapsed < policy.cooldownSeconds) {
        return { ok: false, reason: "cooldown_active" };
      }
    }
  }

  return { ok: true };
}
