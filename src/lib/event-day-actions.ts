import "server-only";
import { cache } from "react";
import { getUser } from "@/lib/auth";
import { getEventAccess } from "@/lib/data";
import { dayLabel, hasBands, hasBooths, hasConferences, hasParents, hasRooms } from "@/lib/event-types";
import { createClient } from "@/lib/supabase/server";
import { utcToZonedDate } from "@/lib/time";

export type DayIcon = "board" | "checkin" | "parents" | "groups" | "booths" | "schedule" | "message" | "meetings" | "station";

/** One thing to do on the day, a tap away. */
export type DayAction = { id: string; label: string; short: string; hint: string; href: string; icon: DayIcon };

export type DayActions = { eventId: string; title: string; actions: DayAction[] };

/**
 * On the event's own date(s), in its time zone: the jobs of the day for this
 * person (checking in volunteers, parents, groups, booths; the schedule;
 * messages), so nobody has to hunt for them. Null on other days, and for
 * anyone not on the event's team. Only pages they can open are listed.
 */
export const loadDayActions = cache(async (eventId: string): Promise<DayActions | null> => {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, event_type, timezone, starts_on, ends_on")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;
  const today = utcToZonedDate(new Date().toISOString(), event.timezone);
  if (today < event.starts_on || today > event.ends_on) return null;

  const type = event.event_type as string;
  const userId = (await getUser())?.id;
  const [access, { data: onTeam }, parents, { count: myStations }] = await Promise.all([
    getEventAccess(eventId),
    supabase.rpc("is_event_staff", { ev: eventId }),
    hasParents(type) ? supabase.rpc("can_check_in_parents", { ev: eventId }) : Promise.resolve({ data: false }),
    userId
      ? supabase.from("station_leads").select("station_id", { count: "exact", head: true }).eq("event_id", eventId).eq("user_id", userId)
      : Promise.resolve({ count: 0 }),
  ]);
  if (!onTeam && !access.canManage) return null;

  const base = `/dashboard/events/${eventId}`;
  const a: DayAction[] = [];
  const lead = (myStations ?? 0) > 0 && !access.canManage;

  if (hasConferences(type)) {
    if (access.isHost) a.push({ id: "meetings", label: "Today's meetings", short: "Meetings", hint: "Who's next, and mark each meeting", href: `${base}/conferences/meetings`, icon: "meetings" });
  } else if (hasBands(type)) {
    if (access.canManage) a.push({ id: "board", label: "Contest day", short: "Contest day", hint: "Is every band on track", href: `${base}/contest-day`, icon: "board" });
    else if (lead) a.push({ id: "board", label: "My stations", short: "My stations", hint: "Bands and volunteers at your stations", href: `${base}/contest-day`, icon: "station" });
  } else if (hasRooms(type)) {
    a.push({ id: "groups", label: "Check groups in", short: "Groups", hint: "Arrived, then done in each room", href: `${base}/event-day`, icon: "groups" });
  } else if (hasParents(type) && parents.data) {
    a.push({ id: "parents", label: "Check in parents", short: "Parents", hint: "At the door, with a photo ID", href: `${base}/parents`, icon: "parents" });
  } else if (hasBooths(type)) {
    a.push({ id: "booths", label: "Booth arrivals", short: "Booths", hint: "Mark each booth as it arrives", href: `${base}/booths`, icon: "booths" });
  }
  if (!hasConferences(type)) {
    if (access.canManage) {
      a.push({ id: "volunteers", label: "Check in volunteers", short: "Volunteers", hint: "Each station's shifts, walk-ups, and no-shows", href: `${base}/volunteers`, icon: "checkin" });
    } else if (lead && !hasBands(type)) {
      a.push({ id: "station", label: "My stations", short: "My stations", hint: "Your stations and their volunteers", href: `${base}/contest-day`, icon: "station" });
    }
  }
  if (hasBands(type)) a.push({ id: "schedule", label: "Band schedule", short: "Schedule", hint: "Who performs when", href: `${base}/schedule`, icon: "schedule" });
  if (hasRooms(type)) a.push({ id: "schedule", label: "Room schedule", short: "Schedule", hint: "Who's in each room when", href: `${base}/rooms`, icon: "schedule" });
  if (access.canManage && !hasConferences(type)) {
    a.push({ id: "message", label: "Send a message", short: "Message", hint: "A delay, a change, or an emergency", href: `${base}/announcements`, icon: "message" });
  }
  if (a.length === 0) return null;
  return { eventId, title: dayLabel(type), actions: a };
});
