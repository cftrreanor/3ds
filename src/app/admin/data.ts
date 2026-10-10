import "server-only";
import { cache } from "react";
import { planLabel } from "@/lib/admin";
import { accountHealth, type HealthLevel } from "@/lib/admin-crm";
import { getOrigin } from "@/lib/data";
import { firstName, siteLinks, type MergeVars } from "@/lib/merge-fields";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";

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

export type EmailRow = {
  id: string;
  to_email: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  created_at: string;
  body?: string | null;
  sender?: { full_name: string; email: string } | null;
};

/** email_log columns, with who wrote it when it came from the admin dashboard. */
export const EMAIL_COLUMNS = "id, to_email, subject, status, error, created_at, body, sender:profiles!email_log_sent_by_fkey(full_name, email)";

export type Recipient = { email: string; name: string; label: string; vars: MergeVars };
export type EmailTarget = { organizationId?: string; profileId?: string; pilotRequestId?: string };

/**
 * Who can be emailed from a record page, with each person's merge fields: an
 * account's hosts, a person, or whoever sent a pilot request.
 */
export async function emailRecipients(target: EmailTarget): Promise<Recipient[]> {
  const origin = await siteOrigin();
  return (await recipientsWithoutLinks(target)).map((r) => ({ ...r, vars: { ...r.vars, ...siteLinks(origin, r.email) } }));
}

/**
 * The site's address for links in emails: its main address on Vercel (not a
 * preview copy), otherwise wherever this page is being served from.
 */
export async function siteOrigin() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : await getOrigin();
}

async function recipientsWithoutLinks(target: EmailTarget): Promise<Recipient[]> {
  const admin = createAdminClient();
  if (target.organizationId) {
    const account = await loadAccount(target.organizationId);
    if (!account) return [];
    const today = utcToZonedDate(new Date().toISOString(), account.default_timezone);
    const next = account.events.filter((e) => e.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
    const shared: MergeVars = {
      organization: account.name,
      plan: planLabel(account.subscription_status),
      free_until: account.free_until ? formatDate(account.free_until, { weekday: undefined }) : "",
      next_event: next ? `${next.name} (${formatDate(next.starts_on, { weekday: undefined })})` : "",
    };
    return account.organization_members
      .filter((m) => m.profiles?.email)
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
      .map((m) => {
        const name = m.profiles!.full_name || "";
        return {
          email: m.profiles!.email,
          name,
          label: `${name || m.profiles!.email} (${m.role === "owner" ? "owner" : "co-host"})`,
          vars: { ...shared, name, first_name: firstName(name) },
        };
      });
  }
  if (target.profileId) {
    const { data } = await admin
      .from("profiles")
      .select("full_name, email, organization_members(organizations(name))")
      .eq("id", target.profileId)
      .maybeSingle();
    if (!data) return [];
    const p = data as unknown as { full_name: string; email: string; organization_members: { organizations: { name: string } | null }[] };
    return [
      {
        email: p.email,
        name: p.full_name,
        label: p.full_name || p.email,
        vars: { name: p.full_name, first_name: firstName(p.full_name), organization: p.organization_members[0]?.organizations?.name ?? "" },
      },
    ];
  }
  if (target.pilotRequestId) {
    const { data } = await admin.from("pilot_requests").select("name, email, organization").eq("id", target.pilotRequestId).maybeSingle();
    if (!data) return [];
    return [{ email: data.email, name: data.name, label: data.name, vars: { name: data.name, first_name: firstName(data.name), organization: data.organization } }];
  }
  return [];
}

export type TemplateRow = { id: string; name: string; subject: string; body: string; updated_at: string };

export async function loadTemplates(): Promise<TemplateRow[]> {
  const { data } = await createAdminClient().from("email_templates").select("id, name, subject, body, updated_at").order("name");
  return (data ?? []) as TemplateRow[];
}

/** The signed-in admin's own name, for {{my_name}}. */
export async function myName(userId: string) {
  const { data } = await createAdminClient().from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data?.full_name as string | undefined) ?? "";
}
