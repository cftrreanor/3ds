import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** Supabase client for Client Components (runs in the browser). */
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}
