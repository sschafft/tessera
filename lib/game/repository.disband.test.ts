import { beforeEach, describe, expect, it } from "vitest";
import { getMemoryRepository } from "./repository.memory";

/**
 * Locks the contract behind the tl#3 fix: `pairs.disband(pair_id)`
 * deletes the pair row AND moves every participant whose pair_id
 * referenced it back to the lobby (pair_id = null, role = "lobby").
 * GM seats are exempt — they're not allocated to a pair anyway, but
 * the explicit `neq("role", "gm")` guard means the supabase impl
 * mirrors the memory impl on principle.
 */
describe("pairs.disband", () => {
  let repo: ReturnType<typeof getMemoryRepository>;
  let game_id: string;
  let builderId: string;
  let guiderId: string;
  let observerId: string;
  let pair_id: string;

  beforeEach(async () => {
    repo = getMemoryRepository();
    const game = await repo.games.create({
      code: "DIS-001",
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
    const builder = await repo.participants.create({
      game_id,
      display_name: "B",
      role: "builder",
      color: "red",
    });
    const guider = await repo.participants.create({
      game_id,
      display_name: "G",
      role: "guider",
      color: "blue",
    });
    const observer = await repo.participants.create({
      game_id,
      display_name: "O",
      role: "observer",
      color: "yellow",
    });
    builderId = builder.id;
    guiderId = guider.id;
    observerId = observer.id;
    const pair = await repo.pairs.create(game_id, builderId, guiderId);
    pair_id = pair.id;
    await repo.pairs.assignObserver(observerId, pair_id);
  });

  it("removes the pair row from the game's pair list", async () => {
    expect((await repo.pairs.list(game_id)).length).toBe(1);
    await repo.pairs.disband(pair_id);
    expect((await repo.pairs.list(game_id)).length).toBe(0);
  });

  it("returns the builder and guider to the lobby (pair_id null, role lobby)", async () => {
    await repo.pairs.disband(pair_id);
    const builder = await repo.participants.findById(builderId);
    const guider = await repo.participants.findById(guiderId);
    expect(builder?.pair_id).toBeNull();
    expect(builder?.role).toBe("lobby");
    expect(guider?.pair_id).toBeNull();
    expect(guider?.role).toBe("lobby");
  });

  it("returns observers attached to the pair to the lobby too", async () => {
    await repo.pairs.disband(pair_id);
    const observer = await repo.participants.findById(observerId);
    expect(observer?.pair_id).toBeNull();
    expect(observer?.role).toBe("lobby");
  });

  it("is a no-op when the pair_id is unknown", async () => {
    await expect(repo.pairs.disband("does-not-exist")).resolves.toBeUndefined();
    expect((await repo.pairs.list(game_id)).length).toBe(1);
  });
});
