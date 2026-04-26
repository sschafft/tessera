"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let _client: SupabaseClient<Database> | null = null;

/**
 * Browser-side Supabase client. Uses the public anon key — safe to
 * include in the bundle. Only used for Realtime subscriptions in v1;
 * all data fetches go through our /api routes (which use the
 * service-role key server-side).
 */
export function getBrowserClient(): SupabaseClient<Database> | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  _client = createClient<Database>(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return _client;
}
