import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The parts of an event whose last save is shown ("Co-host Pat Kim saved this…"). */
export type SaveArea =
  | "details"
  | "publish"
  | "volunteers"
  | "bands"
  | "schedule"
  | "parents"
  | "booths"
  | "conference"
  | "team"
  | "files"
  | "announcements";

export type EventSave = {
  savedAt: string;
  name: string | null;
  /** "Host", "Co-host", or "Volunteer Lead" (null if they've left the team). */
  role: string | null;
  isYou: boolean;
  /** How many people manage the event. */
  managers: number;
};

/**
 * Who last saved each part of an event, and when, plus the event's time zone.
 * Only the event's hosts and Volunteer Leads get anything back. Read once per
 * request however many lines the page shows.
 */
export const loadEventSaves = cache(async (eventId: string) => {
  const supabase = await createClient();
  const [{ data: rows }, { data: event }] = await Promise.all([
    supabase.rpc("event_saves", { ev: eventId }),
    supabase.from("events").select("timezone").eq("id", eventId).maybeSingle(),
  ]);
  const saves: Partial<Record<SaveArea, EventSave>> = {};
  // Before the migration runs the function is missing: no lines, nothing breaks.
  for (const r of (rows ?? []) as { area: SaveArea; saved_at: string; name: string | null; role: string | null; is_you: boolean; managers: number }[]) {
    saves[r.area] = { savedAt: r.saved_at, name: r.name, role: r.role, isYou: r.is_you, managers: r.managers };
  }
  return { saves, tz: (event?.timezone as string | undefined) ?? "America/Chicago" };
});
