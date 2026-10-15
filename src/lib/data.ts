import "server-only";
import { headers } from "next/headers";
import { isSchemaError } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  default_timezone: string;
  subscription_status: string;
  /** Last day of a free pilot or trial. */
  free_until: string | null;
  /** "teacher": a free teacher account (conferences only). */
  account_kind?: string;
  /** Set while an admin has suspended the account. */
  suspended_at?: string | null;
};

/** The first organization the signed-in user administers (multi-org comes later). */
export async function getMyOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const first = (columns: string) =>
    supabase.from("organizations").select(columns).order("created_at").limit(1).maybeSingle<Organization>();
  const { data, error } = await first("id, name, slug, default_timezone, subscription_status, free_until, account_kind, suspended_at");
  if (!isSchemaError(error)) return data;
  // Before the teacher admin update (suspended_at) has been run.
  const kinded = await first("id, name, slug, default_timezone, subscription_status, free_until, account_kind");
  if (!isSchemaError(kinded.error)) return kinded.data;
  // Before the teacher accounts update (account_kind), or the admin dashboard's (free_until), has been run.
  const older = await first("id, name, slug, default_timezone, subscription_status, free_until");
  if (!isSchemaError(older.error)) return older.data;
  return (await first("id, name, slug, default_timezone, subscription_status")).data;
}

export type EventAccess = {
  /** Account Host for the event's organization: can do everything. */
  isHost: boolean;
  /** Host or Volunteer Lead: stations, shifts, volunteers, lead invites. */
  canManage: boolean;
};

/** What the signed-in user may do with an event. The database enforces the same rules. */
export async function getEventAccess(eventId: string): Promise<EventAccess> {
  const supabase = await createClient();
  const [host, manage] = await Promise.all([
    supabase.rpc("is_event_admin", { ev: eventId }),
    supabase.rpc("can_manage_volunteers", { ev: eventId }),
  ]);
  return { isHost: host.data === true, canManage: manage.data === true };
}

/** This site's own address, e.g. https://fieldcommand-xi.vercel.app */
export async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
