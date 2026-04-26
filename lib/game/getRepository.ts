import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getMemoryRepository } from "./repository.memory";
import { SupabaseGameRepository } from "./repository.supabase";
import type { GameRepository } from "./repository";

let _supabaseRepo: SupabaseGameRepository | null = null;

/**
 * Returns the active GameRepository. When Supabase env vars are set,
 * we use the Supabase-backed repository; otherwise we fall back to the
 * in-memory store (useful for early-stage local dev before the project
 * is provisioned, and for unit tests).
 */
export function getRepository(): GameRepository {
  if (isSupabaseConfigured()) {
    if (!_supabaseRepo) _supabaseRepo = new SupabaseGameRepository();
    return _supabaseRepo;
  }
  return getMemoryRepository();
}
