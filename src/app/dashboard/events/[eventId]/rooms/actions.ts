"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate, zonedToUtc } from "@/lib/time";

export type RoomInput = { id?: string; name: string; note: string; onPath: boolean; minutes: number };
export type ScheduleInput = {
  date: string;
  time: string;
  interval: number;
  passing: number;
  order: { bandId: string; skipped: string[]; extraMinutes: number }[];
  /** When the schedule is posted: email directors whose times changed. */
  emailChanges: boolean;
};

type SlotRow = {
  room_id: string;
  band_id: string;
  starts_at: string;
  ends_at: string;
};

const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** The rooms and the path, all at once. Everyone's times are worked out again. */
export async function saveRooms(eventId: string, rooms: RoomInput[]): Promise<ActionState> {
  await requireUser();
  if (rooms.some((r) => !r.name.trim())) return { error: "Every room needs a name." };
  if (rooms.some((r) => r.onPath && !whole(r.minutes, 5, 240))) {
    return { error: "Each stop on the path takes 5 to 240 minutes." };
  }
  const supabase = await createClient();
  const before = await loadSlots(eventId);
  const { error } = await supabase.rpc("save_rooms", {
    p_event: eventId,
    p_rooms: rooms.map((r) => ({
      id: r.id ?? null,
      name: r.name.trim(),
      note: r.note.trim(),
      on_path: r.onPath,
      minutes: r.onPath ? r.minutes : 20,
    })),
  });
  if (error) return { error: friendlyDbError(error) };
  const changed = await emailIfPosted(eventId, before);
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: changed ? `Saved. Emailing ${changed} director${changed === 1 ? "" : "s"} their new times.` : "Rooms saved." };
}

/** Start time, spacing and the groups in order. */
export async function saveRoomSchedule(eventId: string, input: ScheduleInput): Promise<ActionState> {
  await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
    return { error: "Pick the day and the time the first group starts." };
  }
  if (!whole(input.interval, 5, 240)) return { error: "Minutes between groups: 5 to 240." };
  if (!whole(input.passing, 0, 60)) return { error: "Passing time between rooms: 0 to 60 minutes." };
  if (input.order.some((o) => !whole(o.extraMinutes, 0, 600))) return { error: "A break can be up to 600 minutes." };

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("timezone").eq("id", eventId).single();
  if (!event) return { error: "Event not found." };
  const start = zonedToUtc(input.date, input.time, event.timezone);
  const before = await loadSlots(eventId);
  const { error } = await supabase.rpc("save_room_schedule", {
    p_event: eventId,
    p_start: start.toISOString(),
    p_interval: input.interval,
    p_passing: input.passing,
    p_order: input.order.map((o) => ({ band_id: o.bandId, skipped_room_ids: o.skipped, extra_minutes_before: o.extraMinutes })),
  });
  if (error) return { error: friendlyDbError(error) };
  const changed = input.emailChanges ? await emailIfPosted(eventId, before) : 0;
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return {
    ok: true,
    message: changed ? `Saved. Emailing ${changed} director${changed === 1 ? "" : "s"} their new times.` : "Schedule saved.",
  };
}

/** Post the schedule (directors get their times) or take it down. */
export async function setRoomSchedulePosted(eventId: string, posted: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  if (posted) {
    const { count } = await supabase.from("room_slots").select("band_id", { count: "exact", head: true }).eq("event_id", eventId);
    if (!count) return { error: "Save a schedule with at least one group first." };
  }
  const { data, error } = await supabase
    .from("events")
    .update({ performance_order_published: posted, ...(posted ? { schedule_updated_at: new Date().toISOString() } : {}) })
    .eq("id", eventId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can post the schedule." };
  let sent = 0;
  if (posted) sent = await emailItineraries(eventId, null, "posted");
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return {
    ok: true,
    message: posted ? `Posted. Emailing ${sent} director${sent === 1 ? "" : "s"} their group's schedule.` : "The schedule is hidden again.",
  };
}

async function loadSlots(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("room_slots").select("room_id, band_id, starts_at, ends_at").eq("event_id", eventId);
  return (data ?? []) as SlotRow[];
}

/** After a change to a posted schedule: email the groups whose times moved. */
async function emailIfPosted(eventId: string, before: SlotRow[]) {
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("performance_order_published").eq("id", eventId).single();
  if (!ev?.performance_order_published) return 0;
  const now = await loadSlots(eventId);
  const key = (s: SlotRow) => `${s.room_id}|${new Date(s.starts_at).getTime()}|${new Date(s.ends_at).getTime()}`;
  const sig = (rows: SlotRow[], band: string) =>
    rows
      .filter((s) => s.band_id === band)
      .map(key)
      .sort()
      .join(",");
  const bands = new Set([...before, ...now].map((s) => s.band_id));
  const changed = [...bands].filter((b) => now.some((s) => s.band_id === b) && sig(before, b) !== sig(now, b));
  if (!changed.length) return 0;
  return emailItineraries(eventId, changed, "changed");
}

/** Each group's rooms and times, emailed to its directors (in the background). Returns how many groups. */
async function emailItineraries(eventId: string, bandIds: string[] | null, kind: "posted" | "changed") {
  const supabase = await createClient();
  const [{ data: event }, { data: rooms }, { data: slots }, { data: bands }] = await Promise.all([
    supabase.from("events").select("name, slug, timezone, venue_name, venue_address").eq("id", eventId).single(),
    supabase.from("rooms").select("id, name, note").eq("event_id", eventId),
    supabase.from("room_slots").select("room_id, band_id, starts_at, ends_at").eq("event_id", eventId).order("starts_at"),
    supabase.from("bands").select("id, band_name, school_name, contact_email, head_director_email").eq("event_id", eventId),
  ]);
  if (!event) return 0;
  const roomById = new Map((rooms ?? []).map((r) => [r.id, r]));
  const targets = (bands ?? []).filter((b) => (bandIds ? bandIds.includes(b.id) : true) && (slots ?? []).some((s) => s.band_id === b.id));
  const origin = await getOrigin();
  after(async () => {
    for (const b of targets) {
      const mine = (slots ?? []).filter((s) => s.band_id === b.id);
      const { html, text } = emailLayout({
        heading: kind === "changed" ? `Updated times for ${b.band_name}` : `${b.band_name}'s schedule at ${event.name}`,
        paragraphs: [
          kind === "changed"
            ? `The host changed the schedule for ${event.name}. Here are ${b.school_name}'s new times.`
            : `The schedule for ${event.name} is posted. Here's where ${b.school_name} needs to be, and when.`,
        ],
        rows: [
          ...mine.map((s) => {
            const room = roomById.get(s.room_id);
            return {
              title: [room?.name, room?.note].filter(Boolean).join(" · "),
              detail: `${formatDate(utcToZonedDate(s.starts_at, event.timezone), { year: undefined })}, ${formatTimeRange(s.starts_at, s.ends_at, event.timezone)}`,
            };
          }),
          { title: "Venue", detail: [event.venue_name, event.venue_address].filter(Boolean).join(", ") },
        ],
        button: { label: "See the full schedule", url: `${origin}/e/${event.slug}` },
      });
      const subject = kind === "changed" ? `Time change: ${b.band_name} at ${event.name}` : `Your schedule: ${b.band_name} at ${event.name}`;
      for (const to of new Set([b.head_director_email, b.contact_email])) {
        await sendEmail({ to, subject, html, text });
        await pause();
      }
    }
  });
  return targets.length;
}
