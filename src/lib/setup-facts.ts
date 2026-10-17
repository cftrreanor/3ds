import "server-only";
import { getEventAccess } from "@/lib/data";
import { notReady, SETTINGS_COLUMNS, type ConferenceSettings } from "@/lib/conferences";
import { hasBooths, hasConferences, hasRooms } from "@/lib/event-types";
import type { SetupFacts } from "@/lib/setup-checklist";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything the setup checklist ticks from, read fresh for one event.
 * Hosts only (null for anyone else), so the event page and every page
 * around it show the same checklist.
 */
export async function loadSetupFacts(eventId: string): Promise<SetupFacts | null> {
  if (!(await getEventAccess(eventId)).isHost) return null;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organization_id, status, event_type, volunteer_signup_open, band_registration_open, performance_order_published, director_info, finals_published, finalists_revealed, parent_registration_open, parent_registration_closes_at, venue_address",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;
  const type = event.event_type as string;
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [stations, checkInStops, shifts, staff, invites, cohosts, files, finalsSlots, pathRooms, booths, conference, rooms, scheduleSlots] = await Promise.all([
    count(supabase.from("stations").select("id", head).eq("event_id", eventId)),
    count(supabase.from("stations").select("id", head).eq("event_id", eventId).not("checkpoint_kind", "is", null)),
    count(supabase.from("shifts").select("id", head).eq("event_id", eventId)),
    count(supabase.from("event_staff").select("user_id", head).eq("event_id", eventId)),
    count(supabase.from("invitations").select("id", head).eq("event_id", eventId).is("accepted_at", null)),
    count(supabase.from("organization_members").select("user_id", head).eq("organization_id", event.organization_id).eq("role", "admin")),
    count(supabase.from("event_files").select("id", head).eq("event_id", eventId)),
    type === "band_contest" ? count(supabase.from("finals_slots").select("event_id", head).eq("event_id", eventId)) : 0,
    hasRooms(type) ? count(supabase.from("rooms").select("id", head).eq("event_id", eventId).not("path_order", "is", null)) : 0,
    hasBooths(type) ? count(supabase.from("fair_booths").select("id", head).eq("event_id", eventId)) : 0,
    hasConferences(type)
      ? supabase
          .from("conference_settings")
          .select(SETTINGS_COLUMNS)
          .eq("event_id", eventId)
          .maybeSingle()
          .then(({ data }) => (data ?? null) as ConferenceSettings | null)
      : null,
    hasRooms(type) ? count(supabase.from("rooms").select("id", head).eq("event_id", eventId)) : 0,
    hasRooms(type)
      ? count(supabase.from("room_slots").select("band_id", head).eq("event_id", eventId))
      : type === "band_contest"
        ? count(supabase.from("performance_slots").select("band_id", head).eq("event_id", eventId))
        : 0,
  ]);
  return {
    eventId,
    eventType: type,
    published: event.status === "published",
    stations,
    shifts,
    checkInStops,
    team: staff + cohosts,
    invitesPending: invites,
    files,
    volunteerSignupOpen: event.volunteer_signup_open,
    bandRegistrationOpen: Boolean(event.band_registration_open),
    scheduleShared: Boolean(event.performance_order_published),
    finalsSlots,
    finalsPublished: Boolean(event.finals_published),
    finalistsRevealed: Boolean(event.finalists_revealed),
    directorInfo: Boolean(event.director_info?.trim()),
    pathRooms,
    rooms,
    scheduleSlots,
    conferenceTimesSaved: Boolean(conference?.times_saved_at),
    booths,
    parentRegistrationOpen: event.parent_registration_open,
    parentClosesAt: Boolean(event.parent_registration_closes_at),
    conferenceMissing: hasConferences(type) ? notReady(conference, event.venue_address) : null,
  };
}
