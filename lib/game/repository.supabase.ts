import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { DuplicateNameError } from "./repository.memory";
import type {
  CreateGameInput,
  CreateParticipantInput,
  GameRecord,
  GameRepository,
  ParticipantRecord,
} from "./repository";

type DbGame = Database["public"]["Tables"]["games"]["Row"];
type DbParticipant = Database["public"]["Tables"]["participants"]["Row"];

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

function toParticipantRecord(row: DbParticipant): ParticipantRecord {
  return {
    id: row.id,
    game_id: row.game_id,
    display_name: row.display_name,
    role: row.role,
    pair_id: row.pair_id,
    color: row.color,
    joined_at: row.joined_at,
    last_seen_at: row.last_seen_at,
    released_at: row.released_at,
  };
}

export class SupabaseGameRepository implements GameRepository {
  async createGame(
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

  async findGameByCode(code: string): Promise<GameRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(`findGameByCode: ${error.message}`);
    return data ? toGameRecord(data) : null;
  }

  async createParticipant(
    input: CreateParticipantInput,
  ): Promise<ParticipantRecord> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("participants")
      .insert({
        ...(input.id ? { id: input.id } : {}),
        game_id: input.game_id,
        display_name: input.display_name,
        role: input.role,
        color: input.color,
      })
      .select()
      .single();

    if (error || !data) {
      // Postgres unique-violation code is 23505. Map to our typed error.
      if (error?.code === "23505") throw new DuplicateNameError();
      throw new Error(
        `createParticipant: ${error?.message ?? "unknown"}`,
      );
    }
    return toParticipantRecord(data);
  }

  async listActiveParticipants(
    game_id: string,
  ): Promise<ParticipantRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .eq("game_id", game_id)
      .is("released_at", null)
      .order("joined_at", { ascending: true });
    if (error) throw new Error(`listActiveParticipants: ${error.message}`);
    return (data ?? []).map(toParticipantRecord);
  }

  async findParticipantByName(
    game_id: string,
    display_name: string,
  ): Promise<ParticipantRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .eq("game_id", game_id)
      .ilike("display_name", display_name)
      .is("released_at", null)
      .maybeSingle();
    if (error) throw new Error(`findParticipantByName: ${error.message}`);
    return data ? toParticipantRecord(data) : null;
  }

  async findParticipantById(id: string): Promise<ParticipantRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`findParticipantById: ${error.message}`);
    return data ? toParticipantRecord(data) : null;
  }

  async touchParticipant(id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`touchParticipant: ${error.message}`);
  }
}
