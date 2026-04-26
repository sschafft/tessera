import type {
  CreateGameInput,
  CreateParticipantInput,
  GameRecord,
  GameRepository,
  ParticipantRecord,
} from "./repository";

export class DuplicateNameError extends Error {
  constructor() {
    super("display_name already exists in this game");
    this.name = "DuplicateNameError";
  }
}

/**
 * In-memory GameRepository. Used during early local dev before Supabase
 * env vars are set. Per-process, no persistence across server restarts.
 */
export class MemoryGameRepository implements GameRepository {
  private games = new Map<string, GameRecord>();
  private participants = new Map<string, ParticipantRecord>();

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
    };
    this.games.set(record.code, record);
    return record;
  }

  async findGameByCode(code: string): Promise<GameRecord | null> {
    return this.games.get(code) ?? null;
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
    };
    this.participants.set(record.id, record);
    return record;
  }

  async listActiveParticipants(game_id: string): Promise<ParticipantRecord[]> {
    return [...this.participants.values()]
      .filter((p) => p.game_id === game_id && p.released_at === null)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  }

  async findParticipantByName(
    game_id: string,
    display_name: string,
  ): Promise<ParticipantRecord | null> {
    const target = display_name.toLowerCase();
    for (const p of this.participants.values()) {
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
    return this.participants.get(id) ?? null;
  }

  async touchParticipant(id: string): Promise<void> {
    const p = this.participants.get(id);
    if (p) p.last_seen_at = new Date().toISOString();
  }
}

let _instance: MemoryGameRepository | null = null;
export function getMemoryRepository(): MemoryGameRepository {
  if (!_instance) _instance = new MemoryGameRepository();
  return _instance;
}
