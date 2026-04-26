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
  round_count: number;
  round_duration_seconds: number;
  participant_cap: number;
  sound_on: boolean;
}

export interface GameRecord extends CreateGameInput {
  id: string;
  code: string;
  status: "lobby" | "running" | "ended" | "purged";
  created_at: string;
  last_interaction_at: string;
  ended_at: string | null;
  host_token_hash: string;
  gemini_calls_used: number;
  gm_participant_id: string;
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
   * Find the most recent (highest index) round for a game.
   */
  findLatestRound(game_id: string): Promise<RoundRecord | null>;

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
   * Update the game status (lobby → running → ended → purged).
   */
  setGameStatus(
    game_id: string,
    status: "lobby" | "running" | "ended" | "purged",
  ): Promise<void>;
}
