import type {
  CreateGameInput,
  GameRecord,
  GameRepository,
} from "./repository";

/**
 * In-memory GameRepository. Used during milestone 1 before Supabase is
 * wired up. Note: the data is per-process, so it doesn't survive a Next.js
 * dev server restart and won't work across multiple Vercel instances. It
 * is a placeholder, not a runtime store.
 */
export class MemoryGameRepository implements GameRepository {
  private byCode = new Map<string, GameRecord>();

  async create(
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
    this.byCode.set(record.code, record);
    return record;
  }

  async findByCode(code: string): Promise<GameRecord | null> {
    return this.byCode.get(code) ?? null;
  }
}

let _instance: MemoryGameRepository | null = null;
/**
 * Module-level singleton — Next.js's dev server preserves it across HMR
 * reloads inside a single process, but not across dev-server restarts.
 */
export function getMemoryRepository(): MemoryGameRepository {
  if (!_instance) _instance = new MemoryGameRepository();
  return _instance;
}
