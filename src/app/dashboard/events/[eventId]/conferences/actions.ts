"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import {
  AHEAD_DAYS,
  GAP_LENGTHS,
  MEETING_LENGTHS,
  NOTICE_HOURS,
  sortWeekly,
  WEEKDAYS,
  type ConferenceBreak,
  type MeetingMode,
  type WeeklyRange,
} from "@/lib/conferences";
import { conferenceBookedCount } from "@/lib/conference-access";
import { loadConferenceSettings } from "@/lib/conference-settings";
import { emailMovedMeetings, loadConference } from "@/app/e/[slug]/book/data";
import { bookingEmail, emailTeacher, withCallPhone, type Booking } from "@/lib/conference-bookings";
import { getOrigin } from "@/lib/data";
import { pause, sendEmail } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function refresh(eventId: string) {
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
}

/**
 * Saves the conference's settings: changes the row if there is one, otherwise
 * adds it. (Not an upsert: that would also rewrite event_id, which hosts
 * aren't allowed to change.)
 */
async function saveSettings(eventId: string, values: Record<string, unknown>) {
  const supabase = await createClient();
  const row = { ...values, updated_at: new Date().toISOString() };
  const updated = await supabase.from("conference_settings").update(row).eq("event_id", eventId).select("event_id");
  if (updated.error || updated.data?.length) return updated.error;
  const { error } = await supabase.from("conference_settings").insert({ event_id: eventId, ...row });
  return error;
}

/** Step 1: one day or weekly hours, meeting length, the gap between meetings and any breaks. */
export async function saveMeetingTimes(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const meeting = Number(formData.get("meetingMinutes"));
  const gap = Number(formData.get("gapMinutes") ?? 0);
  if (!(MEETING_LENGTHS as readonly number[]).includes(meeting)) return { error: "Pick how long each meeting is." };
  if (!(GAP_LENGTHS as readonly number[]).includes(gap)) return { error: "Pick the time between meetings." };

  const starts = formData.getAll("breakStart").map(String);
  const minutes = formData.getAll("breakMinutes").map(String);
  const labels = formData.getAll("breakLabel").map(String);
  const breaks: ConferenceBreak[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (!starts[i] && !minutes[i]) continue;
    const m = Number(minutes[i]);
    if (!TIME.test(starts[i]) || !Number.isInteger(m) || m < 5 || m > 240) {
      return { error: "Give each break a start time and a length of 5 to 240 minutes, or remove it." };
    }
    breaks.push({ start: starts[i], minutes: m, label: labels[i]?.trim().slice(0, 60) || "Break" });
  }
  if (breaks.length > 8) return { error: "Add up to 8 breaks." };

  const supabase = await createClient();
  const [{ data: event }, current, booked] = await Promise.all([
    supabase.from("events").select("timezone, starts_on").eq("id", eventId).maybeSingle(),
    loadConferenceSettings(supabase, eventId),
    conferenceBookedCount(supabase, eventId),
  ]);
  if (!event) return { error: "Only the conference's host can change it." };
  const weekly = formData.get("schedule") === "weekly";
  const was = current.settings.schedule;
  // Families' meetings are kept as booked: switching between a day and weekly hours waits until they're canceled.
  if (booked > 0 && (weekly ? "weekly" : "one_day") !== was) {
    return {
      error:
        was === "weekly"
          ? "Families have booked weekly meetings. Cancel them on your Meetings page first, or make a new conference for one day."
          : "Families have booked your conference day. Cancel those meetings on your Meetings page first, or make a new conference for weekly hours.",
    };
  }
  if (current.legacy && weekly) return { error: "Weekly hours need a database update first. Please write to us." };
  const common = {
    meeting_minutes: meeting,
    gap_minutes: gap,
    breaks: breaks.sort((a, b) => a.start.localeCompare(b.start)),
    times_saved_at: new Date().toISOString(),
  };

  if (weekly) {
    const days = formData.getAll("weeklyDay").map(String);
    const froms = formData.getAll("weeklyStart").map(String);
    const tos = formData.getAll("weeklyEnd").map(String);
    const hours: WeeklyRange[] = [];
    for (let i = 0; i < days.length; i++) {
      const d = Number(days[i]);
      if (!Number.isInteger(d) || d < 0 || d > 6 || !TIME.test(froms[i] ?? "") || !TIME.test(tos[i] ?? "")) {
        return { error: "Give each block of weekly hours a day, a start, and an end." };
      }
      if (tos[i] <= froms[i]) return { error: `Your ${WEEKDAYS[d]} hours have to end after they start.` };
      hours.push({ day: d, start: froms[i], end: tos[i] });
    }
    if (!hours.length) return { error: "Add your weekly hours." };
    if (hours.length > 21) return { error: "Add up to 21 blocks of weekly hours." };
    const from = String(formData.get("weeklyFrom") ?? "");
    const to = String(formData.get("weeklyTo") ?? "");
    if (!DATE.test(from) || !DATE.test(to)) return { error: "Pick your first and last day." };
    if (to < from) return { error: "Your last day has to be on or after your first day." };
    if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000) return { error: "Weekly hours can run for up to a year. Pick an earlier last day." };
    const closed = [...new Set(formData.getAll("closedDate").map(String).filter(Boolean))].sort();
    if (closed.some((d) => !DATE.test(d))) return { error: "Pick a date for each day off, or remove it." };
    if (closed.length > 60) return { error: "Add up to 60 days off." };
    const notice = Number(formData.get("minNotice"));
    const ahead = Number(formData.get("maxAhead"));
    if (!(NOTICE_HOURS as readonly number[]).includes(notice)) return { error: "Pick how much notice families give." };
    if (!(AHEAD_DAYS as readonly number[]).includes(ahead)) return { error: "Pick how far ahead families can book." };

    // Settings first (weekly hours may run more than one day), then the event's days.
    const error = await saveSettings(eventId, {
      ...common,
      schedule: "weekly",
      weekly_hours: sortWeekly(hours),
      closed_dates: closed,
      min_notice_hours: notice,
      max_days_ahead: ahead,
    });
    if (error) return { error: friendlyDbError(error) };
    const opens = hours.map((h) => h.start).sort()[0];
    const closes = hours.map((h) => h.end).sort().at(-1)!;
    const { error: daysError } = await supabase.rpc("reschedule_event", {
      p_event_id: eventId,
      p_starts_on: from,
      p_ends_on: to,
      p_window_start: zonedToUtc(from, opens, event.timezone).toISOString(),
      p_window_end: zonedToUtc(to, closes, event.timezone).toISOString(),
      p_timezone: event.timezone,
    });
    if (daysError) return { error: friendlyDbError(daysError) };
    refresh(eventId);
    return { ok: true, message: "Meeting times saved." };
  }

  // Changed the day or hours here: move the event too (as Edit details does).
  // Booked meetings move with the day, and each family is emailed.
  let moved: Awaited<ReturnType<typeof emailMovedMeetings>> | null = null;
  const day = formData.get("conferenceDay");
  if (day === null && was === "weekly") return { error: "Pick your conference day." };
  if (day !== null) {
    const date = String(day);
    const from = String(formData.get("startTime") ?? "");
    const to = String(formData.get("endTime") ?? "");
    if (!DATE.test(date)) return { error: "Pick the conference day." };
    if (!TIME.test(from) || !TIME.test(to)) return { error: "Pick when your first meeting starts and your last one ends." };
    if (to <= from) return { error: "Your last meeting has to end after the first one starts." };
    const { error } = await supabase.rpc("reschedule_event", {
      p_event_id: eventId,
      p_starts_on: date,
      p_ends_on: date,
      p_window_start: zonedToUtc(date, from, event.timezone).toISOString(),
      p_window_end: zonedToUtc(date, to, event.timezone).toISOString(),
      p_timezone: event.timezone,
    });
    if (error) return { error: friendlyDbError(error) };
    if (date !== event.starts_on && was === "one_day") moved = await emailMovedMeetings(eventId);
  }

  const error = await saveSettings(eventId, current.legacy ? common : { ...common, schedule: "one_day" });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  if (moved?.moved) {
    const n = moved.moved === 1 ? "Your booked meeting" : `Your ${moved.moved} booked meetings`;
    return {
      ok: true,
      message: moved.allSent
        ? `Meeting times saved. ${n} moved to the new day at the same time, and we emailed each family an updated calendar invite.`
        : `Meeting times saved. ${n} moved to the new day at the same time. We couldn't email every family, so please check your Meetings page and let them know.`,
    };
  }
  return { ok: true, message: "Meeting times saved." };
}

/**
 * Step 2: in person (the school and a room), video (one link with a waiting
 * room, or the teacher sends their own), a phone call (the teacher calls the
 * number the family gives), or the family's choice of in person or video. The school
 * goes on the event, so the public page and calendar invites show it; a
 * video-only conference has no address.
 */
export async function saveMeetingPlace(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const mode = String(formData.get("mode") ?? "") as MeetingMode;
  if (!["in_person", "video", "either", "phone"].includes(mode)) return { error: "Choose where you'll meet." };
  // Phone calls need nothing here: families give the number to call when they book.
  const inPerson = mode === "in_person" || mode === "either";
  const video = mode === "video" || mode === "either";

  const room = String(formData.get("room") ?? "").trim();
  const link = String(formData.get("videoLink") ?? "").trim();
  const waitingRoom = formData.get("waitingRoom") === "on";
  const ownLink = video && formData.get("linkSource") === "own";
  const venueName = String(formData.get("venueName") ?? "").trim().slice(0, 120);
  const venueAddress = String(formData.get("venueAddress") ?? "").trim();
  const placeId = String(formData.get("venuePlaceId") ?? "").trim().slice(0, 300);
  const coord = (k: string, limit: number) => {
    const n = Number(formData.get(k));
    return formData.get(k) && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
  };
  const fieldErrors: Record<string, string> = {};
  if (inPerson && !venueAddress) fieldErrors.venueAddress = "Add your school's address.";
  if (venueAddress.length > 300) fieldErrors.venueAddress = "Keep the address under 300 characters.";
  if (inPerson && !room) fieldErrors.room = "Add your room and how to find it.";
  if (room.length > 200) fieldErrors.room = "Keep this under 200 characters.";
  if (video && !ownLink) {
    if (!/^https:\/\/\S+$/.test(link) || link.length > 500) fieldErrors.videoLink = "Paste your meeting link. It starts with https://";
    if (!waitingRoom) fieldErrors.waitingRoom = "Set up your meeting with a waiting room, then tick this.";
  }
  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }

  const supabase = await createClient();
  const school = await supabase
    .from("events")
    .update({
      venue_name: inPerson ? venueName || null : null,
      venue_address: inPerson ? venueAddress : "",
      venue_place_id: inPerson ? placeId || null : null,
      venue_lat: inPerson && placeId ? coord("venueLat", 90) : null,
      venue_lng: inPerson && placeId ? coord("venueLng", 180) : null,
    })
    .eq("id", eventId)
    .select("id");
  if (school.error) return { error: friendlyDbError(school.error) };
  if (!school.data?.length) return { error: "Only the conference's host can change it." };

  const error = await saveSettings(eventId, {
    meeting_mode: mode,
    room: inPerson ? room : null,
    own_link: ownLink,
    video_link: video && !ownLink ? link : null,
    waiting_room_confirmed: video && !ownLink && waitingRoom,
  });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true, message: "Saved." };
}

/**
 * The teacher cancels one family's meeting: the time opens up again, the
 * booking (the child's name and the family's details) is deleted, and each
 * parent is emailed so the invite comes off their calendar.
 */
export async function cancelMeeting(eventId: string, bookingId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  // Only the teacher can see (and delete) their bookings.
  const { data: seen } = await supabase.from("conference_bookings").select("id").eq("id", bookingId).eq("event_id", eventId).maybeSingle();
  if (!seen) return { error: "You don't have permission to do that." };
  const admin = createAdminClient();
  const { data: booking } = await withCallPhone((columns) => admin.from("conference_bookings").select(columns).eq("id", bookingId).single());
  const { data: deleted, error } = await supabase.from("conference_bookings").delete().eq("id", bookingId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!deleted?.length) return { error: "You don't have permission to do that." };

  let emailed = false;
  const conf = await loadConference({ id: eventId });
  if (booking && conf) {
    const b = booking as unknown as Booking;
    const origin = await getOrigin();
    const link = `${origin}/e/${conf.event.slug}/book`;
    emailed = true;
    for (const [i, p] of b.parents.entries()) {
      if (i) await pause();
      const message = bookingEmail("canceled", b, conf.event, conf.settings, conf.teacher, link, p, true);
      emailed = (await sendEmail({ to: p.email, ...message, eventId: conf.event.id })) && emailed;
    }
    // Takes it off the teacher's own calendar too.
    await emailTeacher("canceled", b, conf, origin, true);
    revalidatePath(`/e/${conf.event.slug}/book`);
  }
  refresh(eventId);
  return {
    ok: true,
    message: emailed ? "Canceled. We emailed the family, and the time is open again." : "Canceled, and the time is open again. We couldn't email the family, so please let them know.",
  };
}

/** Once a meeting has started, the teacher marks it Met or No-show (null undoes it). */
export async function setMeetingOutcome(eventId: string, bookingId: string, outcome: "met" | "no_show" | null): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_conference_outcome", { p_id: bookingId, p_outcome: outcome });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}/conferences/meetings`);
  return { ok: true };
}
