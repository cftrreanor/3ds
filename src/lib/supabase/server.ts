import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { schemaAwareFetch } from "@/lib/schema-check";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers.
 * Acts as the signed-in user, so Row Level Security applies.
 */
export async function createClient() {
  // Read cookies first: it marks the page as per-request, so it is never
  // pre-rendered at build time (when the keys may not be available).
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseEnv();

  return createServerClient(url, key, {
    global: { fetch: schemaAwareFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Privileged client that BYPASSES Row Level Security. Only for trusted server
 * code such as the public volunteer signup and the Stripe webhook. Never pass
 * its results to the browser without filtering them.
 */
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createPlainClient(url, secret, { auth: { persistSession: false }, global: { fetch: schemaAwareFetch } });
}
