import type {
  BriefRecord,
  BriefRole,
  BriefSource,
  BriefStore,
  CreateGameInput,
  CreateParticipantInput,
  GameRecord,
  GameRepository,
  GameStore,
  LibraryBriefRecord,
  PairRecord,
  PairRoundRecord,
  PairRoundStore,
  PairStore,
  ParticipantRecord,
  ParticipantStore,
  PlacementRecord,
  PlacementStore,
  RoundRecord,
  RoundStore,
  RoundSurveyRecord,
  RoundSurveyStore,
  SuperPowerStore,
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
class MemoryGameRepository implements GameRepository {
  // Internal Maps. Renamed `_<name>Table` so the sub-store facade
  // properties below can use the unprefixed names without colliding.
  private _gameTable = new Map<string, GameRecord>();
  private _participantTable = new Map<string, ParticipantRecord>();
  private _pairTable = new Map<string, PairRecord>();
  private _roundTable = new Map<string, RoundRecord>();
  private _pairRoundTable = new Map<string, PairRoundRecord>();
  private _placementTable = new Map<string, PlacementRecord>();
  private _briefTable = new Map<string, BriefRecord>();
  private _superPowerTable = new Map<
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

  // ─── Sub-store facades ──────────────────────────────────────────
  // Same regrouping as the Supabase backend. Existing method bodies
  // are unchanged; the facades delegate to them so callers can use
  // the new repo.games.findByCode(c) shape.
  games: GameStore = {
    create: (input) => this.createGame(input),
    findByCode: (code) => this.findGameByCode(code),
    delete: (id) => this.deleteGame(id),
    setStatus: (id, status) => this.setGameStatus(id, status),
    updateScoring: (id, patch) => this.updateScoring(id, patch),
    setBriefOn: (id, role, on) => this.setBriefOn(id, role, on),
    reserveGeminiCall: (input) => this.reserveGeminiCall(input),
  };

  participants: ParticipantStore = {
    create: (input) => this.createParticipant(input),
    listActive: (game_id) => this.listActiveParticipants(game_id),
    findByName: (game_id, name) => this.findParticipantByName(game_id, name),
    findById: (id) => this.findParticipantById(id),
    findByJoinShortKey: (key) => this.findParticipantByJoinShortKey(key),
    touch: (id) => this.touchParticipant(id),
    release: (id) => this.releaseParticipant(id),
  };

  pairs: PairStore = {
    create: (game_id, builder_id, guider_id) =>
      this.createPair(game_id, builder_id, guider_id),
    list: (game_id) => this.listPairs(game_id),
    findById: (pair_id) => this.findPairById(pair_id),
    swapRoles: (pair_id) => this.swapPairRoles(pair_id),
    swapAllRoles: (game_id) => this.swapAllPairRoles(game_id),
    reshufflePartners: (game_id) => this.reshufflePartners(game_id),
    assignObserver: (pid, pair_id) => this.assignObserver(pid, pair_id),
    setDisplayName: (pair_id, name) => this.setPairDisplayName(pair_id, name),
    clearAllocations: (game_id) => this.clearAllocations(game_id),
    disband: (pair_id) => this.disbandPair(pair_id),
    setBriefOverrides: (pair_id, overrides) =>
      this.setBriefOverrides(pair_id, overrides),
    clearBriefOverrides: (pair_id) => this.clearBriefOverrides(pair_id),
    setBreakout: (pair_id, breakout) => this.setPairBreakout(pair_id, breakout),
    setPreSuppliedBreakout: (pair_id, call_url) =>
      this.setPreSuppliedBreakout(pair_id, call_url),
    clearBreakout: (pair_id) => this.clearPairBreakout(pair_id),
    listWithBreakouts: (game_id) => this.listPairsWithBreakouts(game_id),
  };

  rounds: RoundStore = {
    create: (input) => this.createRound(input),
    start: (round_id) => this.startRound(round_id),
    end: (round_id) => this.endRound(round_id),
    setReflectionSurveyRequested: (round_id, requested) =>
      this.setReflectionSurveyRequested(round_id, requested),
    delete: (round_id) => this.deleteRound(round_id),
    findLatest: (game_id) => this.findLatestRound(game_id),
    list: (game_id) => this.listRounds(game_id),
    decrementDuration: (round_id, delta) =>
      this.decrementRoundDuration(round_id, delta),
    setComplexity: (round_id, complexity) =>
      this.setRoundComplexity(round_id, complexity),
  };

  pairRounds: PairRoundStore = {
    create: (input) => this.createPairRound(input),
    listForRound: (round_id) => this.listPairRoundsForRound(round_id),
    find: (round_id, pair_id) => this.findPairRound(round_id, pair_id),
    setBriefsRevealed: (pr_id) => this.setBriefsRevealed(pr_id),
    incrementSharesRemaining: (pr_id) => this.incrementSharesRemaining(pr_id),
    setTestEnabled: (pr_id, enabled) => this.setTestEnabled(pr_id, enabled),
    updateGoalPattern: (pr_id, pattern, seed) =>
      this.updateGoalPattern(pr_id, pattern, seed),
    setPrototypeUntil: (pr_id, until) => this.setPrototypeUntil(pr_id, until),
    captureBuilderSnapshot: (pr_id, snapshot) =>
      this.captureBuilderSnapshot(pr_id, snapshot),
  };

  placements: PlacementStore = {
    create: (input) => this.createPlacement(input),
    list: (pr_id) => this.listPlacements(pr_id),
    listByPairRoundIds: (ids) => this.listPlacementsByPairRoundIds(ids),
    find: (id) => this.findPlacement(id),
    delete: (id) => this.deletePlacement(id),
    clear: (pr_id) => this.clearPlacements(pr_id),
    update: (id, patch) => this.updatePlacement(id, patch),
  };

  briefs: BriefStore = {
    upsert: (input) => this.upsertBrief(input),
    find: (pr_id, role) => this.findBrief(pr_id, role),
    listForPairRound: (pr_id) => this.listBriefsForPairRound(pr_id),
    listByPairRoundIds: (ids) => this.listBriefsByPairRoundIds(ids),
    listLibrary: (input) => this.listLibraryBriefs(input),
  };

  superPowers: SuperPowerStore = {
    createEvent: (input) => this.createSuperPowerEvent(input),
    listEvents: (round_id) => this.listSuperPowerEvents(round_id),
  };

  private _roundSurveyTable = new Map<string, RoundSurveyRecord>();

  roundSurveys: RoundSurveyStore = {
    upsert: (input) => this.upsertRoundSurvey(input),
    findForParticipant: (round_id, participant_id) =>
      this.findRoundSurveyForParticipant(round_id, participant_id),
    listForRound: (round_id) => this.listRoundSurveys(round_id),
  };

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
      meeting_mode: input.meeting_mode ?? "remote",
      breakout_provider: input.breakout_provider ?? "none",
    };
    this._gameTable.set(record.code, record);
    return record;
  }

  async deleteGame(game_id: string): Promise<void> {
    // Mirror the Postgres FK cascade: dropping a game must also remove
    // every row keyed by it. The in-memory backend has no FK enforcement
    // so we emulate the cascade explicitly. Used by the upload route's
    // compensating-rollback path; missing-key calls are a no-op.
    let gameCode: string | null = null;
    for (const [code, g] of this._gameTable.entries()) {
      if (g.id === game_id) {
        gameCode = code;
        break;
      }
    }
    if (gameCode === null) return;
    this._gameTable.delete(gameCode);

    for (const [id, p] of this._pairTable.entries()) {
      if (p.game_id === game_id) this._pairTable.delete(id);
    }
    for (const [id, p] of this._participantTable.entries()) {
      if (p.game_id === game_id) this._participantTable.delete(id);
    }
    const roundIds = new Set<string>();
    for (const [id, r] of this._roundTable.entries()) {
      if (r.game_id === game_id) {
        roundIds.add(id);
        this._roundTable.delete(id);
      }
    }
    const pairRoundIds = new Set<string>();
    for (const [id, pr] of this._pairRoundTable.entries()) {
      if (roundIds.has(pr.round_id)) {
        pairRoundIds.add(id);
        this._pairRoundTable.delete(id);
      }
    }
    for (const [id, b] of this._briefTable.entries()) {
      if (pairRoundIds.has(b.pair_round_id)) this._briefTable.delete(id);
    }
    for (const [id, pl] of this._placementTable.entries()) {
      if (pairRoundIds.has(pl.pair_round_id)) this._placementTable.delete(id);
    }
    for (const [id, ev] of this._superPowerTable.entries()) {
      if (roundIds.has(ev.round_id)) this._superPowerTable.delete(id);
    }
    for (const [id, s] of this._roundSurveyTable.entries()) {
      if (roundIds.has(s.round_id)) this._roundSurveyTable.delete(id);
    }
  }

  async findGameByCode(code: string): Promise<GameRecord | null> {
    return this._gameTable.get(code) ?? null;
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
      email: input.email ?? null,
      join_short_key: input.join_short_key ?? null,
    };
    this._participantTable.set(record.id, record);
    return record;
  }

  async findParticipantByJoinShortKey(
    key: string,
  ): Promise<ParticipantRecord | null> {
    for (const p of this._participantTable.values()) {
      if (p.join_short_key === key) return p;
    }
    return null;
  }

  async listActiveParticipants(game_id: string): Promise<ParticipantRecord[]> {
    return [...this._participantTable.values()]
      .filter((p) => p.game_id === game_id && p.released_at === null)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  }

  async findParticipantByName(
    game_id: string,
    display_name: string,
  ): Promise<ParticipantRecord | null> {
    const target = display_name.toLowerCase();
    for (const p of this._participantTable.values()) {
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
    return this._participantTable.get(id) ?? null;
  }

  async touchParticipant(id: string): Promise<void> {
    const p = this._participantTable.get(id);
    if (p) p.last_seen_at = new Date().toISOString();
  }

  async releaseParticipant(id: string): Promise<void> {
    const p = this._participantTable.get(id);
    if (!p) return;
    p.released_at = new Date().toISOString();
    p.pair_id = null;
    p.role = "lobby";
  }

  async swapPairRoles(pair_id: string): Promise<void> {
    const pair = this._pairTable.get(pair_id);
    if (!pair) throw new Error("swapPairRoles: pair not found");
    if (!pair.builder_id || !pair.guider_id) {
      throw new Error("swapPairRoles: pair missing builder or guider");
    }
    const oldBuilder = this._participantTable.get(pair.builder_id);
    const oldGuider = this._participantTable.get(pair.guider_id);
    if (oldBuilder) oldBuilder.role = "guider";
    if (oldGuider) oldGuider.role = "builder";
    const swapped = pair.builder_id;
    pair.builder_id = pair.guider_id;
    pair.guider_id = swapped;
  }

  async swapAllPairRoles(game_id: string): Promise<number> {
    let count = 0;
    for (const pair of this._pairTable.values()) {
      if (pair.game_id !== game_id) continue;
      if (!pair.builder_id || !pair.guider_id) continue;
      await this.swapPairRoles(pair.id);
      count += 1;
    }
    return count;
  }

  async reshufflePartners(game_id: string): Promise<number> {
    const pairs = Array.from(this._pairTable.values()).filter(
      (p) =>
        p.game_id === game_id &&
        p.builder_id !== null &&
        p.guider_id !== null,
    );
    if (pairs.length < 2) return 0;

    const builders = pairs.map((p) => p.builder_id!);
    const guiders = pairs.map((p) => p.guider_id!);
    // Fisher-Yates on each list independently. Re-rolling when the
    // shuffle reproduces every original mapping would let an
    // adversarial RNG loop, but the probability is 1/n! and the
    // dashboard surface lets the GM click the button again anyway —
    // a single pass is enough.
    shuffleInPlace(builders);
    shuffleInPlace(guiders);

    let changed = 0;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]!;
      const newBuilder = builders[i]!;
      const newGuider = guiders[i]!;
      if (
        pair.builder_id !== newBuilder ||
        pair.guider_id !== newGuider ||
        pair.display_name !== null
      ) {
        pair.builder_id = newBuilder;
        pair.guider_id = newGuider;
        // The custom name belonged to whoever WAS partnered up; clear
        // it so a stale "The Pelicans" rename doesn't follow Alice
        // onto her new pair.
        pair.display_name = null;
        // Re-anchor the participants' pair_id so listActive() reports
        // the new assignment.
        const b = this._participantTable.get(newBuilder);
        const g = this._participantTable.get(newGuider);
        if (b) {
          b.pair_id = pair.id;
          b.role = "builder";
        }
        if (g) {
          g.pair_id = pair.id;
          g.role = "guider";
        }
        changed += 1;
      }
    }
    return changed;
  }

  async createPair(
    game_id: string,
    builder_id: string,
    guider_id: string,
  ): Promise<PairRecord> {
    const builder = this._participantTable.get(builder_id);
    const guider = this._participantTable.get(guider_id);
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
      breakout_call_url: null,
      breakout_event_id: null,
      builder_brief_override: null,
      guider_brief_override: null,
    };
    this._pairTable.set(pair.id, pair);
    builder.role = "builder";
    builder.pair_id = pair.id;
    guider.role = "guider";
    guider.pair_id = pair.id;
    return pair;
  }

  async listPairs(game_id: string): Promise<PairRecord[]> {
    return [...this._pairTable.values()]
      .filter((p) => p.game_id === game_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async assignObserver(
    participant_id: string,
    pair_id: string,
  ): Promise<void> {
    const p = this._participantTable.get(participant_id);
    const pair = this._pairTable.get(pair_id);
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
    const p = this._pairTable.get(pair_id);
    if (p) p.display_name = name;
  }

  async clearAllocations(game_id: string): Promise<void> {
    for (const p of this._participantTable.values()) {
      if (p.game_id === game_id && p.role !== "gm") {
        p.role = "lobby";
        p.pair_id = null;
      }
    }
    for (const [id, pair] of this._pairTable.entries()) {
      if (pair.game_id === game_id) this._pairTable.delete(id);
    }
  }

  async disbandPair(pair_id: string): Promise<void> {
    if (!this._pairTable.has(pair_id)) return;
    for (const p of this._participantTable.values()) {
      if (p.pair_id === pair_id && p.role !== "gm") {
        p.pair_id = null;
        p.role = "lobby";
      }
    }
    this._pairTable.delete(pair_id);
  }

  async setBriefOverrides(
    pair_id: string,
    overrides: {
      builder: { title: string; rules: string[] } | null;
      guider: { title: string; rules: string[] } | null;
    },
  ): Promise<void> {
    const pair = this._pairTable.get(pair_id);
    if (!pair) return;
    pair.builder_brief_override = overrides.builder
      ? { title: overrides.builder.title, rules: [...overrides.builder.rules] }
      : null;
    pair.guider_brief_override = overrides.guider
      ? { title: overrides.guider.title, rules: [...overrides.guider.rules] }
      : null;
  }

  async clearBriefOverrides(pair_id: string): Promise<void> {
    const pair = this._pairTable.get(pair_id);
    if (!pair) return;
    pair.builder_brief_override = null;
    pair.guider_brief_override = null;
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
      reflection_survey_requested: false,
    };
    this._roundTable.set(round.id, round);
    return round;
  }

  async setReflectionSurveyRequested(
    round_id: string,
    requested: boolean,
  ): Promise<void> {
    const r = this._roundTable.get(round_id);
    if (r) r.reflection_survey_requested = requested;
  }

  async startRound(round_id: string): Promise<void> {
    const r = this._roundTable.get(round_id);
    if (r) {
      r.status = "running";
      r.started_at = new Date().toISOString();
    }
  }

  async endRound(round_id: string): Promise<void> {
    const r = this._roundTable.get(round_id);
    if (r && r.status !== "ended") {
      r.status = "ended";
      r.ended_at = new Date().toISOString();
    }
  }

  async deleteRound(round_id: string): Promise<void> {
    const pairRoundIds = new Set<string>();
    for (const [id, pr] of this._pairRoundTable.entries()) {
      if (pr.round_id === round_id) {
        pairRoundIds.add(id);
        this._pairRoundTable.delete(id);
      }
    }
    for (const [id, b] of this._briefTable.entries()) {
      if (pairRoundIds.has(b.pair_round_id)) this._briefTable.delete(id);
    }
    for (const [id, p] of this._placementTable.entries()) {
      if (pairRoundIds.has(p.pair_round_id)) this._placementTable.delete(id);
    }
    for (const [id, e] of this._superPowerTable.entries()) {
      if (e.round_id === round_id) this._superPowerTable.delete(id);
    }
    this._roundTable.delete(round_id);
  }

  async findLatestRound(game_id: string): Promise<RoundRecord | null> {
    const rs = [...this._roundTable.values()]
      .filter((r) => r.game_id === game_id)
      .sort((a, b) => b.index - a.index);
    return rs[0] ?? null;
  }

  async listRounds(game_id: string): Promise<RoundRecord[]> {
    return [...this._roundTable.values()]
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
      shares_remaining: 0,
      briefs_revealed: false,
      prototype_until: null,
      builder_snapshot: null,
    };
    this._pairRoundTable.set(pr.id, pr);
    return pr;
  }

  async listPairRoundsForRound(round_id: string): Promise<PairRoundRecord[]> {
    return [...this._pairRoundTable.values()].filter(
      (pr) => pr.round_id === round_id,
    );
  }

  async findPairRound(
    round_id: string,
    pair_id: string,
  ): Promise<PairRoundRecord | null> {
    for (const pr of this._pairRoundTable.values()) {
      if (pr.round_id === round_id && pr.pair_id === pair_id) return pr;
    }
    return null;
  }

  async findPairById(pair_id: string): Promise<PairRecord | null> {
    return this._pairTable.get(pair_id) ?? null;
  }

  async setGameStatus(
    game_id: string,
    status: "lobby" | "running" | "ended" | "purged",
  ): Promise<void> {
    for (const g of this._gameTable.values()) {
      if (g.id === game_id) {
        g.status = status;
        // Persist the lifecycle pivot. The schema has had `ended_at`
        // since v1, but earlier versions of this method only flipped
        // status — flagged by the 2026-05-04 tessera-tl review. Future
        // retention / reporting reads `ended_at` directly, so it has
        // to be the source of truth here.
        if (status === "ended") {
          g.ended_at = new Date().toISOString();
        } else if (status === "lobby" || status === "running") {
          g.ended_at = null;
        }
      }
    }
  }

  async updateScoring(
    game_id: string,
    patch: { scoring_correct_pts?: number; scoring_wrong_pts?: number },
  ): Promise<void> {
    for (const g of this._gameTable.values()) {
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
    for (const g of this._gameTable.values()) {
      if (g.id === game_id) {
        if (role === "builder") g.builder_brief_on = on;
        else g.guider_brief_on = on;
      }
    }
  }

  async setPairBreakout(
    pair_id: string,
    breakout: { call_url: string; event_id: string },
  ): Promise<void> {
    const p = this._pairTable.get(pair_id);
    if (!p) return;
    p.breakout_call_url = breakout.call_url;
    p.breakout_event_id = breakout.event_id;
  }

  async setPreSuppliedBreakout(
    pair_id: string,
    call_url: string,
  ): Promise<void> {
    const p = this._pairTable.get(pair_id);
    if (!p) return;
    p.breakout_call_url = call_url;
    p.breakout_event_id = null;
  }

  async clearPairBreakout(pair_id: string): Promise<void> {
    const p = this._pairTable.get(pair_id);
    if (!p) return;
    p.breakout_call_url = null;
    p.breakout_event_id = null;
  }

  async listPairsWithBreakouts(
    game_id: string,
  ): Promise<Array<{ id: string; event_id: string; call_url: string }>> {
    return [...this._pairTable.values()]
      .filter(
        (p) =>
          p.game_id === game_id &&
          p.breakout_event_id != null &&
          p.breakout_call_url != null,
      )
      .map((p) => ({
        id: p.id,
        event_id: p.breakout_event_id!,
        call_url: p.breakout_call_url!,
      }));
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
    for (const p of this._placementTable.values()) {
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
    this._placementTable.set(record.id, record);
    return record;
  }

  async listPlacements(pair_round_id: string): Promise<PlacementRecord[]> {
    return [...this._placementTable.values()]
      .filter((p) => p.pair_round_id === pair_round_id)
      .sort((a, b) => a.placed_at.localeCompare(b.placed_at));
  }

  async listPlacementsByPairRoundIds(
    pair_round_ids: string[],
  ): Promise<Map<string, PlacementRecord[]>> {
    const wanted = new Set(pair_round_ids);
    const out = new Map<string, PlacementRecord[]>();
    for (const id of pair_round_ids) out.set(id, []);
    for (const p of this._placementTable.values()) {
      if (!wanted.has(p.pair_round_id)) continue;
      out.get(p.pair_round_id)!.push(p);
    }
    for (const list of out.values()) {
      list.sort((a, b) => a.placed_at.localeCompare(b.placed_at));
    }
    return out;
  }

  async findPlacement(id: string): Promise<PlacementRecord | null> {
    return this._placementTable.get(id) ?? null;
  }

  async deletePlacement(id: string): Promise<boolean> {
    return this._placementTable.delete(id);
  }

  async clearPlacements(pair_round_id: string): Promise<number> {
    let count = 0;
    for (const [id, p] of this._placementTable.entries()) {
      if (p.pair_round_id === pair_round_id) {
        this._placementTable.delete(id);
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
    const existing = this._placementTable.get(id);
    if (!existing) return null;
    const newQ = patch.q ?? existing.q;
    const newR = patch.r ?? existing.r;
    if (newQ !== existing.q || newR !== existing.r) {
      for (const p of this._placementTable.values()) {
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
    for (const [id, b] of this._briefTable.entries()) {
      if (b.pair_round_id === input.pair_round_id && b.role === input.role) {
        this._briefTable.delete(id);
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
    this._briefTable.set(record.id, record);
    return record;
  }

  async findBrief(
    pair_round_id: string,
    role: BriefRole,
  ): Promise<BriefRecord | null> {
    for (const b of this._briefTable.values()) {
      if (b.pair_round_id === pair_round_id && b.role === role) return b;
    }
    return null;
  }

  async listBriefsForPairRound(
    pair_round_id: string,
  ): Promise<BriefRecord[]> {
    return [...this._briefTable.values()].filter(
      (b) => b.pair_round_id === pair_round_id,
    );
  }

  async listBriefsByPairRoundIds(
    pair_round_ids: string[],
  ): Promise<Map<string, BriefRecord[]>> {
    const wanted = new Set(pair_round_ids);
    const out = new Map<string, BriefRecord[]>();
    for (const id of pair_round_ids) out.set(id, []);
    for (const b of this._briefTable.values()) {
      if (!wanted.has(b.pair_round_id)) continue;
      out.get(b.pair_round_id)!.push(b);
    }
    return out;
  }

  // The in-memory backend has no library — Supabase is authoritative.
  // Returning [] forces the orchestrator to fall back to a built-in
  // emergency brief if it ever runs against the in-memory store.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listLibraryBriefs(_: {
    role: BriefRole;
    complexity: number;
    exclude_titles?: string[];
  }): Promise<LibraryBriefRecord[]> {
    return [];
  }

  async createSuperPowerEvent(input: {
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
    this._superPowerTable.set(event.id, event);
    return { id: event.id, triggered_at: event.triggered_at };
  }

  async listSuperPowerEvents(round_id: string): Promise<
    Array<{
      id: string;
      kind: string;
      scope: "pair" | "all";
      pair_id: string | null;
      triggered_at: string;
    }>
  > {
    return [...this._superPowerTable.values()].filter(
      (e) => e.round_id === round_id,
    );
  }

  async setBriefsRevealed(pair_round_id: string): Promise<void> {
    const pr = this._pairRoundTable.get(pair_round_id);
    if (pr) pr.briefs_revealed = true;
  }

  async incrementSharesRemaining(pair_round_id: string): Promise<number> {
    const pr = this._pairRoundTable.get(pair_round_id);
    if (!pr) throw new Error("incrementSharesRemaining: not_found");
    pr.shares_remaining = (pr.shares_remaining ?? 0) + 1;
    return pr.shares_remaining;
  }

  async setTestEnabled(
    pair_round_id: string,
    enabled: boolean,
  ): Promise<void> {
    const pr = this._pairRoundTable.get(pair_round_id);
    if (pr) pr.test_enabled = enabled;
  }

  async updateGoalPattern(
    pair_round_id: string,
    pattern: unknown,
    seed: string,
  ): Promise<void> {
    const pr = this._pairRoundTable.get(pair_round_id);
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
    const game = [...this._gameTable.values()].find((g) => g.id === input.game_id);
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
    const r = this._roundTable.get(round_id);
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
    const pr = this._pairRoundTable.get(pair_round_id);
    if (pr) pr.prototype_until = until.toISOString();
  }

  async setRoundComplexity(
    round_id: string,
    complexity: number,
  ): Promise<void> {
    const r = this._roundTable.get(round_id);
    if (r) r.complexity = complexity;
  }

  async captureBuilderSnapshot(
    pair_round_id: string,
    snapshot: unknown,
  ): Promise<number> {
    const pr = this._pairRoundTable.get(pair_round_id);
    if (!pr) throw new SnapshotShareCapError("pair_round_not_found");
    if (pr.shares_remaining <= 0) {
      throw new SnapshotShareCapError("no_shares_remaining");
    }
    pr.builder_snapshot = snapshot;
    pr.shares_remaining = pr.shares_remaining - 1;
    return pr.shares_remaining;
  }

  // ─── Round surveys ─────────────────────────────────────────────────
  private surveyKey(round_id: string, participant_id: string): string {
    return `${round_id}:${participant_id}`;
  }

  async upsertRoundSurvey(input: {
    round_id: string;
    participant_id: string;
    comm_balance: number;
    attr_self: number;
    attr_partner: number;
    attr_system: number;
  }): Promise<RoundSurveyRecord> {
    const key = this.surveyKey(input.round_id, input.participant_id);
    const existing = this._roundSurveyTable.get(key);
    const record: RoundSurveyRecord = existing
      ? {
          ...existing,
          comm_balance: input.comm_balance,
          attr_self: input.attr_self,
          attr_partner: input.attr_partner,
          attr_system: input.attr_system,
          submitted_at: new Date().toISOString(),
        }
      : {
          id: crypto.randomUUID(),
          round_id: input.round_id,
          participant_id: input.participant_id,
          comm_balance: input.comm_balance,
          attr_self: input.attr_self,
          attr_partner: input.attr_partner,
          attr_system: input.attr_system,
          submitted_at: new Date().toISOString(),
        };
    this._roundSurveyTable.set(key, record);
    return record;
  }

  async findRoundSurveyForParticipant(
    round_id: string,
    participant_id: string,
  ): Promise<RoundSurveyRecord | null> {
    return (
      this._roundSurveyTable.get(this.surveyKey(round_id, participant_id)) ??
      null
    );
  }

  async listRoundSurveys(round_id: string): Promise<RoundSurveyRecord[]> {
    return [...this._roundSurveyTable.values()].filter(
      (s) => s.round_id === round_id,
    );
  }
}

let _instance: MemoryGameRepository | null = null;
export function getMemoryRepository(): MemoryGameRepository {
  if (!_instance) _instance = new MemoryGameRepository();
  return _instance;
}

/**
 * Fisher-Yates in-place shuffle. Used by reshufflePartners to
 * re-randomise pair assignments. Uses Math.random — fine for
 * dashboard-driven reshuffles; the repository isn't a security
 * boundary.
 */
function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}
