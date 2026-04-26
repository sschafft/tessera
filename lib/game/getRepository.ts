import { getMemoryRepository } from "./repository.memory";
import type { GameRepository } from "./repository";

/**
 * Returns the active GameRepository. Today: in-memory. Once Supabase is
 * configured (env vars present), this will return a Supabase-backed
 * implementation instead. Keep this single switch point so the rest of
 * the app never imports a concrete repository.
 */
export function getRepository(): GameRepository {
  // TODO(supabase): when NEXT_PUBLIC_SUPABASE_URL is set, return the
  // Supabase-backed repository instead.
  return getMemoryRepository();
}
