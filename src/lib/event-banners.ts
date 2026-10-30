import "server-only";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Event banners: live day-of announcements (the announcements table) for the
// people they're addressed to. See supabase/migrations/20261112000000_event_banners.sql.

export type EventAudience = "public" | "band_directors" | "volunteers" | "section_leads";
export type EventBanner = { id: string; event_id: string; body: string; priority: "emergency" | "schedule" | "routine"; created_at: string; ends_at: string | null };

const COLUMNS = "id, event_id, body, priority, created_at, ends_at";

/** Emergencies first, then schedule changes, then everything else; newest first within each. */
const RANK = { emergency: 0, schedule: 1, routine: 2 } as const;
function byImportance(banners: EventBanner[]) {
  return [...banners].sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.created_at.localeCompare(a.created_at));
}

/** Live = posted in the last day and not ended yet. */
function live<T extends { gte: (c: string, v: string) => T; or: (f: string) => T }>(q: T) {
  const now = new Date();
  return q.gte("created_at", new Date(now.getTime() - 864e5).toISOString()).or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`);
}

/**
 * Live banners for one audience on an event, read as the signed-in person (or
 * visitor), so the database's own rules decide what they may see.
 */
export async function liveEventBanners(eventId: string, audience: Exclude<EventAudience, "volunteers">): Promise<EventBanner[]> {
  const supabase = await createClient();
  const { data, error } = await live(
    supabase.from("announcements").select(COLUMNS).eq("event_id", eventId).contains("audiences", [audience]),
  ).order("created_at", { ascending: false });
  if (error && !isSchemaError(error)) console.error("event banners load failed", error.message);
  return byImportance((data ?? []) as EventBanner[]);
}

/**
 * Live volunteer banners for the events someone volunteers at. Volunteers
 * usually aren't signed in ("My volunteering" knows them by their pass), so the
 * caller must already have worked out which events are theirs.
 */
export async function liveVolunteerBanners(eventIds: string[]): Promise<EventBanner[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await live(
    createAdminClient().from("announcements").select(COLUMNS).in("event_id", eventIds).contains("audiences", ["volunteers"]),
  ).order("created_at", { ascending: false });
  if (error && !isSchemaError(error)) console.error("volunteer banners load failed", error.message);
  return byImportance((data ?? []) as EventBanner[]);
}
