import "server-only";
import { BOOKING_COLUMNS, bookingEmail, bookingLink, emailTeacher, type Booking, type BookingEvent, type Teacher } from "@/lib/conference-bookings";
import { DEFAULT_SETTINGS, SETTINGS_COLUMNS, type ConferenceSettings } from "@/lib/conferences";
import { getOrigin } from "@/lib/data";
import { pause, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";
import { utcToZonedDate } from "@/lib/time";

export type ConferenceEvent = BookingEvent & {
  id: string;
  slug: string;
  status: string;
  event_type: string;
  starts_on: string;
  window_start: string;
  window_end: string;
  public_notes: string | null;
};

const EVENT_COLUMNS = "id, slug, name, status, event_type, timezone, starts_on, window_start, window_end, venue_name, venue_address, public_notes, created_by";

/**
 * A conference as the server sees it: the event, its settings (with the video
 * link, so never hand these to the browser whole) and the teacher. Families
 * aren't signed in, so this reads with the server's key.
 */
export async function loadConference(by: { slug: string } | { id: string }) {
  const admin = createAdminClient();
  const q = admin.from("events").select(EVENT_COLUMNS);
  const { data: event } = await ("slug" in by ? q.eq("slug", by.slug) : q.eq("id", by.id)).maybeSingle();
  if (!event || event.event_type !== "conference") return null;
  const [{ data: settings }, { data: teacher }] = await Promise.all([
    admin.from("conference_settings").select(SETTINGS_COLUMNS).eq("event_id", event.id).maybeSingle(),
    event.created_by
      ? admin.from("profiles").select("full_name, email").eq("id", event.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const s = { ...DEFAULT_SETTINGS, ...(settings ?? {}) } as ConferenceSettings;
  const t: Teacher = { name: teacher?.full_name?.trim() || "Your teacher", email: teacher?.email ?? null };
  return { event: event as ConferenceEvent, settings: s, teacher: t };
}

/** A family's booking from their link. */
export async function loadBooking(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await createAdminClient()
    .from("conference_bookings")
    .select(`${BOOKING_COLUMNS}, event_id`)
    .eq("access_token", token)
    .maybeSingle();
  return data as (Booking & { event_id: string }) | null;
}

/**
 * After the teacher changes the conference's day, the database moves each
 * booking to the new day (20261210000000_conference_bookings_follow_day.sql).
 * Each family, and the teacher, gets an updated calendar invite. Returns how
 * many meetings moved and whether every email went.
 */
export async function emailMovedMeetings(eventId: string) {
  const conf = await loadConference({ id: eventId });
  if (!conf) return { moved: 0, allSent: true };
  const { data } = await createAdminClient()
    .from("conference_bookings")
    .select(`${BOOKING_COLUMNS}, access_token`)
    .eq("event_id", eventId)
    .order("starts_at");
  const bookings = ((data ?? []) as (Booking & { access_token: string })[]).filter(
    (b) => utcToZonedDate(b.starts_at, conf.event.timezone) === conf.event.starts_on,
  );
  const origin = await getOrigin();
  let allSent = true;
  for (const [i, b] of bookings.entries()) {
    if (i) await pause();
    const link = bookingLink(origin, conf.event.slug, b.access_token);
    for (const p of b.parents) {
      const message = bookingEmail("changed", b, conf.event, conf.settings, conf.teacher, link, p, true);
      allSent = (await sendEmail({ to: p.email, ...message, replyTo: conf.teacher.email ?? undefined })) && allSent;
      await pause();
    }
    await emailTeacher("changed", b, conf, origin, true);
  }
  return { moved: bookings.length, allSent };
}
