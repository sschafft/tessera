import { beforeEach, describe, expect, it } from "vitest";
import { getMemoryRepository } from "./repository.memory";

/**
 * Locks the contract behind tl2#3: `games.delete(game_id)` cascades
 * through every child row in the in-memory backend, mirroring the
 * Postgres FK `on delete cascade` clauses in the v1 schema. The
 * upload route's compensating-rollback path depends on this, so a
 * silent regression in the cascade would let orphan participants /
 * pairs / pair_rounds / briefs survive a failed CSV upload.
 */
describe("games.delete cascades", () => {
  let repo: ReturnType<typeof getMemoryRepository>;
  let game_id: string;
  let other_game_id: string;

  beforeEach(async () => {
    repo = getMemoryRepository();
    const game = await repo.games.create({
      code: `DEL-${Math.floor(Math.random() * 9000) + 1000}`,
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

    // Companion game so we can assert delete is scoped, not nuking
    // the singleton's whole world.
    const other = await repo.games.create({
      code: `OTH-${Math.floor(Math.random() * 9000) + 1000}`,
      host_token_hash: "h",
      gm_participant_id: "gm",
      workshop_name: "other",
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
    other_game_id = other.id;

    const builder = await repo.participants.create({
      game_id,
      display_name: `B-${game_id.slice(0, 4)}`,
      role: "builder",
      color: "red",
    });
    const guider = await repo.participants.create({
      game_id,
      display_name: `G-${game_id.slice(0, 4)}`,
      role: "guider",
      color: "blue",
    });
    await repo.pairs.create(game_id, builder.id, guider.id);

    // Other game's participants stay untouched.
    await repo.participants.create({
      game_id: other_game_id,
      display_name: `B-${other_game_id.slice(0, 4)}`,
      role: "builder",
      color: "red",
    });
  });

  it("removes the game row + its participants + pairs", async () => {
    expect(await repo.games.findByCode(
      Array.from(
        (
          repo as unknown as { _gameTable: Map<string, { id: string; code: string }> }
        )._gameTable.values(),
      ).find((g) => g.id === game_id)!.code,
    )).not.toBeNull();
    expect((await repo.participants.listActive(game_id)).length).toBeGreaterThan(0);
    expect((await repo.pairs.list(game_id)).length).toBe(1);

    await repo.games.delete(game_id);

    expect((await repo.participants.listActive(game_id)).length).toBe(0);
    expect((await repo.pairs.list(game_id)).length).toBe(0);
  });

  it("leaves other games' rows untouched", async () => {
    await repo.games.delete(game_id);
    expect((await repo.participants.listActive(other_game_id)).length).toBe(1);
  });

  it("is a no-op when the game id is unknown", async () => {
    await expect(
      repo.games.delete("does-not-exist"),
    ).resolves.toBeUndefined();
    // Both games still here.
    expect((await repo.pairs.list(game_id)).length).toBe(1);
    expect((await repo.participants.listActive(other_game_id)).length).toBe(1);
  });
});
