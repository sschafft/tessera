import type {
  BriefRecord,
  BriefRole,
  BriefSource,
  CreateGameInput,
  CreateParticipantInput,
  GameRecord,
  GameRepository,
  LibraryBriefRecord,
  PairRecord,
  PairRoundRecord,
  ParticipantRecord,
  PlacementRecord,
  RoundRecord,
} from "./repository";

export class DuplicateNameError extends Error {
  constructor() {
    super("display_name already exists in this game");
    this.name = "DuplicateNameError";
  }
}

export class PlacementCellTakenError extends Error {
  constructor() {
    super("a placement already exists at this (q, r)");
    this.name = "PlacementCellTakenError";
  }
}

/**
 * Thrown by captureBuilderSnapshot when the pair has already used all
 * its shares. Lets the agile-share route surface a typed 409 instead
 * of leaking "no_shares_remaining" through a generic 500. The
 * supabase impl raises this off the atomic capture_builder_snapshot
 * RPC's `captured: false` branch; the in-memory impl mirrors it for
 * dev parity.
 */
export class SnapshotShareCapError extends Error {
  constructor(public reason: string = "no_shares_remaining") {
    super(`captureBuilderSnapshot: ${reason}`);
    this.name = "SnapshotShareCapError";
  }
}

/**
 * In-memory GameRepository. Used during early local dev before Supabase
 * env vars are set. Per-process, no persistence across server restarts.
 */
export class MemoryGameRepository implements GameRepository {
  private games = new Map<string, GameRecord>();
  private participants = new Map<string, ParticipantRecord>();
  private pairs = new Map<string, PairRecord>();
  private rounds = new Map<string, RoundRecord>();
  private pairRounds = new Map<string, PairRoundRecord>();
  private placements = new Map<string, PlacementRecord>();
  private briefs = new Map<string, BriefRecord>();
  private accelerantEvents = new Map<
    string,
    {
      id: string;
      round_id: string;
      kind: string;
      scope: "pair" | "all";
      pair_id: string | null;
      triggered_at: string;
    }
  >();

  async createGame(
    input: CreateGameInput & {
      code: string;
      host_token_hash: string;
      gm_participant_id: string;
    },
  ): Promise<GameRecord> {
    const now = new Date().toISOString();
    const record: GameRecord = {
      ...input,
      id: crypto.randomUUID(),
      status: "lobby",
      created_at: now,
      last_interaction_at: now,
      ended_at: null,
      gemini_calls_used: 0,
      builder_brief_custom: input.builder_brief_custom ?? null,
      guider_brief_custom: input.guider_brief_custom ?? null,
      scoring_correct_pts: 10,
      scoring_wrong_pts: 0,
    };
    this.games.set(record.code, record);
    return record;
  }

  async findGameByCode(code: string): Promise<GameRecord | null> {
    return this.games.get(code) ?? null;
  }

  async createParticipant(
    input: CreateParticipantInput,
  ): Promise<ParticipantRecord> {
    const existing = await this.findParticipantByName(
      input.game_id,
      input.display_name,
    );
    if (existing) throw new DuplicateNameError();

    const now = new Date().toISOString();
    const record: ParticipantRecord = {
      id: input.id ?? crypto.randomUUID(),
      game_id: input.game_id,
      display_name: input.display_name,
      role: input.role,
      pair_id: null,
      color: input.color,
      joined_at: now,
      last_seen_at: now,
      released_at: null,
      recovery_token_hash: input.recovery_token_hash ?? null,
    };
    this.participants.set(record.id, record);
    return record;
  }

  async listActiveParticipants(game_id: string): Promise<ParticipantRecord[]> {
    return [...this.participants.values()]
      .filter((p) => p.game_id === game_id && p.released_at === null)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  }

  async findParticipantByName(
    game_id: string,
    display_name: string,
  ): Promise<ParticipantRecord | null> {
    const target = display_name.toLowerCase();
    for (const p of this.participants.values()) {
      if (
        p.game_id === game_id &&
        p.released_at === null &&
        p.display_name.toLowerCase() === target
      ) {
        return p;
      }
    }
    return null;
  }

  async findParticipantById(id: string): Promise<ParticipantRecord | null> {
    return this.participants.get(id) ?? null;
  }

  async touchParticipant(id: string): Promise<void> {
    const p = this.participants.get(id);
    if (p) p.last_seen_at = new Date().toISOString();
  }

  async createPair(
    game_id: string,
    builder_id: string,
    guider_id: string,
  ): Promise<PairRecord> {
    const builder = this.participants.get(builder_id);
    const guider = this.participants.get(guider_id);
    if (!builder || builder.game_id !== game_id) {
      throw new Error("builder_not_in_game");
    }
    if (!guider || guider.game_id !== game_id) {
      throw new Error("guider_not_in_game");
    }
    const pair: PairRecord = {
      id: crypto.randomUUID(),
      game_id,
      builder_id,
      guider_id,
      display_name: null,
      created_at: new Date().toISOString(),
    };
    this.pairs.set(pair.id, pair);
    builder.role = "builder";
    builder.pair_id = pair.id;
    guider.role = "guider";
    guider.pair_id = pair.id;
    return pair;
  }

  async listPairs(game_id: string): Promise<PairRecord[]> {
    return [...this.pairs.values()]
      .filter((p) => p.game_id === game_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async assignObserver(
    participant_id: string,
    pair_id: string,
  ): Promise<void> {
    const p = this.participants.get(participant_id);
    const pair = this.pairs.get(pair_id);
    if (!p) throw new Error("participant_not_found");
    if (!pair || pair.game_id !== p.game_id) {
      throw new Error("pair_not_in_game");
    }
    p.role = "observer";
    p.pair_id = pair_id;
  }

  async setPairDisplayName(
    pair_id: string,
    name: string | null,
  ): Promise<void> {
    const p = this.pairs.get(pair_id);
    if (p) p.display_name = name;
  }

  async clearAllocations(game_id: string): Promise<void> {
    for (const p of this.participants.values()) {
      if (p.game_id === game_id && p.role !== "gm") {
        p.role = "lobby";
        p.pair_id = null;
      }
    }
    for (const [id, pair] of this.pairs.entries()) {
      if (pair.game_id === game_id) this.pairs.delete(id);
    }
  }

  async createRound(input: {
    game_id: string;
    index: number;
    complexity: number;
    duration_seconds: number;
  }): Promise<RoundRecord> {
    const round: RoundRecord = {
      id: crypto.randomUUID(),
      game_id: input.game_id,
      index: input.index,
      complexity: input.complexity,
      duration_seconds: input.duration_seconds,
      status: "pending",
      started_at: null,
      ended_at: null,
    };
    this.rounds.set(round.id, round);
    return round;
  }

  async startRound(round_id: string): Promise<void> {
    const r = this.rounds.get(round_id);
    if (r) {
      r.status = "running";
      r.started_at = new Date().toISOString();
    }
  }

  async endRound(round_id: string): Promise<void> {
    const r = this.rounds.get(round_id);
    if (r && r.status !== "ended") {
      r.status = "ended";
      r.ended_at = new Date().toISOString();
    }
  }

  async deleteRound(round_id: string): Promise<void> {
    const pairRoundIds = new Set<string>();
    for (const [id, pr] of this.pairRounds.entries()) {
      if (pr.round_id === round_id) {
        pairRoundIds.add(id);
        this.pairRounds.delete(id);
      }
    }
    for (const [id, b] of this.briefs.entries()) {
      if (pairRoundIds.has(b.pair_round_id)) this.briefs.delete(id);
    }
    for (const [id, p] of this.placements.entries()) {
      if (pairRoundIds.has(p.pair_round_id)) this.placements.delete(id);
    }
    for (const [id, e] of this.accelerantEvents.entries()) {
      if (e.round_id === round_id) this.accelerantEvents.delete(id);
    }
    this.rounds.delete(round_id);
  }

  async findLatestRound(game_id: string): Promise<RoundRecord | null> {
    const rs = [...this.rounds.values()]
      .filter((r) => r.game_id === game_id)
      .sort((a, b) => b.index - a.index);
    return rs[0] ?? null;
  }

  async listRounds(game_id: string): Promise<RoundRecord[]> {
    return [...this.rounds.values()]
      .filter((r) => r.game_id === game_id)
      .sort((a, b) => a.index - b.index);
  }

  async createPairRound(input: {
    round_id: string;
    pair_id: string;
    goal_pattern: unknown;
    pattern_seed: string;
  }): Promise<PairRoundRecord> {
    const pr: PairRoundRecord = {
      id: crypto.randomUUID(),
      round_id: input.round_id,
      pair_id: input.pair_id,
      goal_pattern: input.goal_pattern,
      pattern_seed: input.pattern_seed,
      test_enabled: false,
      shares_remaining: 3,
      briefs_revealed: false,
      prototype_until: null,
      builder_snapshot: null,
    };
    this.pairRounds.set(pr.id, pr);
    return pr;
  }

  async listPairRoundsForRound(round_id: string): Promise<PairRoundRecord[]> {
    return [...this.pairRounds.values()].filter(
      (pr) => pr.round_id === round_id,
    );
  }

  async findPairRound(
    round_id: string,
    pair_id: string,
  ): Promise<PairRoundRecord | null> {
    for (const pr of this.pairRounds.values()) {
      if (pr.round_id === round_id && pr.pair_id === pair_id) return pr;
    }
    return null;
  }

  async findPairById(pair_id: string): Promise<PairRecord | null> {
    return this.pairs.get(pair_id) ?? null;
  }

  async setGameStatus(
    game_id: string,
    status: "lobby" | "running" | "ended" | "purged",
  ): Promise<void> {
    for (const g of this.games.values()) {
      if (g.id === game_id) g.status = status;
    }
  }

  async updateScoring(
    game_id: string,
    patch: { scoring_correct_pts?: number; scoring_wrong_pts?: number },
  ): Promise<void> {
    for (const g of this.games.values()) {
      if (g.id === game_id) {
        if (patch.scoring_correct_pts !== undefined) {
          g.scoring_correct_pts = patch.scoring_correct_pts;
        }
        if (patch.scoring_wrong_pts !== undefined) {
          g.scoring_wrong_pts = patch.scoring_wrong_pts;
        }
      }
    }
  }

  async setBriefOn(
    game_id: string,
    role: "builder" | "guider",
    on: boolean,
  ): Promise<void> {
    for (const g of this.games.values()) {
      if (g.id === game_id) {
        if (role === "builder") g.builder_brief_on = on;
        else g.guider_brief_on = on;
      }
    }
  }

  async createPlacement(input: {
    pair_round_id: string;
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
    placed_by: string;
  }): Promise<PlacementRecord> {
    for (const p of this.placements.values()) {
      if (
        p.pair_round_id === input.pair_round_id &&
        p.q === input.q &&
        p.r === input.r
      ) {
        throw new PlacementCellTakenError();
      }
    }
    const record: PlacementRecord = {
      id: crypto.randomUUID(),
      pair_round_id: input.pair_round_id,
      shape: input.shape,
      color: input.color,
      q: input.q,
      r: input.r,
      rot: input.rot,
      placed_by: input.placed_by,
      placed_at: new Date().toISOString(),
    };
    this.placements.set(record.id, record);
    return record;
  }

  async listPlacements(pair_round_id: string): Promise<PlacementRecord[]> {
    return [...this.placements.values()]
      .filter((p) => p.pair_round_id === pair_round_id)
      .sort((a, b) => a.placed_at.localeCompare(b.placed_at));
  }

  async findPlacement(id: string): Promise<PlacementRecord | null> {
    return this.placements.get(id) ?? null;
  }

  async deletePlacement(id: string): Promise<boolean> {
    return this.placements.delete(id);
  }

  async clearPlacements(pair_round_id: string): Promise<number> {
    let count = 0;
    for (const [id, p] of this.placements.entries()) {
      if (p.pair_round_id === pair_round_id) {
        this.placements.delete(id);
        count += 1;
      }
    }
    return count;
  }

  async updatePlacement(
    id: string,
    patch: {
      q?: number;
      r?: number;
      rot?: number;
      shape?: string;
      color?: string;
    },
  ): Promise<PlacementRecord | null> {
    const existing = this.placements.get(id);
    if (!existing) return null;
    const newQ = patch.q ?? existing.q;
    const newR = patch.r ?? existing.r;
    if (newQ !== existing.q || newR !== existing.r) {
      for (const p of this.placements.values()) {
        if (
          p.id !== id &&
          p.pair_round_id === existing.pair_round_id &&
          p.q === newQ &&
          p.r === newR
        ) {
          throw new PlacementCellTakenError();
        }
      }
    }
    existing.q = newQ;
    existing.r = newR;
    if (patch.rot !== undefined) existing.rot = patch.rot;
    if (patch.shape !== undefined) existing.shape = patch.shape;
    if (patch.color !== undefined) existing.color = patch.color;
    return existing;
  }

  async upsertBrief(input: {
    pair_round_id: string;
    role: BriefRole;
    source: BriefSource;
    title: string;
    rules: string[];
  }): Promise<BriefRecord> {
    // Replace any existing brief for this (pair_round, role).
    for (const [id, b] of this.briefs.entries()) {
      if (b.pair_round_id === input.pair_round_id && b.role === input.role) {
        this.briefs.delete(id);
      }
    }
    const record: BriefRecord = {
      id: crypto.randomUUID(),
      pair_round_id: input.pair_round_id,
      role: input.role,
      source: input.source,
      title: input.title,
      rules: input.rules,
      revealed: false,
      created_at: new Date().toISOString(),
    };
    this.briefs.set(record.id, record);
    return record;
  }

  async findBrief(
    pair_round_id: string,
    role: BriefRole,
  ): Promise<BriefRecord | null> {
    for (const b of this.briefs.values()) {
      if (b.pair_round_id === pair_round_id && b.role === role) return b;
    }
    return null;
  }

  async listBriefsForPairRound(
    pair_round_id: string,
  ): Promise<BriefRecord[]> {
    return [...this.briefs.values()].filter(
      (b) => b.pair_round_id === pair_round_id,
    );
  }

  async listLibraryBriefs(_input: {
    role: BriefRole;
    complexity: number;
    exclude_titles?: string[];
  }): Promise<LibraryBriefRecord[]> {
    // The in-memory backend has no library — Supabase is authoritative.
    // Returning [] forces the orchestrator to fall back to a built-in
    // emergency brief if it ever runs against the in-memory store.
    return [];
  }

  async createAccelerantEvent(input: {
    round_id: string;
    scope: "pair" | "all";
    pair_id: string | null;
    kind: string;
    payload?: unknown;
    triggered_by: string;
  }): Promise<{ id: string; triggered_at: string }> {
    const event = {
      id: crypto.randomUUID(),
      round_id: input.round_id,
      kind: input.kind,
      scope: input.scope,
      pair_id: input.pair_id,
      triggered_at: new Date().toISOString(),
    };
    this.accelerantEvents.set(event.id, event);
    return { id: event.id, triggered_at: event.triggered_at };
  }

  async listAccelerantEvents(round_id: string): Promise<
    Array<{
      id: string;
      kind: string;
      scope: "pair" | "all";
      pair_id: string | null;
      triggered_at: string;
    }>
  > {
    return [...this.accelerantEvents.values()].filter(
      (e) => e.round_id === round_id,
    );
  }

  async setBriefsRevealed(pair_round_id: string): Promise<void> {
    const pr = this.pairRounds.get(pair_round_id);
    if (pr) pr.briefs_revealed = true;
  }

  async setTestEnabled(
    pair_round_id: string,
    enabled: boolean,
  ): Promise<void> {
    const pr = this.pairRounds.get(pair_round_id);
    if (pr) pr.test_enabled = enabled;
  }

  async updateGoalPattern(
    pair_round_id: string,
    pattern: unknown,
    seed: string,
  ): Promise<void> {
    const pr = this.pairRounds.get(pair_round_id);
    if (pr) {
      pr.goal_pattern = pattern;
      pr.pattern_seed = seed;
    }
  }

  private geminiBudgetByDay = new Map<string, number>();

  async reserveGeminiCall(input: {
    game_id: string;
    perGameMax: number;
    perDayMax: number;
  }): Promise<
    | { ok: true; perGame: number; perDay: number }
    | { ok: false; reason: "per_game_cap" | "per_day_cap" }
  > {
    const game = [...this.games.values()].find((g) => g.id === input.game_id);
    if (!game) return { ok: false, reason: "per_game_cap" };
    if (game.gemini_calls_used >= input.perGameMax) {
      return { ok: false, reason: "per_game_cap" };
    }
    const day = new Date().toISOString().slice(0, 10);
    const used = this.geminiBudgetByDay.get(day) ?? 0;
    if (used >= input.perDayMax) {
      return { ok: false, reason: "per_day_cap" };
    }
    game.gemini_calls_used += 1;
    this.geminiBudgetByDay.set(day, used + 1);
    return { ok: true, perGame: game.gemini_calls_used, perDay: used + 1 };
  }

  async decrementRoundDuration(
    round_id: string,
    delta: number,
  ): Promise<void> {
    const r = this.rounds.get(round_id);
    if (r) {
      // Compute current remaining; floor at 30s.
      const startedMs = r.started_at
        ? new Date(r.started_at).getTime()
        : Date.now();
      const elapsed = Math.floor((Date.now() - startedMs) / 1000);
      const remaining = r.duration_seconds - elapsed;
      const newRemaining = Math.max(30, remaining - delta);
      r.duration_seconds = elapsed + newRemaining;
    }
  }

  async setPrototypeUntil(
    pair_round_id: string,
    until: Date,
  ): Promise<void> {
    const pr = this.pairRounds.get(pair_round_id);
    if (pr) pr.prototype_until = until.toISOString();
  }

  async captureBuilderSnapshot(
    pair_round_id: string,
    snapshot: unknown,
  ): Promise<number> {
    const pr = this.pairRounds.get(pair_round_id);
    if (!pr) throw new SnapshotShareCapError("pair_round_not_found");
    if (pr.shares_remaining <= 0) {
      throw new SnapshotShareCapError("no_shares_remaining");
    }
    pr.builder_snapshot = snapshot;
    pr.shares_remaining = pr.shares_remaining - 1;
    return pr.shares_remaining;
  }
}

let _instance: MemoryGameRepository | null = null;
export function getMemoryRepository(): MemoryGameRepository {
  if (!_instance) _instance = new MemoryGameRepository();
  return _instance;
}
