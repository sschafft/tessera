import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CreateGameInput,
  GameRecord,
  GameRepository,
} from "./repository";

type DbGame = Database["public"]["Tables"]["games"]["Row"];

function toGameRecord(row: DbGame): GameRecord {
  return {
    id: row.id,
    code: row.code,
    workshop_name: row.workshop_name,
    video_call_url: row.video_call_url,
    whiteboard_url: row.whiteboard_url,
    team_mode: row.team_mode,
    default_complexity: row.default_complexity,
    builder_brief_on: row.builder_brief_on,
    guider_brief_on: row.guider_brief_on,
    builder_brief_source: row.builder_brief_source,
    guider_brief_source: row.guider_brief_source,
    round_count: row.round_count,
    round_duration_seconds: row.round_duration_seconds,
    participant_cap: row.participant_cap,
    sound_on: row.sound_on,
    status: row.status,
    created_at: row.created_at,
    last_interaction_at: row.last_interaction_at,
    ended_at: row.ended_at,
    host_token_hash: row.host_token_hash,
    gemini_calls_used: row.gemini_calls_used,
    gm_participant_id: row.gm_participant_id,
  };
}

export class SupabaseGameRepository implements GameRepository {
  async create(
    input: CreateGameInput & {
      code: string;
      host_token_hash: string;
      gm_participant_id: string;
    },
  ): Promise<GameRecord> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("games")
      .insert({
        code: input.code,
        workshop_name: input.workshop_name,
        video_call_url: input.video_call_url,
        whiteboard_url: input.whiteboard_url ?? null,
        team_mode: input.team_mode,
        default_complexity: input.default_complexity,
        builder_brief_on: input.builder_brief_on,
        guider_brief_on: input.guider_brief_on,
        builder_brief_source: input.builder_brief_source,
        guider_brief_source: input.guider_brief_source,
        round_count: input.round_count,
        round_duration_seconds: input.round_duration_seconds,
        participant_cap: input.participant_cap,
        sound_on: input.sound_on,
        host_token_hash: input.host_token_hash,
        gm_participant_id: input.gm_participant_id,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create game: ${error?.message ?? "unknown"}`);
    }
    return toGameRecord(data);
  }

  async findByCode(code: string): Promise<GameRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find game: ${error.message}`);
    }
    return data ? toGameRecord(data) : null;
  }
}
