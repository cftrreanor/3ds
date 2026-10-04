import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  default_timezone: string;
  subscription_status: string;
};

/** The first organization the signed-in user administers (multi-org comes later). */
export async function getMyOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug, default_timezone, subscription_status")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data;
}

export type EventAccess = {
  /** Account Host for the event's organization: can do everything. */
  isHost: boolean;
  /** Host or Volunteer Director: stations, shifts, volunteers, lead invites. */
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
