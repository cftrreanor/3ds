import "server-only";
import { cache } from "react";
import { accountHealth, type HealthLevel } from "@/lib/admin-crm";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Loaders shared by the admin pages. Callers check requirePlatformAdmin()
// first (the layout does too); reads use the server key, except the sign-in
// functions, which check the admin in the database.

export type SignIn = { created_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null };

/** Every account holder's sign-up and last sign-in, by user id. */
export const signIns = cache(async () => {
  const { data, error } = await (await createClient()).rpc("admin_sign_ins");
  if (error) console.error("admin_sign_ins failed", error.message);
  return new Map(((data ?? []) as (SignIn & { user_id: string })[]).map((r) => [r.user_id, r]));
});

export type AccountEvent = { id: string; name: string; status: string; event_type: string; starts_on: string; ends_on: string; created_at: string };
export type AccountMember = { user_id: string; role: string; profiles: { full_name: string; email: string } | null };
export type Account = {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  free_until: string | null;
  default_timezone: string;
  created_at: string;
  organization_members: AccountMember[];
  events: AccountEvent[];
  owner: { full_name: string; email: string } | null;
  lastHostSignIn: string | null;
  health: { level: HealthLevel; reasons: string[] };
};

const ACCOUNT_COLUMNS =
  "id, name, slug, subscription_status, free_until, default_timezone, created_at, organization_members(user_id, role, profiles(full_name, email)), events(id, name, status, event_type, starts_on, ends_on, created_at)";

function enrich(raw: Omit<Account, "owner" | "lastHostSignIn" | "health">, logins: Map<string, SignIn>): Account {
  const lastHostSignIn =
    raw.organization_members
      .map((m) => logins.get(m.user_id)?.last_sign_in_at ?? null)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;
  return {
    ...raw,
    owner: raw.organization_members.find((m) => m.role === "owner")?.profiles ?? null,
    lastHostSignIn,
    health: accountHealth(raw, raw.events, lastHostSignIn),
  };
}

/** Every organization, with hosts, events, last host sign-in and health. */
export const loadAccounts = cache(async (): Promise<Account[]> => {
  const [{ data, error }, logins] = await Promise.all([
    createAdminClient().from("organizations").select(ACCOUNT_COLUMNS).order("created_at", { ascending: false }),
    signIns(),
  ]);
  if (error) console.error("accounts load failed", error.message);
  return ((data ?? []) as unknown as Omit<Account, "owner" | "lastHostSignIn" | "health">[]).map((o) => enrich(o, logins));
});

export async function loadAccount(id: string): Promise<Account | null> {
  const [{ data }, logins] = await Promise.all([
    createAdminClient().from("organizations").select(ACCOUNT_COLUMNS).eq("id", id).maybeSingle(),
    signIns(),
  ]);
  return data ? enrich(data as unknown as Omit<Account, "owner" | "lastHostSignIn" | "health">, logins) : null;
}

export type NoteRow = {
  id: string;
  body: string;
  follow_up_on: string | null;
  done_at: string | null;
  created_at: string;
  organization_id: string | null;
  profile_id: string | null;
  pilot_request_id: string | null;
  author: { full_name: string; email: string } | null;
};

export const NOTE_COLUMNS =
  "id, body, follow_up_on, done_at, created_at, organization_id, profile_id, pilot_request_id, author:profiles!admin_notes_author_id_fkey(full_name, email)";

export type EmailRow = { id: string; to_email: string; subject: string; status: "sent" | "failed" | "skipped"; error: string | null; created_at: string };
