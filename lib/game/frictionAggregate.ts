import "server-only";

import type { RoundSurveyRecord } from "./repository";

/**
 * Pure aggregator for the per-round friction-attribution survey
 * (the v2 reflection card replacing the 4-way pick). Lives outside
 * the route so we can unit-test the suppression floor + asymmetry
 * detection without standing up a Supabase.
 *
 * Output shape:
 *
 *   - One entry per round that cleared the suppression floor.
 *   - `mean` (overall) is the aggregate seen by the room.
 *   - `by_role` exposes builder + guider means independently so the
 *     facilitator can spot asymmetry — e.g. builders blamed
 *     themselves more than guiders blamed them, which is the kind
 *     of insight the debrief is for.
 *   - `asymmetry` flags axes where |builder - guider| exceeds the
 *     threshold; the GameEndedView card shows the highest-delta
 *     callout when any are flagged.
 *
 * Suppression: we never emit per-pair rows or attempt to identify
 * individuals. Rounds with fewer than `MIN_RESPONSES_FOR_AGGREGATE`
 * participants drop out entirely; you can't anonymise an aggregate
 * over 1–3 people. The 4-floor matches the 2-pair design floor on
 * the GM-side opt-in.
 */

export const MIN_RESPONSES_FOR_AGGREGATE = 4;
export const ASYMMETRY_THRESHOLD = 15;

export type FrictionAxis = "self" | "partner" | "system";

export interface FrictionMeans {
  self: number;
  partner: number;
  system: number;
}

export interface FrictionAsymmetry {
  axis: FrictionAxis;
  builder: number;
  guider: number;
  delta: number;
}

export interface PerRoundFriction {
  round_id: string;
  round_index: number;
  response_count: number;
  avg_comm_balance: number;
  /** Mean across all respondents on the round. */
  mean: FrictionMeans;
  /**
   * Means split by role. Either side may be `null` when no respondent
   * with that role submitted (e.g. observer-only round, single-pair
   * room that didn't clear the floor for the by_role split). The
   * overall mean is always present.
   */
  by_role: {
    builder: FrictionMeans | null;
    guider: FrictionMeans | null;
  };
  /** Axes whose builder-vs-guider delta exceeds the threshold. */
  asymmetry: FrictionAsymmetry[];
}

/**
 * Round that received at least one v2 response but didn't clear
 * `MIN_RESPONSES_FOR_AGGREGATE`. Surfaced separately so the GM
 * debrief view can show "Round X had N responses — below the
 * anonymity floor" instead of silently hiding the card and leaving
 * the GM thinking the survey was broken. Never includes
 * round_ids with zero responses (no signal worth surfacing).
 */
export interface SuppressedRoundFriction {
  round_id: string;
  round_index: number;
  response_count: number;
}

export interface FrictionAggregate {
  rounds: PerRoundFriction[];
  suppressed: SuppressedRoundFriction[];
}

interface AggregateInput {
  round_id: string;
  round_index: number;
  responses: RoundSurveyRecord[];
  /**
   * Role lookup by participant id. Caller supplies; participants the
   * lookup doesn't recognise are excluded from per-role splits but
   * still count toward the overall mean (they're real responses).
   */
  roleByParticipantId: Map<string, "builder" | "guider">;
}

/**
 * Filter survey responses to v2 attribution rows only. Legacy v1
 * rows have null/zero attribution columns and aren't comparable.
 */
function isV2Response(r: RoundSurveyRecord): boolean {
  const sum = r.attr_self + r.attr_partner + r.attr_system;
  // Tolerance of ±1 lets us survive the rare rounding mismatch from
  // the slider UI; the DB CHECK enforces exactly 100 so this is a
  // belt-and-braces guard.
  return Math.abs(sum - 100) <= 1;
}

function meanOf(rs: RoundSurveyRecord[]): FrictionMeans {
  const n = rs.length;
  if (n === 0) return { self: 0, partner: 0, system: 0 };
  let s = 0;
  let p = 0;
  let sys = 0;
  for (const r of rs) {
    s += r.attr_self;
    p += r.attr_partner;
    sys += r.attr_system;
  }
  return {
    self: Math.round(s / n),
    partner: Math.round(p / n),
    system: Math.round(sys / n),
  };
}

export function aggregateFrictionByRound(
  inputs: AggregateInput[],
): FrictionAggregate {
  const out: PerRoundFriction[] = [];
  const suppressed: SuppressedRoundFriction[] = [];
  for (const { round_id, round_index, responses, roleByParticipantId } of inputs) {
    const v2 = responses.filter(isV2Response);
    if (v2.length === 0) continue;
    if (v2.length < MIN_RESPONSES_FOR_AGGREGATE) {
      suppressed.push({
        round_id,
        round_index,
        response_count: v2.length,
      });
      continue;
    }

    const builderRows: RoundSurveyRecord[] = [];
    const guiderRows: RoundSurveyRecord[] = [];
    for (const r of v2) {
      const role = roleByParticipantId.get(r.participant_id);
      if (role === "builder") builderRows.push(r);
      else if (role === "guider") guiderRows.push(r);
    }

    const overall = meanOf(v2);
    const builderMean = builderRows.length > 0 ? meanOf(builderRows) : null;
    const guiderMean = guiderRows.length > 0 ? meanOf(guiderRows) : null;

    const asymmetry: FrictionAsymmetry[] = [];
    if (builderMean && guiderMean) {
      for (const axis of ["self", "partner", "system"] as const) {
        const b = builderMean[axis];
        const g = guiderMean[axis];
        const delta = Math.abs(b - g);
        if (delta >= ASYMMETRY_THRESHOLD) {
          asymmetry.push({ axis, builder: b, guider: g, delta });
        }
      }
      asymmetry.sort((a, b) => b.delta - a.delta);
    }

    let balanceSum = 0;
    for (const r of v2) balanceSum += r.comm_balance;

    out.push({
      round_id,
      round_index,
      response_count: v2.length,
      avg_comm_balance: Math.round(balanceSum / v2.length),
      mean: overall,
      by_role: { builder: builderMean, guider: guiderMean },
      asymmetry,
    });
  }
  return { rounds: out, suppressed };
}
