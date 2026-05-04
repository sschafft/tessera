import { beforeEach, describe, expect, it } from "vitest";
import { getMemoryRepository } from "./repository.memory";

/**
 * Locks the lifecycle pivot fixed in the 2026-05-04 tessera-tl pass:
 * `setStatus` writes `ended_at` alongside the status column instead of
 * leaving the timestamp stale. Retention / reporting consumers read
 * `ended_at` directly, so the column has to be the source of truth.
 */
describe("setGameStatus pivots ended_at", () => {
  let repo: ReturnType<typeof getMemoryRepository>;
  let code: string;
  let game_id: string;

  beforeEach(async () => {
    repo = getMemoryRepository();
    code = `END-${Math.floor(Math.random() * 9000) + 1000}`;
    const game = await repo.games.create({
      code,
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
  });

  it("starts with ended_at = null", async () => {
    const g = await repo.games.findByCode(code);
    expect(g?.id).toBe(game_id);
    expect(g?.ended_at).toBeNull();
  });

  it("writes ended_at when transitioning to 'ended'", async () => {
    await repo.games.setStatus(game_id, "ended");
    const g = await repo.games.findByCode(code);
    expect(g?.status).toBe("ended");
    expect(g?.ended_at).not.toBeNull();
    expect(typeof g?.ended_at).toBe("string");
    // ISO timestamp shape
    expect(g?.ended_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("clears ended_at when transitioning back to lobby/running", async () => {
    await repo.games.setStatus(game_id, "ended");
    await repo.games.setStatus(game_id, "running");
    const g = await repo.games.findByCode(code);
    expect(g?.status).toBe("running");
    expect(g?.ended_at).toBeNull();
  });

  it("leaves ended_at intact when transitioning to 'purged' (retention can still see the wrap time)", async () => {
    await repo.games.setStatus(game_id, "ended");
    const ended = (await repo.games.findByCode(code))?.ended_at;
    expect(ended).not.toBeNull();
    await repo.games.setStatus(game_id, "purged");
    const g = await repo.games.findByCode(code);
    expect(g?.status).toBe("purged");
    expect(g?.ended_at).toBe(ended);
  });
});
