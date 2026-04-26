/**
 * GameRepository — abstract storage for games and participants. The
 * milestone-1 in-memory implementation lives in `./repository.memory.ts`;
 * the Supabase-backed implementation will replace it once we wire up the
 * hosted dev project (see TDD §11).
 */

export type TeamMode = "gm_picks" | "players_pick";
export type BriefSource = "library" | "gm" | "gemini";

export interface CreateGameInput {
  workshop_name: string;
  video_call_url: string;
  whiteboard_url?: string | null;
  team_mode: TeamMode;
  default_complexity: number; // 1..8
  builder_brief_on: boolean;
  guider_brief_on: boolean;
  builder_brief_source: BriefSource;
  guider_brief_source: BriefSource;
  round_count: number; // 1..5
  round_duration_seconds: number;
  participant_cap: number; // 3..50
  sound_on: boolean;
}

export interface GameRecord extends CreateGameInput {
  id: string;
  code: string;
  status: "lobby" | "running" | "ended" | "purged";
  created_at: string;
  last_interaction_at: string;
  ended_at: string | null;
  /** bcrypt hash of the one-shot host recovery token. Never returned to clients. */
  host_token_hash: string;
  gemini_calls_used: number;
  /** participant_id (uuid) of the GM who created the game. */
  gm_participant_id: string;
}

export interface GameRepository {
  create(
    input: CreateGameInput & {
      code: string;
      host_token_hash: string;
      gm_participant_id: string;
    },
  ): Promise<GameRecord>;

  findByCode(code: string): Promise<GameRecord | null>;
}
