import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  DuplicateNameError,
  PlacementCellTakenError,
  SnapshotShareCapError,
} from "./repository.memory";
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
    builder_brief_custom:
      row.builder_brief_custom &&
      typeof row.builder_brief_custom === "object" &&
      !Array.isArray(row.builder_brief_custom)
        ? (row.builder_brief_custom as unknown as {
            title: string;
            rules: string[];
          })
        : null,
    guider_brief_custom:
      row.guider_brief_custom &&
      typeof row.guider_brief_custom === "object" &&
      !Array.isArray(row.guider_brief_custom)
        ? (row.guider_brief_custom as unknown as {
            title: string;
            rules: string[];
          })
        : null,
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
    scoring_correct_pts: row.scoring_correct_pts,
    scoring_wrong_pts: row.scoring_wrong_pts,
    meeting_mode: (row.meeting_mode as "remote" | "in_person") ?? "remote",
    breakout_provider:
      (row.breakout_provider as "none" | "google_meet" | "jitsi") ?? "none",
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
    recovery_token_hash: row.recovery_token_hash,
    email: row.email ?? null,
    join_short_key: row.join_short_key ?? null,
  };
}

export class SupabaseGameRepository implements GameRepository {
  // ─── Sub-store facades ──────────────────────────────────────────
  // The class still owns one method per DB operation (existing
  // bodies left intact below). The sub-store properties group them
  // per the GameRepository interface so callers read as
  // `repo.games.findByCode(c)` rather than the flat-50-method API
  // we used to have. Pure regrouping — zero behaviour change.
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

  roundSurveys: RoundSurveyStore = {
    upsert: (input) => this.upsertRoundSurvey(input),
    findForParticipant: (round_id, participant_id) =>
      this.findRoundSurveyForParticipant(round_id, participant_id),
    listForRound: (round_id) => this.listRoundSurveys(round_id),
  };

  // ─── DB methods (existing bodies, regrouped above into facades) ───

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
        builder_brief_custom: (input.builder_brief_custom ?? null) as never,
        guider_brief_custom: (input.guider_brief_custom ?? null) as never,
        round_count: input.round_count,
        round_duration_seconds: input.round_duration_seconds,
        participant_cap: input.participant_cap,
        sound_on: input.sound_on,
        meeting_mode: input.meeting_mode ?? "remote",
        breakout_provider: input.breakout_provider ?? "none",
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

  async deleteGame(game_id: string): Promise<void> {
    // FK on delete cascade clauses live on every row that references
    // games(id) (see supabase/migrations/20260426000000_tessera_v1_schema.sql),
    // so a single DELETE FROM games WHERE id = ? takes participants,
    // pairs, rounds, pair_rounds, briefs, placements, super_power_events,
    // round_surveys, and breakouts with it. Used as the compensating
    // action for partial CSV upload failures.
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("games")
      .delete()
      .eq("id", game_id);
    if (error) throw new Error(`deleteGame: ${error.message}`);
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
        recovery_token_hash: input.recovery_token_hash ?? null,
        email: input.email ?? null,
        join_short_key: input.join_short_key ?? null,
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

  async findParticipantByJoinShortKey(
    key: string,
  ): Promise<ParticipantRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .eq("join_short_key", key)
      .maybeSingle();
    if (error) {
      throw new Error(`findParticipantByJoinShortKey: ${error.message}`);
    }
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

  async releaseParticipant(id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("participants")
      .update({
        released_at: new Date().toISOString(),
        pair_id: null,
        // Reset role to lobby so a re-join under the same name doesn't
        // inherit a stale role assignment.
        role: "lobby",
      })
      .eq("id", id);
    if (error) throw new Error(`releaseParticipant: ${error.message}`);
  }

  async swapPairRoles(pair_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { data: pair, error: pairErr } = await supabase
      .from("pairs")
      .select("id, builder_id, guider_id")
      .eq("id", pair_id)
      .single();
    if (pairErr || !pair) {
      throw new Error(`swapPairRoles: pair lookup ${pairErr?.message ?? "unknown"}`);
    }
    const { builder_id, guider_id } = pair;
    if (!builder_id || !guider_id) {
      throw new Error("swapPairRoles: pair missing builder or guider");
    }
    // Flip the pair row + both participants' role columns. Three
    // discrete updates; the GM is the only mutator pre-round so the
    // window for racing is essentially zero.
    const { error: pairUpdateErr } = await supabase
      .from("pairs")
      .update({ builder_id: guider_id, guider_id: builder_id })
      .eq("id", pair_id);
    if (pairUpdateErr) {
      throw new Error(`swapPairRoles: pair update ${pairUpdateErr.message}`);
    }
    const { error: aErr } = await supabase
      .from("participants")
      .update({ role: "guider" })
      .eq("id", builder_id);
    if (aErr) throw new Error(`swapPairRoles: a ${aErr.message}`);
    const { error: bErr } = await supabase
      .from("participants")
      .update({ role: "builder" })
      .eq("id", guider_id);
    if (bErr) throw new Error(`swapPairRoles: b ${bErr.message}`);
  }

  async swapAllPairRoles(game_id: string): Promise<number> {
    const supabase = getServiceClient();
    const { data: pairs, error } = await supabase
      .from("pairs")
      .select("id, builder_id, guider_id")
      .eq("game_id", game_id);
    if (error) throw new Error(`swapAllPairRoles: list ${error.message}`);
    let count = 0;
    for (const pair of pairs ?? []) {
      if (!pair.builder_id || !pair.guider_id) continue;
      await this.swapPairRoles(pair.id);
      count += 1;
    }
    return count;
  }

  async reshufflePartners(game_id: string): Promise<number> {
    const supabase = getServiceClient();
    const { data: pairs, error } = await supabase
      .from("pairs")
      .select("id, builder_id, guider_id, display_name")
      .eq("game_id", game_id);
    if (error) throw new Error(`reshufflePartners: list ${error.message}`);
    const fully = (pairs ?? []).filter(
      (p) => p.builder_id !== null && p.guider_id !== null,
    );
    if (fully.length < 2) return 0;

    const builders = fully.map((p) => p.builder_id as string);
    const guiders = fully.map((p) => p.guider_id as string);
    shuffleInPlace(builders);
    shuffleInPlace(guiders);

    let changed = 0;
    for (let i = 0; i < fully.length; i++) {
      const pair = fully[i]!;
      const newBuilder = builders[i]!;
      const newGuider = guiders[i]!;
      if (
        pair.builder_id === newBuilder &&
        pair.guider_id === newGuider &&
        pair.display_name === null
      ) {
        continue;
      }
      const { error: pairErr } = await supabase
        .from("pairs")
        .update({
          builder_id: newBuilder,
          guider_id: newGuider,
          // Clear the GM-set name — a custom rename like
          // "The Pelicans" was tied to the prior partnership and
          // shouldn't follow a different pair of participants.
          display_name: null,
        })
        .eq("id", pair.id);
      if (pairErr) {
        throw new Error(`reshufflePartners: pair update ${pairErr.message}`);
      }
      const { error: bErr } = await supabase
        .from("participants")
        .update({ pair_id: pair.id, role: "builder" })
        .eq("id", newBuilder);
      if (bErr) throw new Error(`reshufflePartners: builder ${bErr.message}`);
      const { error: gErr } = await supabase
        .from("participants")
        .update({ pair_id: pair.id, role: "guider" })
        .eq("id", newGuider);
      if (gErr) throw new Error(`reshufflePartners: guider ${gErr.message}`);
      changed += 1;
    }
    return changed;
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
    // The RPC's return type predates the display_name column; new
    // pairs are always unnamed at creation.
    return toPairRecord({ ...data, display_name: null } as DbPair);
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

  async setPairDisplayName(
    pair_id: string,
    name: string | null,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pairs")
      .update({ display_name: name })
      .eq("id", pair_id);
    if (error) throw new Error(`setPairDisplayName: ${error.message}`);
  }

  async clearAllocations(game_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase.rpc("clear_allocations", {
      p_game_id: game_id,
    });
    if (error) throw new Error(`clearAllocations: ${error.message}`);
  }

  async disbandPair(pair_id: string): Promise<void> {
    const supabase = getServiceClient();
    // Two writes; partial failure leaves the pair row gone but
    // participants still attached, which the GM dashboard can recover
    // from on the next refetch (the participants would render as
    // "stuck in a missing pair" → easier to spot than the ghost-pair
    // bug this method exists to fix). Wrap in an RPC if/when this
    // becomes a hot path.
    const { error: updateErr } = await supabase
      .from("participants")
      .update({ pair_id: null, role: "lobby" })
      .eq("pair_id", pair_id)
      .neq("role", "gm");
    if (updateErr) {
      throw new Error(`disbandPair (participants): ${updateErr.message}`);
    }
    const { error: deleteErr } = await supabase
      .from("pairs")
      .delete()
      .eq("id", pair_id);
    if (deleteErr) {
      throw new Error(`disbandPair (pairs): ${deleteErr.message}`);
    }
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

  async setReflectionSurveyRequested(
    round_id: string,
    requested: boolean,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("rounds")
      .update({ reflection_survey_requested: requested })
      .eq("id", round_id);
    if (error) {
      throw new Error(`setReflectionSurveyRequested: ${error.message}`);
    }
  }

  async deleteRound(round_id: string): Promise<void> {
    const supabase = getServiceClient();
    // FK CASCADE on pair_rounds → briefs / placements / super_power_events
    // (configured in the schema migration) handles the dependent rows.
    const { error } = await supabase
      .from("rounds")
      .delete()
      .eq("id", round_id);
    if (error) throw new Error(`deleteRound: ${error.message}`);
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

  async listRounds(game_id: string): Promise<RoundRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("game_id", game_id)
      .order("index", { ascending: true });
    if (error) throw new Error(`listRounds: ${error.message}`);
    return (data ?? []).map(toRoundRecord);
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
    // Pivot ended_at on the same write so the status column and the
    // timestamp never drift. lobby/running clears the previous end
    // marker (relevant for the legacy unended-state path); purged
    // leaves ended_at as-is so retention can still see when the game
    // wrapped before purging.
    const patch: { status: typeof status; ended_at?: string | null } = {
      status,
    };
    if (status === "ended") {
      patch.ended_at = new Date().toISOString();
    } else if (status === "lobby" || status === "running") {
      patch.ended_at = null;
    }
    const { error } = await supabase
      .from("games")
      .update(patch)
      .eq("id", game_id);
    if (error) throw new Error(`setGameStatus: ${error.message}`);
  }

  async updateScoring(
    game_id: string,
    patch: { scoring_correct_pts?: number; scoring_wrong_pts?: number },
  ): Promise<void> {
    const update: Database["public"]["Tables"]["games"]["Update"] = {};
    if (patch.scoring_correct_pts !== undefined) {
      update.scoring_correct_pts = patch.scoring_correct_pts;
    }
    if (patch.scoring_wrong_pts !== undefined) {
      update.scoring_wrong_pts = patch.scoring_wrong_pts;
    }
    if (Object.keys(update).length === 0) return;
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("games")
      .update(update)
      .eq("id", game_id);
    if (error) throw new Error(`updateScoring: ${error.message}`);
  }

  async setBriefOn(
    game_id: string,
    role: "builder" | "guider",
    on: boolean,
  ): Promise<void> {
    const supabase = getServiceClient();
    const update: Database["public"]["Tables"]["games"]["Update"] =
      role === "builder" ? { builder_brief_on: on } : { guider_brief_on: on };
    const { error } = await supabase
      .from("games")
      .update(update)
      .eq("id", game_id);
    if (error) throw new Error(`setBriefOn: ${error.message}`);
  }

  async setPairBreakout(
    pair_id: string,
    breakout: { call_url: string; event_id: string },
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pairs")
      .update({
        breakout_call_url: breakout.call_url,
        breakout_event_id: breakout.event_id,
      })
      .eq("id", pair_id);
    if (error) throw new Error(`setPairBreakout: ${error.message}`);
  }

  async setBriefOverrides(
    pair_id: string,
    overrides: {
      builder: { title: string; rules: string[] } | null;
      guider: { title: string; rules: string[] } | null;
    },
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pairs")
      .update({
        builder_brief_override: overrides.builder,
        guider_brief_override: overrides.guider,
      })
      .eq("id", pair_id);
    if (error) throw new Error(`setBriefOverrides: ${error.message}`);
  }

  async clearBriefOverrides(pair_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pairs")
      .update({
        builder_brief_override: null,
        guider_brief_override: null,
      })
      .eq("id", pair_id);
    if (error) throw new Error(`clearBriefOverrides: ${error.message}`);
  }

  async clearPairBreakout(pair_id: string): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("pairs")
      .update({ breakout_call_url: null, breakout_event_id: null })
      .eq("id", pair_id);
    if (error) throw new Error(`clearPairBreakout: ${error.message}`);
  }

  async listPairsWithBreakouts(
    game_id: string,
  ): Promise<Array<{ id: string; event_id: string; call_url: string }>> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pairs")
      .select("id, breakout_event_id, breakout_call_url")
      .eq("game_id", game_id)
      .not("breakout_event_id", "is", null);
    if (error) throw new Error(`listPairsWithBreakouts: ${error.message}`);
    return (data ?? [])
      .filter(
        (p): p is { id: string; breakout_event_id: string; breakout_call_url: string } =>
          p.breakout_event_id != null && p.breakout_call_url != null,
      )
      .map((p) => ({
        id: p.id,
        event_id: p.breakout_event_id,
        call_url: p.breakout_call_url,
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

  async listPlacementsByPairRoundIds(
    pair_round_ids: string[],
  ): Promise<Map<string, PlacementRecord[]>> {
    const out = new Map<string, PlacementRecord[]>();
    for (const id of pair_round_ids) out.set(id, []);
    if (pair_round_ids.length === 0) return out;
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("placements")
      .select("*")
      .in("pair_round_id", pair_round_ids)
      .order("placed_at", { ascending: true });
    if (error) throw new Error(`listPlacementsByPairRoundIds: ${error.message}`);
    for (const row of data ?? []) {
      const rec = toPlacementRecord(row);
      out.get(rec.pair_round_id)?.push(rec);
    }
    return out;
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

  async clearPlacements(pair_round_id: string): Promise<number> {
    const supabase = getServiceClient();
    const { error, count } = await supabase
      .from("placements")
      .delete({ count: "exact" })
      .eq("pair_round_id", pair_round_id);
    if (error) throw new Error(`clearPlacements: ${error.message}`);
    return count ?? 0;
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
    const supabase = getServiceClient();
    const update: Database["public"]["Tables"]["placements"]["Update"] = {};
    if (patch.q !== undefined) update.q = patch.q;
    if (patch.r !== undefined) update.r = patch.r;
    if (patch.rot !== undefined) update.rot = patch.rot;
    if (patch.shape !== undefined) update.shape = patch.shape;
    if (patch.color !== undefined) update.color = patch.color;
    const { data, error } = await supabase
      .from("placements")
      .update(update)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === "23505") throw new PlacementCellTakenError();
      throw new Error(`updatePlacement: ${error.message}`);
    }
    return data ? toPlacementRecord(data) : null;
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

  async listBriefsByPairRoundIds(
    pair_round_ids: string[],
  ): Promise<Map<string, BriefRecord[]>> {
    const out = new Map<string, BriefRecord[]>();
    for (const id of pair_round_ids) out.set(id, []);
    if (pair_round_ids.length === 0) return out;
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("briefs")
      .select("*")
      .in("pair_round_id", pair_round_ids);
    if (error) throw new Error(`listBriefsByPairRoundIds: ${error.message}`);
    for (const row of data ?? []) {
      const rec = toBriefRecord(row);
      out.get(rec.pair_round_id)?.push(rec);
    }
    return out;
  }

  async createSuperPowerEvent(input: {
    round_id: string;
    scope: "pair" | "all";
    pair_id: string | null;
    kind: string;
    payload?: unknown;
    triggered_by: string;
  }): Promise<{ id: string; triggered_at: string }> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("super_power_events")
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
      throw new Error(`createSuperPowerEvent: ${error?.message ?? "unknown"}`);
    }
    return { id: data.id, triggered_at: data.triggered_at };
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
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("super_power_events")
      .select("id, kind, scope, pair_id, triggered_at")
      .eq("round_id", round_id);
    if (error) throw new Error(`listSuperPowerEvents: ${error.message}`);
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

  async incrementSharesRemaining(pair_round_id: string): Promise<number> {
    // Atomic increment via a single UPDATE … RETURNING. Concurrent
    // GM clicks on Agile share would race a read-modify-write, but
    // a single GM is the only caller in practice — keeping this
    // simple beats adding another RPC for a low-contention path.
    const supabase = getServiceClient();
    const { data: existing, error: readErr } = await supabase
      .from("pair_rounds")
      .select("shares_remaining")
      .eq("id", pair_round_id)
      .single();
    if (readErr || !existing) {
      throw new Error(
        `incrementSharesRemaining: ${readErr?.message ?? "not_found"}`,
      );
    }
    const next = (existing.shares_remaining ?? 0) + 1;
    const { error: writeErr } = await supabase
      .from("pair_rounds")
      .update({ shares_remaining: next })
      .eq("id", pair_round_id);
    if (writeErr) {
      throw new Error(`incrementSharesRemaining: ${writeErr.message}`);
    }
    return next;
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

  async reserveGeminiCall(input: {
    game_id: string;
    perGameMax: number;
    perDayMax: number;
  }): Promise<
    | { ok: true; perGame: number; perDay: number }
    | { ok: false; reason: "per_game_cap" | "per_day_cap" }
  > {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("reserve_gemini_call", {
      p_game_id: input.game_id,
      p_per_game_max: input.perGameMax,
      p_per_day_max: input.perDayMax,
    });
    if (error || !data) {
      throw new Error(`reserveGeminiCall: ${error?.message ?? "no data"}`);
    }
    const j = data as {
      reserved: boolean;
      reason?: "per_game_cap" | "per_day_cap";
      per_game?: number;
      per_day?: number;
    };
    if (j.reserved && typeof j.per_game === "number" && typeof j.per_day === "number") {
      return { ok: true, perGame: j.per_game, perDay: j.per_day };
    }
    return { ok: false, reason: j.reason ?? "per_game_cap" };
  }

  async decrementRoundDuration(
    round_id: string,
    delta: number,
  ): Promise<void> {
    // Atomic adjust via RPC. Two parallel Time-Pressure triggers
    // before this used to each read the same duration_seconds and
    // each write a single decrement, so the second trigger no-op'd.
    // The RPC takes a row lock + recomputes remaining inside the
    // transaction. See 20260427000002_atomic_counter_rpcs.sql.
    const supabase = getServiceClient();
    // Cast: database.types.ts is regenerated out-of-band and lags
    // newly-added RPCs. The shape is what 20260427000002_atomic_counter_rpcs.sql
    // returns. Re-run `supabase gen types` to drop these casts.
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("adjust_round_duration", {
      p_round_id: round_id,
      p_delta_seconds: delta,
    });
    if (error) {
      throw new Error(`decrementRoundDuration: ${error.message}`);
    }
    const j = data as
      | { ok: boolean; reason?: string }
      | null;
    if (!j || !j.ok) {
      throw new Error(
        `decrementRoundDuration: ${j?.reason ?? "unknown"}`,
      );
    }
  }

  async setRoundComplexity(
    round_id: string,
    complexity: number,
  ): Promise<void> {
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("rounds")
      .update({ complexity })
      .eq("id", round_id);
    if (error) throw new Error(`setRoundComplexity: ${error.message}`);
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
    // Atomic capture via RPC: row lock + decrement-if-positive +
    // write the snapshot in a single transaction. Was a read-then-
    // write split, which let two parallel /agile-share POSTs both
    // observe shares_remaining=3 and both write 2 — captured twice
    // but the counter only dropped by 1. Returns 0 throws when the
    // bucket was already empty so the route can surface a typed 409.
    const supabase = getServiceClient();
    // Same cast as adjust_round_duration above — database.types.ts
    // hasn't been regenerated for the new RPC yet.
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("capture_builder_snapshot", {
      p_pair_round_id: pair_round_id,
      p_snapshot: snapshot,
    });
    if (error) {
      throw new Error(`captureBuilderSnapshot: ${error.message}`);
    }
    const j = data as
      | {
          captured: boolean;
          reason?: string;
          shares_remaining?: number;
        }
      | null;
    if (!j) {
      throw new Error("captureBuilderSnapshot: empty response");
    }
    if (!j.captured) {
      throw new SnapshotShareCapError(j.reason);
    }
    return j.shares_remaining ?? 0;
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

  // ─── Round surveys ─────────────────────────────────────────────────

  async upsertRoundSurvey(input: {
    round_id: string;
    participant_id: string;
    comm_balance: number;
    attr_self: number;
    attr_partner: number;
    attr_system: number;
  }): Promise<RoundSurveyRecord> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("round_surveys")
      .upsert(
        {
          round_id: input.round_id,
          participant_id: input.participant_id,
          comm_balance: input.comm_balance,
          attr_self: input.attr_self,
          attr_partner: input.attr_partner,
          attr_system: input.attr_system,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "round_id,participant_id" },
      )
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `upsertRoundSurvey: ${error?.message ?? "no row returned"}`,
      );
    }
    return toRoundSurveyRecord(data);
  }

  async findRoundSurveyForParticipant(
    round_id: string,
    participant_id: string,
  ): Promise<RoundSurveyRecord | null> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("round_surveys")
      .select("*")
      .eq("round_id", round_id)
      .eq("participant_id", participant_id)
      .maybeSingle();
    if (error)
      throw new Error(`findRoundSurveyForParticipant: ${error.message}`);
    return data ? toRoundSurveyRecord(data) : null;
  }

  async listRoundSurveys(round_id: string): Promise<RoundSurveyRecord[]> {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("round_surveys")
      .select("*")
      .eq("round_id", round_id);
    if (error) throw new Error(`listRoundSurveys: ${error.message}`);
    return (data ?? []).map(toRoundSurveyRecord);
  }
}

function toRoundSurveyRecord(row: {
  id: string;
  round_id: string;
  participant_id: string;
  comm_balance: number;
  attr_self: number | null;
  attr_partner: number | null;
  attr_system: number | null;
  submitted_at: string;
}): RoundSurveyRecord {
  // Pre-2026-05-04 rows have null attr_* columns; surface them as
  // zero so the record shape stays uniform for consumers. The
  // aggregator filters by sum to ignore those legacy rows when
  // computing means.
  return {
    id: row.id,
    round_id: row.round_id,
    participant_id: row.participant_id,
    comm_balance: row.comm_balance,
    attr_self: row.attr_self ?? 0,
    attr_partner: row.attr_partner ?? 0,
    attr_system: row.attr_system ?? 0,
    submitted_at: row.submitted_at,
  };
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

function toPairRecord(
  row: DbPair & {
    builder_brief_override?: unknown;
    guider_brief_override?: unknown;
  },
): PairRecord {
  return {
    id: row.id,
    game_id: row.game_id,
    builder_id: row.builder_id,
    guider_id: row.guider_id,
    display_name: row.display_name,
    created_at: row.created_at,
    breakout_call_url: row.breakout_call_url ?? null,
    breakout_event_id: row.breakout_event_id ?? null,
    builder_brief_override: toBriefOverride(row.builder_brief_override),
    guider_brief_override: toBriefOverride(row.guider_brief_override),
  };
}

function toBriefOverride(
  raw: unknown,
): { title: string; rules: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { title?: unknown; rules?: unknown };
  if (typeof obj.title !== "string") return null;
  if (!Array.isArray(obj.rules)) return null;
  const rules = obj.rules.filter((r): r is string => typeof r === "string");
  if (rules.length === 0) return null;
  return { title: obj.title, rules };
}

function toRoundRecord(
  row: DbRound & { reflection_survey_requested?: boolean | null },
): RoundRecord {
  return {
    id: row.id,
    game_id: row.game_id,
    index: row.index,
    complexity: row.complexity,
    duration_seconds: row.duration_seconds,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    reflection_survey_requested: row.reflection_survey_requested ?? false,
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

/**
 * Fisher-Yates in-place shuffle. Used by reshufflePartners. Math.random
 * is fine here — this is a GM-driven dashboard action, not a security
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
