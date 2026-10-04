export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The Vercel ↔ Supabase integration sets the older ANON_KEY name; accept either.
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the Supabase keys are added (see docs/SETUP-GUIDE.md). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function requireSupabaseEnv() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in the Supabase values.",
    );
  }
  return { url: supabaseUrl, key: supabasePublishableKey };
}
