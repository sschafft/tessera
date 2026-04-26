import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  DuplicateNameError,
  PlacementCellTakenError,
} from "./repository.memory";
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

type DbGame = Database["public"]["Tables"]["games"]["Row"];
type DbParticipant = Database["public"]["Tables"]["participants"]["Row"];
type DbPair = Database["public"]["Tables"]["pairs"]["Row"];
type DbRound = Database["public"]["Tables"]["rounds"]["Row"];
type DbPairRound = Database["public"]["Tables"]["pair_rounds"]["Row"];
type DbPlacement = Database["public"]["Tables"]["placements"]["Row"];
type DbBrief = Database["public"]["Tables"]["briefs"]["Row"];
type DbLibrary = Database["public"]["Tables"]["briefs_library"]["Row"];

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

  async createPair(
    game_id: string,
    builder_id: string,
    guider_id: string,
  ): Promise<PairRecord> {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("create_pair_with_roles", {
      p_game_id: game_id,
      p_builder_id: builder_id,
      p_guider_id: guider_id,
    });
    if (error || !data) {
      throw new Error(`createPair: ${error?.message ?? "unknown"}`);
    }
    return toPairRecord(data as DbPair);
  }

  async listPairs(game_id: string): Promise<PairRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pairs")
      .select("*")
      .eq("game_id", game_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`listPairs: ${error.message}`);
    return (data ?? []).map(toPairRecord);
  }

  async assignObserver(
    participant_id: string,
    pair_id: string,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("participants")
      .update({ role: "observer", pair_id })
      .eq("id", participant_id);
    if (error) throw new Error(`assignObserver: ${error.message}`);
  }

  async clearAllocations(game_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase.rpc("clear_allocations", {
      p_game_id: game_id,
    });
    if (error) throw new Error(`clearAllocations: ${error.message}`);
  }

  async createRound(input: {
    game_id: string;
    index: number;
    complexity: number;
    duration_seconds: number;
  }): Promise<RoundRecord> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("rounds")
      .insert({
        game_id: input.game_id,
        index: input.index,
        complexity: input.complexity,
        duration_seconds: input.duration_seconds,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`createRound: ${error?.message ?? "unknown"}`);
    }
    return toRoundRecord(data);
  }

  async startRound(round_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("rounds")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", round_id);
    if (error) throw new Error(`startRound: ${error.message}`);
  }

  async endRound(round_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("rounds")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", round_id)
      .neq("status", "ended");
    if (error) throw new Error(`endRound: ${error.message}`);
  }

  async findLatestRound(game_id: string): Promise<RoundRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("game_id", game_id)
      .order("index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`findLatestRound: ${error.message}`);
    return data ? toRoundRecord(data) : null;
  }

  async createPairRound(input: {
    round_id: string;
    pair_id: string;
    goal_pattern: unknown;
    pattern_seed: string;
  }): Promise<PairRoundRecord> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pair_rounds")
      .insert({
        round_id: input.round_id,
        pair_id: input.pair_id,
        goal_pattern: input.goal_pattern as never,
        pattern_seed: input.pattern_seed,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`createPairRound: ${error?.message ?? "unknown"}`);
    }
    return toPairRoundRecord(data);
  }

  async listPairRoundsForRound(round_id: string): Promise<PairRoundRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pair_rounds")
      .select("*")
      .eq("round_id", round_id);
    if (error) throw new Error(`listPairRoundsForRound: ${error.message}`);
    return (data ?? []).map(toPairRoundRecord);
  }

  async findPairRound(
    round_id: string,
    pair_id: string,
  ): Promise<PairRoundRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pair_rounds")
      .select("*")
      .eq("round_id", round_id)
      .eq("pair_id", pair_id)
      .maybeSingle();
    if (error) throw new Error(`findPairRound: ${error.message}`);
    return data ? toPairRoundRecord(data) : null;
  }

  async findPairById(pair_id: string): Promise<PairRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pairs")
      .select("*")
      .eq("id", pair_id)
      .maybeSingle();
    if (error) throw new Error(`findPairById: ${error.message}`);
    return data ? toPairRecord(data) : null;
  }

  async setGameStatus(
    game_id: string,
    status: "lobby" | "running" | "ended" | "purged",
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("games")
      .update({ status })
      .eq("id", game_id);
    if (error) throw new Error(`setGameStatus: ${error.message}`);
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
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("placements")
      .insert({
        pair_round_id: input.pair_round_id,
        shape: input.shape,
        color: input.color,
        q: input.q,
        r: input.r,
        rot: input.rot,
        placed_by: input.placed_by,
      })
      .select()
      .single();
    if (error || !data) {
      // 23505 = unique_violation on (pair_round_id, q, r).
      if (error?.code === "23505") throw new PlacementCellTakenError();
      throw new Error(`createPlacement: ${error?.message ?? "unknown"}`);
    }
    return toPlacementRecord(data);
  }

  async listPlacements(pair_round_id: string): Promise<PlacementRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("placements")
      .select("*")
      .eq("pair_round_id", pair_round_id)
      .order("placed_at", { ascending: true });
    if (error) throw new Error(`listPlacements: ${error.message}`);
    return (data ?? []).map(toPlacementRecord);
  }

  async findPlacement(id: string): Promise<PlacementRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("placements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`findPlacement: ${error.message}`);
    return data ? toPlacementRecord(data) : null;
  }

  async deletePlacement(id: string): Promise<boolean> {
    const supabase = getServiceClient();
    const { error, count } = await supabase
      .from("placements")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new Error(`deletePlacement: ${error.message}`);
    return (count ?? 0) > 0;
  }

  async upsertBrief(input: {
    pair_round_id: string;
    role: BriefRole;
    source: BriefSource;
    title: string;
    rules: string[];
  }): Promise<BriefRecord> {
    const supabase = getServiceClient();
    // Delete any existing brief for this (pair_round, role) — the
    // unique(pair_round_id, role) index makes that the cleanest path.
    await supabase
      .from("briefs")
      .delete()
      .eq("pair_round_id", input.pair_round_id)
      .eq("role", input.role);
    const { data, error } = await supabase
      .from("briefs")
      .insert({
        pair_round_id: input.pair_round_id,
        role: input.role,
        source: input.source,
        title: input.title,
        rules: input.rules as never,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`upsertBrief: ${error?.message ?? "unknown"}`);
    }
    return toBriefRecord(data);
  }

  async findBrief(
    pair_round_id: string,
    role: BriefRole,
  ): Promise<BriefRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("briefs")
      .select("*")
      .eq("pair_round_id", pair_round_id)
      .eq("role", role)
      .maybeSingle();
    if (error) throw new Error(`findBrief: ${error.message}`);
    return data ? toBriefRecord(data) : null;
  }

  async listBriefsForPairRound(
    pair_round_id: string,
  ): Promise<BriefRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("briefs")
      .select("*")
      .eq("pair_round_id", pair_round_id);
    if (error) throw new Error(`listBriefsForPairRound: ${error.message}`);
    return (data ?? []).map(toBriefRecord);
  }

  async createAccelerantEvent(input: {
    round_id: string;
    scope: "pair" | "all";
    pair_id: string | null;
    kind: string;
    payload?: unknown;
    triggered_by: string;
  }): Promise<{ id: string; triggered_at: string }> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("accelerant_events")
      .insert({
        round_id: input.round_id,
        scope: input.scope,
        pair_id: input.pair_id,
        kind: input.kind as never,
        payload: (input.payload ?? {}) as never,
        triggered_by: input.triggered_by,
      })
      .select("id, triggered_at")
      .single();
    if (error || !data) {
      throw new Error(`createAccelerantEvent: ${error?.message ?? "unknown"}`);
    }
    return { id: data.id, triggered_at: data.triggered_at };
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
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("accelerant_events")
      .select("id, kind, scope, pair_id, triggered_at")
      .eq("round_id", round_id);
    if (error) throw new Error(`listAccelerantEvents: ${error.message}`);
    return (data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind as string,
      scope: e.scope as "pair" | "all",
      pair_id: e.pair_id,
      triggered_at: e.triggered_at,
    }));
  }

  async setBriefsRevealed(pair_round_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pair_rounds")
      .update({ briefs_revealed: true })
      .eq("id", pair_round_id);
    if (error) throw new Error(`setBriefsRevealed: ${error.message}`);
  }

  async setTestEnabled(
    pair_round_id: string,
    enabled: boolean,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pair_rounds")
      .update({ test_enabled: enabled })
      .eq("id", pair_round_id);
    if (error) throw new Error(`setTestEnabled: ${error.message}`);
  }

  async updateGoalPattern(
    pair_round_id: string,
    pattern: unknown,
    seed: string,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pair_rounds")
      .update({ goal_pattern: pattern as never, pattern_seed: seed })
      .eq("id", pair_round_id);
    if (error) throw new Error(`updateGoalPattern: ${error.message}`);
  }

  async decrementRoundDuration(
    round_id: string,
    delta: number,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("rounds")
      .select("started_at, duration_seconds")
      .eq("id", round_id)
      .single();
    if (error || !data) {
      throw new Error(
        `decrementRoundDuration read: ${error?.message ?? "unknown"}`,
      );
    }
    const startedMs = data.started_at
      ? new Date(data.started_at).getTime()
      : Date.now();
    const elapsed = Math.floor((Date.now() - startedMs) / 1000);
    const remaining = data.duration_seconds - elapsed;
    const newRemaining = Math.max(30, remaining - delta);
    const newDuration = elapsed + newRemaining;
    const { error: updErr } = await supabase
      .from("rounds")
      .update({ duration_seconds: newDuration })
      .eq("id", round_id);
    if (updErr) {
      throw new Error(`decrementRoundDuration write: ${updErr.message}`);
    }
  }

  async setPrototypeUntil(
    pair_round_id: string,
    until: Date,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pair_rounds")
      .update({ prototype_until: until.toISOString() })
      .eq("id", pair_round_id);
    if (error) throw new Error(`setPrototypeUntil: ${error.message}`);
  }

  async captureBuilderSnapshot(
    pair_round_id: string,
    snapshot: unknown,
  ): Promise<number> {
    const supabase = getServiceClient();
    // Read current value, then update; PostgREST doesn't support
    // arithmetic in a single UPDATE without an RPC.
    const { data: cur, error: readErr } = await supabase
      .from("pair_rounds")
      .select("shares_remaining")
      .eq("id", pair_round_id)
      .single();
    if (readErr || !cur) {
      throw new Error(`captureBuilderSnapshot read: ${readErr?.message}`);
    }
    const next = Math.max(0, cur.shares_remaining - 1);
    const { error: updErr } = await supabase
      .from("pair_rounds")
      .update({
        builder_snapshot: snapshot as never,
        shares_remaining: next,
      })
      .eq("id", pair_round_id);
    if (updErr) {
      throw new Error(`captureBuilderSnapshot write: ${updErr.message}`);
    }
    return next;
  }

  async listLibraryBriefs(input: {
    role: BriefRole;
    complexity: number;
    exclude_titles?: string[];
  }): Promise<LibraryBriefRecord[]> {
    const supabase = getServiceClient();
    let query = supabase
      .from("briefs_library")
      .select("*")
      .eq("role", input.role)
      .lte("complexity_min", input.complexity)
      .gte("complexity_max", input.complexity);

    if (input.exclude_titles && input.exclude_titles.length > 0) {
      // Postgres `not.in.(a,b)` syntax via the Supabase client.
      query = query.not(
        "title",
        "in",
        `(${input.exclude_titles.map((t) => `"${t.replace(/"/g, '""')}"`).join(",")})`,
      );
    }
    const { data, error } = await query;
    if (error) throw new Error(`listLibraryBriefs: ${error.message}`);
    return (data ?? []).map(toLibraryBrief);
  }
}

function toBriefRecord(row: DbBrief): BriefRecord {
  return {
    id: row.id,
    pair_round_id: row.pair_round_id,
    role: row.role as BriefRole,
    source: row.source,
    title: row.title,
    rules: Array.isArray(row.rules) ? (row.rules as string[]) : [],
    revealed: row.revealed,
    created_at: row.created_at,
  };
}

function toLibraryBrief(row: DbLibrary): LibraryBriefRecord {
  return {
    id: row.id,
    role: row.role as BriefRole,
    complexity_min: row.complexity_min,
    complexity_max: row.complexity_max,
    title: row.title,
    rules: Array.isArray(row.rules) ? (row.rules as string[]) : [],
  };
}

function toPlacementRecord(row: DbPlacement): PlacementRecord {
  return {
    id: row.id,
    pair_round_id: row.pair_round_id,
    shape: row.shape,
    color: row.color,
    q: row.q,
    r: row.r,
    rot: row.rot,
    placed_by: row.placed_by,
    placed_at: row.placed_at,
  };
}

function toPairRecord(row: DbPair): PairRecord {
  return {
    id: row.id,
    game_id: row.game_id,
    builder_id: row.builder_id,
    guider_id: row.guider_id,
    created_at: row.created_at,
  };
}

function toRoundRecord(row: DbRound): RoundRecord {
  return {
    id: row.id,
    game_id: row.game_id,
    index: row.index,
    complexity: row.complexity,
    duration_seconds: row.duration_seconds,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
  };
}

function toPairRoundRecord(row: DbPairRound): PairRoundRecord {
  return {
    id: row.id,
    round_id: row.round_id,
    pair_id: row.pair_id,
    goal_pattern: row.goal_pattern,
    pattern_seed: row.pattern_seed,
    test_enabled: row.test_enabled,
    shares_remaining: row.shares_remaining,
    briefs_revealed: row.briefs_revealed,
    prototype_until: row.prototype_until,
    builder_snapshot: row.builder_snapshot,
  };
}
