export const supabaseUrl = projectOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
// The Vercel ↔ Supabase integration sets the older ANON_KEY name; accept either.
export const supabasePublishableKey =
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

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

/**
 * Keep only "https://<project>.supabase.co". The dashboard also shows longer
 * URLs (e.g. ending in /rest/v1/), and pasting one of those breaks sign-in
 * with "404: Invalid path specified in request URL".
 */
function projectOrigin(raw: string | undefined) {
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
