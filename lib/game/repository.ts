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
}
