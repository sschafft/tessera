/**
 * Repository — abstract storage layer for games + participants. The
 * milestone-1 in-memory implementation lives in `./repository.memory.ts`;
 * the Supabase-backed implementation is `./repository.supabase.ts`.
 */

export type TeamMode = "gm_picks" | "players_pick";
export type BriefSource = "library" | "gm" | "gemini";
export type ParticipantRole =
  | "gm"
  | "builder"
  | "guider"
  | "observer"
  | "lobby";

export interface CustomBrief {
  title: string;
  rules: string[];
}

export interface CreateGameInput {
  workshop_name: string;
  video_call_url: string;
  whiteboard_url?: string | null;
  team_mode: TeamMode;
  default_complexity: number;
  builder_brief_on: boolean;
  guider_brief_on: boolean;
  builder_brief_source: BriefSource;
  guider_brief_source: BriefSource;
  /** Required when builder_brief_source='gm'; ignored otherwise. */
  builder_brief_custom?: CustomBrief | null;
  /** Required when guider_brief_source='gm'; ignored otherwise. */
  guider_brief_custom?: CustomBrief | null;
  round_count: number;
  round_duration_seconds: number;
  participant_cap: number;
  sound_on: boolean;
}

export interface ScoringConfig {
  /** Points awarded per correct placement at test/round-end. Default 10. */
  scoring_correct_pts: number;
  /**
   * Flat penalty applied if there is at least one wrong placement.
   * Default 0 (no penalty); GM can flip to -1 via the scoring super
   * power.
   */
  scoring_wrong_pts: number;
}

export interface GameRecord extends CreateGameInput, ScoringConfig {
  id: string;
  code: string;
  status: "lobby" | "running" | "ended" | "purged";
  created_at: string;
  last_interaction_at: string;
  ended_at: string | null;
  host_token_hash: string;
  gemini_calls_used: number;
  gm_participant_id: string;
  builder_brief_custom: CustomBrief | null;
  guider_brief_custom: CustomBrief | null;
}

export interface ParticipantRecord {
  id: string;
  game_id: string;
  display_name: string;
  role: ParticipantRole;
  pair_id: string | null;
  color: string;
  joined_at: string;
  last_seen_at: string;
  released_at: string | null;
}

export interface CreateParticipantInput {
  id?: string;
  game_id: string;
  display_name: string;
  role: ParticipantRole;
  color: string;
}

export interface PairRecord {
  id: string;
  game_id: string;
  builder_id: string | null;
  guider_id: string | null;
  created_at: string;
}

export type RoundStatus = "pending" | "running" | "ended";

export interface RoundRecord {
  id: string;
  game_id: string;
  index: number;
  complexity: number;
  duration_seconds: number;
  status: RoundStatus;
  started_at: string | null;
  ended_at: string | null;
}

export interface PairRoundRecord {
  id: string;
  round_id: string;
  pair_id: string;
  goal_pattern: unknown;
  pattern_seed: string;
  test_enabled: boolean;
  shares_remaining: number;
  briefs_revealed: boolean;
  /** ISO-8601 timestamp until which Prototype glimpse is visible. */
  prototype_until: string | null;
  /** Snapshot of placements captured by the last Agile share. */
  builder_snapshot: unknown;
}

export interface PlacementRecord {
  id: string;
  pair_round_id: string;
  shape: string;
  color: string;
  q: number;
  r: number;
  rot: number;
  placed_by: string;
  placed_at: string;
}

export type BriefRole = "builder" | "guider";

export interface BriefRecord {
  id: string;
  pair_round_id: string;
  role: BriefRole;
  source: BriefSource;
  title: string;
  rules: string[];
  revealed: boolean;
  created_at: string;
}

export interface LibraryBriefRecord {
  id: string;
  role: BriefRole;
  complexity_min: number;
  complexity_max: number;
  title: string;
  rules: string[];
}

export interface GameRepository {
  createGame(
    input: CreateGameInput & {
      code: string;
      host_token_hash: string;
      gm_participant_id: string;
    },
  ): Promise<GameRecord>;

  findGameByCode(code: string): Promise<GameRecord | null>;

  /**
   * Insert a new participant. Throws when the display name is already
   * taken by an active participant in the same game (unique constraint).
   */
  createParticipant(input: CreateParticipantInput): Promise<ParticipantRecord>;

  /**
   * List all active participants for a game, ordered by joined_at asc.
   */
  listActiveParticipants(game_id: string): Promise<ParticipantRecord[]>;

  /**
   * Find a participant by display name (case-insensitive) within a game.
   * Active participants only (released_at is null).
   */
  findParticipantByName(
    game_id: string,
    display_name: string,
  ): Promise<ParticipantRecord | null>;

  /**
   * Find a participant by id (for cookie-based reconnect).
   */
  findParticipantById(id: string): Promise<ParticipantRecord | null>;

  /**
   * Touch last_seen_at on a participant.
   */
  touchParticipant(id: string): Promise<void>;

  /**
   * Create a pair with a builder + guider, and atomically update both
   * participants' role + pair_id.
   */
  createPair(
    game_id: string,
    builder_id: string,
    guider_id: string,
  ): Promise<PairRecord>;

  /**
   * List pairs for a game, ordered by created_at asc.
   */
  listPairs(game_id: string): Promise<PairRecord[]>;

  /**
   * Add a participant to an existing pair as an observer. Updates the
   * participant's role + pair_id; does not modify the pair row.
   */
  assignObserver(participant_id: string, pair_id: string): Promise<void>;

  /**
   * Reset every participant in a game back to the lobby and delete all
   * existing pairs. Used as the precondition for auto-allocate.
   */
  clearAllocations(game_id: string): Promise<void>;

  /**
   * Round + pair_round operations.
   */
  createRound(input: {
    game_id: string;
    index: number;
    complexity: number;
    duration_seconds: number;
  }): Promise<RoundRecord>;

  /**
   * Mark a round running by setting started_at = now() and status = 'running'.
   */
  startRound(round_id: string): Promise<void>;

  /**
   * Mark a round ended by setting status='ended' and ended_at = now().
   * Idempotent — calling on an already-ended round is a no-op.
   */
  endRound(round_id: string): Promise<void>;

  /**
   * Delete a round (and via cascade, its pair_rounds and briefs).
   * Used to clean up half-started rounds left behind by a failed
   * /rounds/start so the GM can retry.
   */
  deleteRound(round_id: string): Promise<void>;

  /**
   * Find the most recent (highest index) round for a game.
   */
  findLatestRound(game_id: string): Promise<RoundRecord | null>;

  /**
   * List all rounds for a game in ascending index order. Used for the
   * game-end leaderboard, which sums per-round scores across all
   * ended rounds.
   */
  listRounds(game_id: string): Promise<RoundRecord[]>;

  /**
   * Insert a pair_round row with a pre-generated goal pattern.
   */
  createPairRound(input: {
    round_id: string;
    pair_id: string;
    goal_pattern: unknown;
    pattern_seed: string;
  }): Promise<PairRoundRecord>;

  listPairRoundsForRound(round_id: string): Promise<PairRoundRecord[]>;

  /**
   * Find the pair_round row for a given (round, pair). Used by player
   * views to fetch their goal pattern.
   */
  findPairRound(
    round_id: string,
    pair_id: string,
  ): Promise<PairRoundRecord | null>;

  /**
   * Find a pair by id (used for play-state lookups).
   */
  findPairById(pair_id: string): Promise<PairRecord | null>;

  /**
   * Place a tile on the canvas. Throws PlacementCellTakenError when
   * the (pair_round, q, r) cell is already occupied.
   */
  createPlacement(input: {
    pair_round_id: string;
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
    placed_by: string;
  }): Promise<PlacementRecord>;

  /**
   * Returns placements ordered by placed_at ascending.
   */
  listPlacements(pair_round_id: string): Promise<PlacementRecord[]>;

  /**
   * Read a single placement (for ownership check before delete).
   */
  findPlacement(id: string): Promise<PlacementRecord | null>;

  /**
   * Delete a placement by id. Returns true on delete, false if not found.
   */
  deletePlacement(id: string): Promise<boolean>;

  /**
   * Delete every placement in a pair_round. Returns count deleted.
   * Used by the builder's "Clear all" action.
   */
  clearPlacements(pair_round_id: string): Promise<number>;

  /**
   * Update a placement's cell (q, r), rotation, shape, and/or color.
   * Throws PlacementCellTakenError when a new (q, r) collides with
   * another placement in the same pair_round. Used both for moves and
   * for tap-occupied-cell-with-selection convert-in-place.
   */
  updatePlacement(
    id: string,
    patch: {
      q?: number;
      r?: number;
      rot?: number;
      shape?: string;
      color?: string;
    },
  ): Promise<PlacementRecord | null>;

  /**
   * Insert (or replace) a brief for a (pair_round, role). Used both at
   * round start and for re-rolls.
   */
  upsertBrief(input: {
    pair_round_id: string;
    role: BriefRole;
    source: BriefSource;
    title: string;
    rules: string[];
  }): Promise<BriefRecord>;

  /**
   * Read a single brief for a pair_round + role.
   */
  findBrief(
    pair_round_id: string,
    role: BriefRole,
  ): Promise<BriefRecord | null>;

  /**
   * Read both briefs for a pair_round (used by the GM dashboard).
   */
  listBriefsForPairRound(pair_round_id: string): Promise<BriefRecord[]>;

  /**
   * Read library briefs matching a role + complexity, optionally
   * excluding titles (for re-roll dedupe).
   */
  listLibraryBriefs(input: {
    role: BriefRole;
    complexity: number;
    exclude_titles?: string[];
  }): Promise<LibraryBriefRecord[]>;

  /**
   * Update the game status (lobby → running → ended → purged).
   */
  setGameStatus(
    game_id: string,
    status: "lobby" | "running" | "ended" | "purged",
  ): Promise<void>;

  /**
   * Patch the scoring config for a game. Either field is optional.
   * Used by the scoring super-power.
   */
  updateScoring(
    game_id: string,
    patch: { scoring_correct_pts?: number; scoring_wrong_pts?: number },
  ): Promise<void>;

  // ─── Accelerants ───────────────────────────────────────────────────
  createAccelerantEvent(input: {
    round_id: string;
    scope: "pair" | "all";
    pair_id: string | null;
    kind: string;
    payload?: unknown;
    triggered_by: string;
  }): Promise<{ id: string; triggered_at: string }>;

  listAccelerantEvents(round_id: string): Promise<
    Array<{
      id: string;
      kind: string;
      scope: "pair" | "all";
      pair_id: string | null;
      triggered_at: string;
    }>
  >;

  setBriefsRevealed(pair_round_id: string): Promise<void>;

  setTestEnabled(pair_round_id: string, enabled: boolean): Promise<void>;

  updateGoalPattern(
    pair_round_id: string,
    pattern: unknown,
    seed: string,
  ): Promise<void>;

  decrementRoundDuration(round_id: string, delta: number): Promise<void>;

  /**
   * Atomic check-and-increment for the Gemini budget. Returns:
   *   - { ok: true, perGame, perDay } when both caps are still under
   *   - { ok: false, reason } otherwise (without incrementing)
   * Both caps configured in TDD §13.1 (30/game, 800/day).
   */
  reserveGeminiCall(input: {
    game_id: string;
    perGameMax: number;
    perDayMax: number;
  }): Promise<
    | { ok: true; perGame: number; perDay: number }
    | { ok: false; reason: "per_game_cap" | "per_day_cap" }
  >;

  /**
   * Set Prototype-glimpse visibility window. Builder play state will
   * surface a degraded preview of the goal until `until` passes.
   */
  setPrototypeUntil(pair_round_id: string, until: Date): Promise<void>;

  /**
   * Capture the builder's current placements into the pair_round's
   * snapshot field, and decrement shares_remaining. Returns the new
   * shares_remaining value.
   */
  captureBuilderSnapshot(
    pair_round_id: string,
    snapshot: unknown,
  ): Promise<number>;
}
