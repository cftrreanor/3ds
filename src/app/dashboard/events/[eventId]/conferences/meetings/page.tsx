import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { BOOKING_COLUMNS, type Booking } from "@/lib/conference-bookings";
import { DEFAULT_SETTINGS, meetingStarts, SETTINGS_COLUMNS, type ConferenceSettings } from "@/lib/conferences";
import { getEventAccess } from "@/lib/data";
import { hasConferences } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { displayTime, toMinutes, toTime } from "@/lib/schedule";
import { isSchemaError, missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { conferenceBookedCount, isConferenceTeacher } from "@/lib/conference-access";
import { NotTheTeacher } from "./not-teacher";
import { formatDate, utcToZonedDate, utcToZonedTime, zoneName } from "@/lib/time";
import { cancelMeeting, setMeetingOutcome } from "../actions";
import { MeetingList, type MeetingRow, type Outcome } from "./meeting-list";

export const metadata: Metadata = { title: "Your meetings" };

/**
 * The teacher's booked meetings, in time order: who's coming, how to reach
 * them, and their notes. Only the teacher can see this page (and the database
 * only lets them read their own bookings).
 */
export default async function MeetingsPage({ params }: PageProps<"/dashboard/events/[eventId]/conferences/meetings">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  if (!access.isHost) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, event_type, timezone, starts_on, window_start, window_end")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  if (!hasConferences(event.event_type)) redirect(`/dashboard/events/${eventId}`);
  if (!(await isConferenceTeacher(supabase, eventId))) return <NotTheTeacher eventId={eventId} booked={await conferenceBookedCount(supabase, eventId)} />;

  const columns = BOOKING_COLUMNS.replace(", calendar_sequence", "");
  const loadBookings = (extra: string) =>
    supabase
      .from("conference_bookings")
      .select(columns + extra)
      .eq("event_id", eventId)
      .order("starts_at");
  const [{ data: saved, error: settingsError }, withOutcomes] = await Promise.all([
    supabase.from("conference_settings").select(SETTINGS_COLUMNS).eq("event_id", eventId).maybeSingle(),
    loadBookings(", outcome"),
  ]);
  // Met / No-show needs the conference outcomes update (20261130000000); until then the list works without it.
  const outcomesReady = !isSchemaError(withOutcomes.error);
  const { data: bookingRows, error: bookingsError } = outcomesReady ? withOutcomes : await loadBookings("");
  if (settingsError || bookingsError) missing();
  const settings: ConferenceSettings = {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
    breaks: saved?.breaks ?? [],
  };
  const bookings = (bookingRows ?? []) as unknown as (Omit<Booking, "calendar_sequence"> & { outcome?: Outcome })[];

  const tz = event.timezone;
  const len = settings.meeting_minutes;
  const starts = meetingStarts(utcToZonedTime(event.window_start, tz), utcToZonedTime(event.window_end, tz), settings);
  const byTime = new Map(bookings.map((b) => [utcToZonedTime(b.starts_at, tz), b]));
  // Every meeting time, plus any booking at a time that's since been taken out of the hours.
  const times = [...new Set([...starts, ...byTime.keys()])].sort();

  const nowIso = new Date().toISOString();
  const today = utcToZonedDate(nowIso, tz);
  const isToday = today === event.starts_on;
  const isOver = today > event.starts_on;
  const now = toMinutes(utcToZonedTime(nowIso, tz));
  const nextBooked = isToday ? times.find((t) => toMinutes(t) > now && byTime.has(t)) : undefined;
  const range = (start: string, minutes: number) => `${displayTime(start)} – ${displayTime(toTime(toMinutes(start) + minutes))}`;
  const showMode = settings.meeting_mode === "either";

  const meetings: MeetingRow[] = times.map((t) => {
    const b = byTime.get(t);
    const m = toMinutes(t);
    const status = isOver ? "past" : !isToday ? null : m + len <= now ? "past" : m <= now ? "now" : t === nextBooked ? "next" : null;
    return {
      kind: "meeting",
      key: t,
      time: range(t, len),
      over: isOver || (isToday && m + len <= now),
      status: b ? status : null,
      booking: b
        ? {
            id: b.id,
            child: b.child_name,
            parents: b.parents.map((p) => ({
              name: p.name,
              email: p.email,
              phone: p.phone,
              phoneDisplay: p.phone ? formatPhone(p.phone) : null,
            })),
            mode: showMode ? (b.meeting_mode === "video" ? "Video" : "In person") : null,
            note: b.note,
            cancel: cancelMeeting.bind(null, eventId, b.id),
            // The real start, as Met / No-show checks it (not just the time of day).
            started: Date.parse(b.starts_at) <= Date.parse(nowIso),
            outcome: outcomesReady ? (b.outcome ?? null) : undefined,
            setOutcome: setMeetingOutcome.bind(null, eventId, b.id),
          }
        : null,
    };
  });
  const breaks: MeetingRow[] = settings.breaks
    .filter((b) => b.start && b.minutes > 0)
    .map((b) => ({
      kind: "break",
      key: `break-${b.start}`,
      time: range(b.start, b.minutes),
      over: isOver || (isToday && toMinutes(b.start) + b.minutes <= now),
      label: b.label?.trim() || "Break",
    }));
  const rows = [...meetings, ...breaks].sort((a, b) => toMinutes(a.key.replace("break-", "")) - toMinutes(b.key.replace("break-", "")));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground print:hidden">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Your meetings</h1>
      <p className="mt-2 text-muted">
        {event.name} · {formatDate(event.starts_on)} · All times are {zoneName(tz)}.
      </p>
      {isToday && <AutoRefresh status className="mt-1" />}

      {!saved?.times_saved_at ? (
        <p className="mt-6">
          Set your meeting times first.{" "}
          <Link href={`/dashboard/events/${eventId}/conferences`} className="font-medium text-brand underline">
            Conference Setup
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {event.status !== "published" && bookings.length === 0 && (
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
              Families can book once you publish your conference.{" "}
              <Link href={`/dashboard/events/${eventId}/conferences`} className="font-medium text-brand underline">
                Conference Setup
              </Link>
            </p>
          )}
          <MeetingList
            rows={rows}
            booked={bookings.length}
            total={starts.length}
            summaryHref={`/dashboard/events/${eventId}/conferences/meetings/summary`}
          />
        </div>
      )}

      <p className="mt-8 text-sm text-muted print:hidden">
        Only you can see these families and their notes. Everything is deleted 30 days after your conference.
      </p>
    </div>
  );
}
