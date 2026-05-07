/**
 * Repository — abstract storage layer for games + participants. The
 * milestone-1 in-memory implementation lives in `./repository.memory.ts`;
 * the Supabase-backed implementation is `./repository.supabase.ts`.
 */

export type TeamMode = "gm_picks" | "players_pick";
// Brief source as persisted to the DB. "gemini" is the umbrella
// label for any AI-generated brief; the runtime router (lib/briefs/
// router.ts) may try Gemini OR OpenAI under that label. We don't
// store the actual provider on the row — telemetry lives in the
// orchestrator's console.info call. If we ever need per-provider
// analytics we can add a brief.provider column without touching
// the storage enum.
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
  /**
   * Optional. When omitted, the player views and lobby skip the
   * "Join the video call" CTA — facilitators who coordinate the
   * call link out-of-band (Slack DM, calendar invite, already on the
   * call) shouldn't be forced to paste a URL into the host form.
   */
  video_call_url?: string | null;
  whiteboard_url?: string | null;
  /**
   * "remote" → players join via video; the GM may also enable
   * automated per-pair breakouts. "in_person" → everyone is in the
   * same room; video-call URL + whiteboard URL + breakouts are
   * skipped entirely.
   */
  meeting_mode?: "remote" | "in_person";
  /**
   * When the workshop is remote, the GM can opt into per-pair
   * breakouts. Two providers ship:
   *   - "google_meet": mints a Calendar event per pair via OAuth +
   *     Calendar API. Adds participant emails as event attendees so
   *     they bypass Meet's knock screen.
   *   - "jitsi": constructs a deterministic meet.jit.si URL per pair.
   *     No OAuth, no API call, no calendar pollution.
   *   - "none": no breakouts (default).
   */
  breakout_provider?: "none" | "google_meet" | "jitsi";
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
  recovery_token_hash: string | null;
  /**
   * Optional. Required at join time only when the game's
   * breakout_provider is 'google_meet' (so we can attach the player
   * as a calendar event attendee, which lets them bypass Meet's
   * knock screen if they sign in with Google). Never required for
   * in-person games or jitsi-mode games.
   */
  email: string | null;
}

export interface CreateParticipantInput {
  id?: string;
  game_id: string;
  display_name: string;
  role: ParticipantRole;
  color: string;
  recovery_token_hash?: string | null;
  /** Required when the game's breakout_provider is 'google_meet'. */
  email?: string | null;
}

export interface PairRecord {
  id: string;
  game_id: string;
  builder_id: string | null;
  guider_id: string | null;
  display_name: string | null;
  created_at: string;
  /**
   * Per-pair Google Meet URL minted via Calendar API when the GM
   * enables breakouts and clicks Generate. Null until generated;
   * cleared by the breakouts/clear route or when the game ends.
   */
  breakout_call_url: string | null;
  /**
   * Calendar event ID we created for this pair — kept so we can
   * issue a DELETE on game-end. Always paired with breakout_call_url.
   */
  breakout_event_id: string | null;
  /**
   * Pre-game brief overrides — populated when the GM seeds specific
   * briefs (typically via the CSV upload flow). The roundStart
   * orchestrator consumes these on round 1 and clears them so round
   * 2+ revert to the game-level brief source. Null when no override
   * was set or once it's been consumed.
   */
  builder_brief_override: { title: string; rules: string[] } | null;
  guider_brief_override: { title: string; rules: string[] } | null;
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
  /**
   * GM opt-in: when true, the player-side RoundSurvey card mounts at
   * round-end. Set by `setReflectionSurveyRequested` from the
   * `/api/games/[code]/rounds/end` route when the GM picks "Yes" in
   * the EndRoundModal. Default false so the survey never fires
   * unprompted.
   */
  reflection_survey_requested: boolean;
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

// ───────────────────────────────────────────────────────────────────
// Sub-store interfaces. The repository was a flat 50-method interface
// that grew organically; splitting into per-domain stores makes the
// surface easier to reason about (each store owns one table or a
// small group of related tables) and keeps two backends — memory +
// supabase — straightforward to keep in sync.
// ───────────────────────────────────────────────────────────────────

export interface GameStore {
  create(
    input: CreateGameInput & {
      code: string;
      host_token_hash: string;
      gm_participant_id: string;
    },
  ): Promise<GameRecord>;

  findByCode(code: string): Promise<GameRecord | null>;

  /**
   * Hard-delete a game by id. Cascades through participants, pairs,
   * rounds, pair_rounds, briefs, placements, super_power_events, and
   * round_surveys via the FK `on delete cascade` clauses (see
   * supabase/migrations/20260426000000_tessera_v1_schema.sql).
   *
   * Used as the compensating action when the CSV upload route fails
   * partway through fan-out — without it, the route's TDD-claimed
   * "transaction-equivalent flow" left orphan games + partial
   * rosters in the DB on any post-create failure.
   *
   * No-op when the id doesn't match a game; returns nothing either way
   * so callers can use it in catch handlers without branching on the
   * "row already gone" case.
   */
  delete(game_id: string): Promise<void>;

  /** Update the game status (lobby → running → ended → purged). */
  setStatus(
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

  /**
   * Flip a brief-on flag for a side after game-create. The "Change
   * builder/guider brief" super-powers double as "Add brief" when the
   * GM created the game with that side off — flipping the flag here
   * makes the new brief show up via the normal envelope flow on the
   * current round AND keeps it on for subsequent rounds.
   */
  setBriefOn(
    game_id: string,
    role: "builder" | "guider",
    on: boolean,
  ): Promise<void>;

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
}

export interface ParticipantStore {
  /**
   * Insert a new participant. Throws when the display name is already
   * taken by an active participant in the same game (unique constraint).
   */
  create(input: CreateParticipantInput): Promise<ParticipantRecord>;

  /** List all active participants for a game, ordered by joined_at asc. */
  listActive(game_id: string): Promise<ParticipantRecord[]>;

  /**
   * Find a participant by display name (case-insensitive) within a game.
   * Active participants only (released_at is null).
   */
  findByName(
    game_id: string,
    display_name: string,
  ): Promise<ParticipantRecord | null>;

  /** Find a participant by id (for cookie-based reconnect). */
  findById(id: string): Promise<ParticipantRecord | null>;

  /** Touch last_seen_at on a participant. */
  touch(id: string): Promise<void>;

  /**
   * Mark a participant as released — sets released_at = now() and
   * clears their pair_id. Frees their display name for re-use within
   * the game. Used by the GM-side "Release seat" affordance for stuck
   * players whose cookie is gone and who don't have their recovery URL.
   */
  release(id: string): Promise<void>;
}

export interface PairStore {
  /**
   * Create a pair with a builder + guider, and atomically update both
   * participants' role + pair_id.
   */
  create(
    game_id: string,
    builder_id: string,
    guider_id: string,
  ): Promise<PairRecord>;

  /** List pairs for a game, ordered by created_at asc. */
  list(game_id: string): Promise<PairRecord[]>;

  /** Find a pair by id (used for play-state lookups). */
  findById(pair_id: string): Promise<PairRecord | null>;

  /**
   * Swap a pair's builder ↔ guider. Flips the pair row's
   * builder_id / guider_id and the two participants' role columns.
   * Pre-round operation — the route handler refuses when the latest
   * round is `running`.
   */
  swapRoles(pair_id: string): Promise<void>;

  /**
   * Swap builder ↔ guider for every pair in the game. Same gating as
   * swapRoles (pre-round only); the route handler enforces the
   * round-not-running invariant. Returns the number of pairs swapped.
   */
  swapAllRoles(game_id: string): Promise<number>;

  /**
   * Add a participant to an existing pair as an observer. Updates the
   * participant's role + pair_id; does not modify the pair row.
   */
  assignObserver(participant_id: string, pair_id: string): Promise<void>;

  /**
   * Set or clear a pair's self-chosen display name. Empty string
   * clears the name (UI falls back to "Builder ↔ Guider").
   */
  setDisplayName(pair_id: string, name: string | null): Promise<void>;

  /**
   * Reset every participant in a game back to the lobby and delete all
   * existing pairs. Used as the precondition for auto-allocate.
   */
  clearAllocations(game_id: string): Promise<void>;

  /**
   * Disband a single pair: delete the pair row and move every
   * participant whose `pair_id` referenced it back to the lobby
   * (`pair_id = null`, `role = "lobby"`). Used when a builder/guider
   * is released mid-game — without this, the partner stays attached
   * to a half-pair pointing at a released participant. Observers on
   * the same pair return to the lobby with the rest.
   */
  disband(pair_id: string): Promise<void>;

  /**
   * Persist per-pair brief overrides set at game-create time
   * (typically via the CSV upload flow). Either side may be null
   * to leave that role to the round-start library/AI flow. The
   * roundStart orchestrator reads these on round 1 and calls
   * `clearBriefOverrides` after committing so round 2+ run the
   * normal pickBrief path — the override is a one-shot seed, not
   * a permanent pin.
   */
  setBriefOverrides(
    pair_id: string,
    overrides: {
      builder: { title: string; rules: string[] } | null;
      guider: { title: string; rules: string[] } | null;
    },
  ): Promise<void>;

  /**
   * Null both override columns. Called by `roundStart` after a
   * round-1 commit consumed the values. Idempotent.
   */
  clearBriefOverrides(pair_id: string): Promise<void>;

  /**
   * Persist the per-pair breakout link + originating calendar event.
   * Called by /breakouts/generate after a successful Calendar API
   * mint. Both fields move together so end-game cleanup never lacks
   * an event ID.
   */
  setBreakout(
    pair_id: string,
    breakout: { call_url: string; event_id: string },
  ): Promise<void>;

  /** Clear breakout state on a single pair (used after deletion). */
  clearBreakout(pair_id: string): Promise<void>;

  /**
   * List all pairs in a game with breakout state set — drives the
   * end-game cleanup loop and the GM dashboard's "N of M ready" copy.
   */
  listWithBreakouts(game_id: string): Promise<
    Array<{ id: string; event_id: string; call_url: string }>
  >;
}

export interface RoundStore {
  /** Insert a fresh round. */
  create(input: {
    game_id: string;
    index: number;
    complexity: number;
    duration_seconds: number;
  }): Promise<RoundRecord>;

  /** Mark a round running. Sets started_at = now() and status = 'running'. */
  start(round_id: string): Promise<void>;

  /**
   * Mark a round ended. Sets status='ended' + ended_at = now().
   * Idempotent — calling on an already-ended round is a no-op.
   */
  end(round_id: string): Promise<void>;

  /**
   * Flip `rounds.reflection_survey_requested` so the player-side
   * RoundSurvey card knows whether to mount. Called by the
   * `/rounds/end` route before `end()` when the GM ticked the
   * "ask players a quick reflection" option in the EndRoundModal.
   * Idempotent — re-calls just rewrite the same boolean.
   */
  setReflectionSurveyRequested(
    round_id: string,
    requested: boolean,
  ): Promise<void>;

  /**
   * Delete a round (and via cascade, its pair_rounds and briefs).
   * Used to clean up half-started rounds left behind by a failed
   * /rounds/start so the GM can retry.
   */
  delete(round_id: string): Promise<void>;

  /** Find the most recent (highest index) round for a game. */
  findLatest(game_id: string): Promise<RoundRecord | null>;

  /**
   * List all rounds for a game in ascending index order. Used for the
   * game-end leaderboard.
   */
  list(game_id: string): Promise<RoundRecord[]>;

  /** Subtract `delta` seconds from a round's duration (Time pressure). */
  decrementDuration(round_id: string, delta: number): Promise<void>;

  /**
   * Persist a new complexity on a running round. Used by the
   * harder / easier super-powers when they regenerate the goal at a
   * different complexity — the persisted value drives the builder's
   * tray palette + the requirement-change mutation palette, so it
   * has to track the goal's actual generation level.
   */
  setComplexity(round_id: string, complexity: number): Promise<void>;
}

export interface PairRoundStore {
  /** Insert a pair_round row with a pre-generated goal pattern. */
  create(input: {
    round_id: string;
    pair_id: string;
    goal_pattern: unknown;
    pattern_seed: string;
  }): Promise<PairRoundRecord>;

  listForRound(round_id: string): Promise<PairRoundRecord[]>;

  /**
   * Find the pair_round row for a given (round, pair). Used by player
   * views to fetch their goal pattern.
   */
  find(round_id: string, pair_id: string): Promise<PairRoundRecord | null>;

  setBriefsRevealed(pair_round_id: string): Promise<void>;

  /**
   * Grant the builder one more agile-share unlock. Atomic increment
   * so two back-to-back trigger requests don't race.
   */
  incrementSharesRemaining(pair_round_id: string): Promise<number>;

  setTestEnabled(pair_round_id: string, enabled: boolean): Promise<void>;

  updateGoalPattern(
    pair_round_id: string,
    pattern: unknown,
    seed: string,
  ): Promise<void>;

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

export interface PlacementStore {
  /**
   * Place a tile on the canvas. Throws PlacementCellTakenError when
   * the (pair_round, q, r) cell is already occupied.
   */
  create(input: {
    pair_round_id: string;
    shape: string;
    color: string;
    q: number;
    r: number;
    rot: number;
    placed_by: string;
  }): Promise<PlacementRecord>;

  /** Returns placements ordered by placed_at ascending. */
  list(pair_round_id: string): Promise<PlacementRecord[]>;

  /**
   * Bulk variant of `list` keyed by pair_round_id. Used by the GM
   * dashboard's lobby snapshot, which would otherwise issue one
   * `list` per pair (~25 round-trips at workshop scale, every refetch).
   * Map values keep the placed_at-ascending order; missing keys mean
   * no placements rather than an absent pair_round.
   */
  listByPairRoundIds(
    pair_round_ids: string[],
  ): Promise<Map<string, PlacementRecord[]>>;

  /** Read a single placement (for ownership check before delete). */
  find(id: string): Promise<PlacementRecord | null>;

  /** Delete a placement by id. Returns true on delete, false if not found. */
  delete(id: string): Promise<boolean>;

  /**
   * Delete every placement in a pair_round. Returns count deleted.
   * Used by the builder's "Clear all" action.
   */
  clear(pair_round_id: string): Promise<number>;

  /**
   * Update a placement's cell (q, r), rotation, shape, and/or color.
   * Throws PlacementCellTakenError when a new (q, r) collides with
   * another placement in the same pair_round.
   */
  update(
    id: string,
    patch: {
      q?: number;
      r?: number;
      rot?: number;
      shape?: string;
      color?: string;
    },
  ): Promise<PlacementRecord | null>;
}

export interface BriefStore {
  /**
   * Insert (or replace) a brief for a (pair_round, role). Used both at
   * round start and for re-rolls.
   */
  upsert(input: {
    pair_round_id: string;
    role: BriefRole;
    source: BriefSource;
    title: string;
    rules: string[];
  }): Promise<BriefRecord>;

  /** Read a single brief for a pair_round + role. */
  find(
    pair_round_id: string,
    role: BriefRole,
  ): Promise<BriefRecord | null>;

  /** Read both briefs for a pair_round (used by the GM dashboard). */
  listForPairRound(pair_round_id: string): Promise<BriefRecord[]>;

  /**
   * Bulk variant of `listForPairRound`. Same motivation as
   * `placements.listByPairRoundIds`: the GM dashboard fans across
   * every pair on every refetch, and a per-pair query is the wrong
   * shape under realtime traffic. Map values are unordered; each key
   * holds at most two rows (builder + guider).
   */
  listByPairRoundIds(
    pair_round_ids: string[],
  ): Promise<Map<string, BriefRecord[]>>;

  /**
   * Read library briefs matching a role + complexity, optionally
   * excluding titles (for re-roll dedupe).
   */
  listLibrary(input: {
    role: BriefRole;
    complexity: number;
    exclude_titles?: string[];
  }): Promise<LibraryBriefRecord[]>;
}

export interface SuperPowerStore {
  // Persisted in the `super_power_events` table (renamed from
  // `accelerant_events` in migration 21).
  createEvent(input: {
    round_id: string;
    scope: "pair" | "all";
    pair_id: string | null;
    kind: string;
    payload?: unknown;
    triggered_by: string;
  }): Promise<{ id: string; triggered_at: string }>;

  listEvents(round_id: string): Promise<
    Array<{
      id: string;
      kind: string;
      scope: "pair" | "all";
      pair_id: string | null;
      triggered_at: string;
    }>
  >;
}

export interface RoundSurveyRecord {
  id: string;
  round_id: string;
  participant_id: string;
  /**
   * 0..100 slider — who carried the communication. 0 = "I did
   * most", 100 = "my partner did most", 50 = even.
   */
  comm_balance: number;
  /**
   * Forced-choice friction attribution: how the round's friction
   * split across self / partner / system. Each axis is 0..100 and
   * the three sum to exactly 100. The 2026-05-04 design pass
   * replaced the v1 4-way `what_made_harder` enum with this; the
   * magnitude lets the aggregator surface asymmetry between
   * builders and guiders, which is the actual debrief insight.
   */
  attr_self: number;
  attr_partner: number;
  attr_system: number;
  submitted_at: string;
}

export interface RoundSurveyStore {
  /**
   * Insert or update one participant's survey response for a round.
   * Idempotent — same (round_id, participant_id) updates instead of
   * duplicating, so a player who answers, navigates away, and re-
   * answers from a fresh tab doesn't get blocked.
   */
  upsert(input: {
    round_id: string;
    participant_id: string;
    comm_balance: number;
    attr_self: number;
    attr_partner: number;
    attr_system: number;
  }): Promise<RoundSurveyRecord>;

  /** Find this participant's existing response for a round, or null. */
  findForParticipant(
    round_id: string,
    participant_id: string,
  ): Promise<RoundSurveyRecord | null>;

  /** All responses for a round — used by GM debrief aggregation. */
  listForRound(round_id: string): Promise<RoundSurveyRecord[]>;
}

export interface GameRepository {
  games: GameStore;
  participants: ParticipantStore;
  pairs: PairStore;
  rounds: RoundStore;
  pairRounds: PairRoundStore;
  placements: PlacementStore;
  briefs: BriefStore;
  superPowers: SuperPowerStore;
  roundSurveys: RoundSurveyStore;
}
