import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let client: SupabaseClient<Database> | null = null;

/**
 * Lazily creates the Supabase client on first use (not at module load) so the
 * admin bundle can be imported before a Supabase project is provisioned
 * without throwing. Only the anon/publishable key is ever read here — the
 * service-role key must never be referenced from browser code.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
        "(see .env.example) before using any admin feature that talks to the backend.",
    );
  }

  client = createClient(url, anonKey);
  return client;
}
