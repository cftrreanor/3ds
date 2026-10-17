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
  const scheduleTable = hasBands(type) ? "performance_slots" : hasRooms(type) ? "room_slots" : null;
  const [access, { data: onTeam }, parents, { count: myStations }, { count: scheduled }] = await Promise.all([
    getEventAccess(eventId),
    supabase.rpc("is_event_staff", { ev: eventId }),
    hasParents(type) ? supabase.rpc("can_check_in_parents", { ev: eventId }) : Promise.resolve({ data: false }),
    userId
      ? supabase.from("station_leads").select("station_id", { count: "exact", head: true }).eq("event_id", eventId).eq("user_id", userId)
      : Promise.resolve({ count: 0 }),
    // A schedule to push back (or look up) only once one is built.
    scheduleTable
      ? supabase.from(scheduleTable).select("band_id", { count: "exact", head: true }).eq("event_id", eventId)
      : Promise.resolve({ count: 0 }),
  ]);
  if (!onTeam && !access.canManage) return null;

  const base = `/dashboard/events/${eventId}`;
  const a: DayAction[] = [];
  const lead = (myStations ?? 0) > 0 && !access.canManage;

  // Each button names the job, and lands on the part of the page where it's done.
  const job = (id: string, icon: DayIcon, label: string, short: string, hint: string, path: string) =>
    a.push({ id, icon, label, short, hint, href: `${base}${path}` });

  if (hasConferences(type)) {
    if (access.isHost) job("meetings", "meetings", "Run today's meetings", "Run meetings", "Who's next, and mark each one met or a no-show", "/conferences/meetings");
  } else if (hasBands(type)) {
    if (access.canManage) job("board", "board", "Check on every band", "Check on bands", "Who's late, and who's next on the field", "/contest-day");
    else if (lead) job("board", "station", "Check bands in at my stations", "Check bands in", "Tap each band in as it reaches your station", "/contest-day");
  } else if (hasRooms(type)) {
    job("groups", "groups", "Check groups in", "Check groups in", "Tap Arrived, then Done in each room", "/event-day");
  } else if (hasParents(type) && parents.data) {
    job("parents", "parents", "Check in parents", "Check in parents", "At the door, after checking a photo ID", "/parents#door-check-in");
  } else if (hasBooths(type)) {
    job("booths", "booths", "Check in booths and partners", "Check in booths", "Tap Arrived as each one sets up", "/booths#check-in");
  }
  if (!hasConferences(type)) {
    if (access.canManage) {
      job("volunteers", "checkin", "Check in volunteers", "Check in volunteers", "Shifts by station, walk-ups, and no-shows", "/volunteers");
    } else if (lead && !hasBands(type)) {
      job("station", "station", "Check in my volunteers", "Check in my volunteers", "The volunteers at your stations", "/contest-day");
    }
  }
  // Running late: hosts move every later time; the rest of the team looks times up.
  const hasSchedule = (scheduled ?? 0) > 0;
  if (hasBands(type) && hasSchedule) {
    if (access.isHost) job("push", "schedule", "Push the schedule back", "Push schedule back", "Running behind? Move every later time", "/contest-day#push-back");
    else job("schedule", "schedule", "Look up a band's time", "Look up times", "Warm-up and performance times", "/schedule");
  }
  if (hasRooms(type) && hasSchedule) {
    if (access.isHost) job("push", "schedule", "Push the schedule back", "Push schedule back", "Running behind? Move every later time", "/event-day#push-back");
    else job("schedule", "schedule", "Look up a group's room and time", "Look up times", "Every room's schedule", "/rooms#board-heading");
  }
  if (access.canManage && !hasConferences(type)) {
    job("message", "message", "Send a message", "Send a message", "A delay, a change, or an emergency", "/announcements#post");
  }
  if (a.length === 0) return null;
  return { eventId, title: dayLabel(type), actions: a };
});
