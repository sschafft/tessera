import { beforeEach, describe, expect, it } from "vitest";
import { getMemoryRepository } from "./repository.memory";

/**
 * Locks the contract added in the 2026-05-03 tessera-tl pass:
 * `placements.listByPairRoundIds` and `briefs.listByPairRoundIds`
 * each return one query's worth of rows grouped into a Map keyed by
 * pair_round_id, with empty arrays for pair_rounds that have nothing
 * yet. Memory + Supabase impls share this shape; testing the memory
 * one is enough to catch a contract drift in either.
 */
describe("repository batched lookups", () => {
  let repo: ReturnType<typeof getMemoryRepository>;
  let game_id: string;
  let round_id: string;
  let pair_a_id: string;
  let pair_b_id: string;
  let pr_a_id: string;
  let pr_b_id: string;

  beforeEach(async () => {
    repo = getMemoryRepository();
    const game = await repo.games.create({
      code: "ABC-123",
      host_token_hash: "h",
      gm_participant_id: "gm",
      workshop_name: "test",
      video_call_url: null,
      whiteboard_url: null,
      team_mode: "gm_picks",
      default_complexity: 3,
      builder_brief_on: true,
      guider_brief_on: true,
      builder_brief_source: "library",
      guider_brief_source: "library",
      round_count: 1,
      round_duration_seconds: 600,
      participant_cap: 4,
      sound_on: true,
    });
    game_id = game.id;
    const builderA = await repo.participants.create({
      game_id,
      display_name: "A1",
      role: "builder",
      color: "red",
    });
    const guiderA = await repo.participants.create({
      game_id,
      display_name: "A2",
      role: "guider",
      color: "blue",
    });
    const builderB = await repo.participants.create({
      game_id,
      display_name: "B1",
      role: "builder",
      color: "yellow",
    });
    const guiderB = await repo.participants.create({
      game_id,
      display_name: "B2",
      role: "guider",
      color: "green",
    });
    const pairA = await repo.pairs.create(game_id, builderA.id, guiderA.id);
    const pairB = await repo.pairs.create(game_id, builderB.id, guiderB.id);
    pair_a_id = pairA.id;
    pair_b_id = pairB.id;
    const round = await repo.rounds.create({
      game_id,
      index: 1,
      complexity: 3,
      duration_seconds: 600,
    });
    round_id = round.id;
    const prA = await repo.pairRounds.create({
      round_id,
      pair_id: pair_a_id,
      goal_pattern: [],
      pattern_seed: "seedA",
    });
    const prB = await repo.pairRounds.create({
      round_id,
      pair_id: pair_b_id,
      goal_pattern: [],
      pattern_seed: "seedB",
    });
    pr_a_id = prA.id;
    pr_b_id = prB.id;
  });

  it("placements.listByPairRoundIds groups by pair_round and preserves placed_at order", async () => {
    void round_id;
    void game_id;
    await repo.placements.create({
      pair_round_id: pr_a_id,
      shape: "sq",
      color: "red",
      q: 0,
      r: 0,
      rot: 0,
      placed_by: "x",
    });
    await repo.placements.create({
      pair_round_id: pr_a_id,
      shape: "sq",
      color: "blue",
      q: 1,
      r: 0,
      rot: 0,
      placed_by: "x",
    });
    await repo.placements.create({
      pair_round_id: pr_b_id,
      shape: "sq",
      color: "yellow",
      q: 0,
      r: 0,
      rot: 0,
      placed_by: "y",
    });
    const out = await repo.placements.listByPairRoundIds([pr_a_id, pr_b_id]);
    expect(out.size).toBe(2);
    expect(out.get(pr_a_id)?.length).toBe(2);
    expect(out.get(pr_b_id)?.length).toBe(1);
    // Order: placed_at ascending == insertion order here.
    expect(out.get(pr_a_id)?.[0]!.color).toBe("red");
    expect(out.get(pr_a_id)?.[1]!.color).toBe("blue");
  });

  it("placements.listByPairRoundIds yields empty arrays for pair_rounds with no placements", async () => {
    const out = await repo.placements.listByPairRoundIds([pr_a_id, pr_b_id]);
    expect(out.get(pr_a_id)).toEqual([]);
    expect(out.get(pr_b_id)).toEqual([]);
  });

  it("placements.listByPairRoundIds with empty input returns an empty map", async () => {
    const out = await repo.placements.listByPairRoundIds([]);
    expect(out.size).toBe(0);
  });

  it("briefs.listByPairRoundIds groups by pair_round", async () => {
    await repo.briefs.upsert({
      pair_round_id: pr_a_id,
      role: "builder",
      source: "library",
      title: "A-builder",
      rules: ["x"],
    });
    await repo.briefs.upsert({
      pair_round_id: pr_a_id,
      role: "guider",
      source: "library",
      title: "A-guider",
      rules: ["y"],
    });
    await repo.briefs.upsert({
      pair_round_id: pr_b_id,
      role: "builder",
      source: "library",
      title: "B-builder",
      rules: ["z"],
    });
    const out = await repo.briefs.listByPairRoundIds([pr_a_id, pr_b_id]);
    expect(out.get(pr_a_id)?.length).toBe(2);
    expect(out.get(pr_b_id)?.length).toBe(1);
    expect(out.get(pr_b_id)?.[0]!.title).toBe("B-builder");
  });
});
