"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { GAP_LENGTHS, MEETING_LENGTHS, type ConferenceBreak, type MeetingMode } from "@/lib/conferences";
import { emailMovedMeetings, loadConference } from "@/app/e/[slug]/book/data";
import { BOOKING_COLUMNS, bookingEmail, emailTeacher, type Booking } from "@/lib/conference-bookings";
import { getOrigin } from "@/lib/data";
import { pause, sendEmail } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const TIME = /^\d{2}:\d{2}$/;

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

/** Step 1: meeting length, the gap between meetings and any breaks. */
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

  // Changed the day or hours here: move the event too (as Edit details does).
  // Booked meetings move with the day, and each family is emailed.
  let moved: Awaited<ReturnType<typeof emailMovedMeetings>> | null = null;
  const day = formData.get("conferenceDay");
  if (day !== null) {
    const date = String(day);
    const from = String(formData.get("startTime") ?? "");
    const to = String(formData.get("endTime") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the conference day." };
    if (!TIME.test(from) || !TIME.test(to)) return { error: "Pick when your first meeting starts and your last one ends." };
    if (to <= from) return { error: "Your last meeting has to end after the first one starts." };
    const supabase = await createClient();
    const { data: event } = await supabase.from("events").select("timezone, starts_on").eq("id", eventId).maybeSingle();
    if (!event) return { error: "Only the conference's host can change it." };
    const { error } = await supabase.rpc("reschedule_event", {
      p_event_id: eventId,
      p_starts_on: date,
      p_ends_on: date,
      p_window_start: zonedToUtc(date, from, event.timezone).toISOString(),
      p_window_end: zonedToUtc(date, to, event.timezone).toISOString(),
      p_timezone: event.timezone,
    });
    if (error) return { error: friendlyDbError(error) };
    if (date !== event.starts_on) moved = await emailMovedMeetings(eventId);
  }

  const error = await saveSettings(eventId, {
    meeting_minutes: meeting,
    gap_minutes: gap,
    breaks: breaks.sort((a, b) => a.start.localeCompare(b.start)),
    times_saved_at: new Date().toISOString(),
  });
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
 * room, or the teacher sends their own), or the family's choice. The school
 * goes on the event, so the public page and calendar invites show it; a
 * video-only conference has no address.
 */
export async function saveMeetingPlace(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const mode = String(formData.get("mode") ?? "") as MeetingMode;
  if (!["in_person", "video", "either"].includes(mode)) return { error: "Choose where you'll meet." };
  const inPerson = mode !== "video";
  const video = mode !== "in_person";

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
  const { data: booking } = await createAdminClient().from("conference_bookings").select(BOOKING_COLUMNS).eq("id", bookingId).single();
  const { data: deleted, error } = await supabase.from("conference_bookings").delete().eq("id", bookingId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!deleted?.length) return { error: "You don't have permission to do that." };

  let emailed = false;
  const conf = await loadConference({ id: eventId });
  if (booking && conf) {
    const b = booking as Booking;
    const origin = await getOrigin();
    const link = `${origin}/e/${conf.event.slug}/book`;
    emailed = true;
    for (const [i, p] of b.parents.entries()) {
      if (i) await pause();
      const message = bookingEmail("canceled", b, conf.event, conf.settings, conf.teacher, link, p, true);
      emailed = (await sendEmail({ to: p.email, ...message, replyTo: conf.teacher.email ?? undefined })) && emailed;
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
