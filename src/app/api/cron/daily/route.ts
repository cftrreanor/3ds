import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { getOrigin } from "@/lib/data";
import { pause, sendEmail } from "@/lib/email";
import { bookingEmail, bookingLink, withCallPhone, type Booking } from "@/lib/conference-bookings";
import { loadConferenceSettings } from "@/lib/conference-settings";
import { adultNames, parentEmail, parentLink, type Child } from "@/lib/parents";
import { runRetention } from "@/lib/retention";
import { createAdminClient } from "@/lib/supabase/server";
import { isSchemaError } from "@/lib/schema-check";
import { loadCalendarEntries, sendShiftReminder } from "@/lib/volunteer-emails";
import { utcToZonedDate } from "@/lib/time";

// Once a day (vercel.json): remind parents to bring their photo ID the day
// before a school visitor event, remind volunteers of their shifts the day
// before, erase parent registrations 30 days after
// their event, volunteers 10 days after theirs, and old admin email records,
// and run the rest of the privacy policy's deletion schedule (lib/retention).
// Vercel calls it with the CRON_SECRET environment variable.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  // Compared in constant time, so response timing can't reveal the secret bit by bit.
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Sentry expects a check-in every day and alerts if the job fails or never runs.
  return Sentry.withMonitor("daily-job", runDailyJob, {
    schedule: { type: "crontab", value: "0 15 * * *" },
    timezone: "UTC",
    checkinMargin: 60,
    maxRuntime: 10,
  });
}

async function runDailyJob() {
  const admin = createAdminClient();
  const started = Date.now();

  const { data: purged, error: purgeError } = await admin.rpc("purge_parent_registrations");
  if (purgeError) console.error("purge_parent_registrations failed", purgeError);
  // Conference bookings (children's names, parents' notes) 30 days after the conference.
  const { data: bookingsPurged, error: bookingPurgeError } = await admin.rpc("purge_conference_bookings");
  if (bookingPurgeError && !isSchemaError(bookingPurgeError)) console.error("purge_conference_bookings failed", bookingPurgeError);
  // Volunteers' details (and under-18 helpers) are deleted 10 days after the event.
  const { data: volunteersPurged, error: volunteerPurgeError } = await admin.rpc("purge_volunteers");
  if (volunteerPurgeError) console.error("purge_volunteers failed", volunteerPurgeError);
  // The admin email log: 14 days for people without an account, 180 for everyone.
  const { data: emailsPurged, error: adminPurgeError } = await admin.rpc("purge_admin_records");
  if (adminPurgeError) console.error("purge_admin_records failed", adminPurgeError);
  const retention = await runRetention(admin);
  // Invitation send records (for the hourly limit) after a day.
  const { error: sendsPurgeError } = await admin.rpc("purge_invitation_sends");
  if (sendsPurgeError && !isSchemaError(sendsPurgeError)) console.error("purge_invitation_sends failed", sendsPurgeError);

  // Events starting tomorrow in their own time zone (look a day either side, then check).
  const shift = (days: number) => new Date(started + days * 86_400_000).toISOString().slice(0, 10);
  const { data: events, error: eventsError } = await admin
    .from("events")
    .select("id, slug, name, starts_on, ends_on, window_start, window_end, timezone, venue_name, venue_address")
    .eq("event_type", "school_visit")
    .eq("status", "published")
    .gte("starts_on", shift(0))
    .lte("starts_on", shift(2));
  if (eventsError) console.error("Daily job: events lookup failed", eventsError);
  const tomorrow = (events ?? []).filter((e) => {
    const local = utcToZonedDate(new Date(started).toISOString(), e.timezone);
    const next = new Date(`${local}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return e.starts_on === next.toISOString().slice(0, 10);
  });

  // Vercel sets this to the site's main address (the custom domain, once there is one).
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = production ? `https://${production}` : await getOrigin();
  let reminded = 0;
  let unsent = 0;
  for (const event of tomorrow) {
    const { data: regs } = await admin
      .from("parent_registrations")
      .select("id, parent_name, email, children, other_adults, access_token, calendar_sequence")
      .eq("event_id", event.id)
      .is("reminded_at", null);
    for (const r of regs ?? []) {
      // Leave time to finish; whoever's left is counted as unsent.
      if (Date.now() - started > 270_000) {
        unsent++;
        continue;
      }
      const { subject, html, text } = parentEmail(
        "reminder",
        { ...r, children: r.children as Child[], other_adults: adultNames(r.other_adults) },
        event,
        parentLink(origin, event.slug, r.access_token),
      );
      if (await sendEmail({ to: r.email, subject, html, text, eventId: event.id })) {
        await admin.from("parent_registrations").update({ reminded_at: new Date().toISOString() }).eq("id", r.id);
        reminded++;
      } else {
        unsent++;
      }
      await pause();
    }
  }
  if (unsent) console.error(`Daily job: ${unsent} parent reminder(s) not sent`);

  // Parent-teacher conferences: remind every parent on each meeting that's
  // tomorrow in the conference's time zone (a conference day, or any day of
  // weekly hours).
  let conferencesReminded = 0;
  let conferencesUnsent = 0;
  const { data: confEvents } = await admin
    .from("events")
    .select("id, slug, name, starts_on, ends_on, timezone, venue_name, venue_address, created_by")
    .eq("event_type", "conference")
    .eq("status", "published")
    .lte("starts_on", shift(2))
    .gte("ends_on", shift(0));
  for (const event of confEvents ?? []) {
    const local = utcToZonedDate(new Date(started).toISOString(), event.timezone);
    const next = new Date(`${local}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const tomorrow = next.toISOString().slice(0, 10);
    const { data: due } = await withCallPhone((columns) =>
      admin
        .from("conference_bookings")
        .select(`${columns}, access_token`)
        .eq("event_id", event.id)
        .is("reminded_at", null)
        .gte("starts_at", new Date(started).toISOString())
        .lte("starts_at", new Date(started + 2 * 86_400_000).toISOString()),
    );
    const bookings = ((due ?? []) as unknown as (Booking & { access_token: string })[]).filter(
      (b) => utcToZonedDate(b.starts_at, event.timezone) === tomorrow,
    );
    if (!bookings.length) continue;
    const [{ settings: s }, { data: teacherRow }] = await Promise.all([
      loadConferenceSettings(admin, event.id),
      event.created_by ? admin.from("profiles").select("full_name, email").eq("id", event.created_by).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const teacher = { name: teacherRow?.full_name?.trim() || "Your teacher", email: teacherRow?.email ?? null };
    for (const b of bookings) {
      if (Date.now() - started > 270_000) {
        conferencesUnsent++;
        continue;
      }
      let all = true;
      for (const p of b.parents) {
        const message = bookingEmail("reminder", b, event, s, teacher, bookingLink(origin, event.slug, b.access_token), p);
        all = (await sendEmail({ to: p.email, ...message, eventId: event.id })) && all;
        await pause();
      }
      if (all) {
        await admin.from("conference_bookings").update({ reminded_at: new Date().toISOString() }).eq("id", b.id);
        conferencesReminded++;
      } else {
        conferencesUnsent++;
      }
    }
  }
  if (conferencesUnsent) console.error(`Daily job: ${conferencesUnsent} conference reminder(s) not sent`);

  // Volunteers: shifts that start tomorrow in their event's time zone, at published events.
  let volunteersReminded = 0;
  let volunteersUnsent = 0;
  const { data: soon, error: shiftsError } = await admin
    .from("shifts")
    .select("id, starts_at, events!inner(timezone, status)")
    .eq("events.status", "published")
    .gte("starts_at", new Date(started).toISOString())
    .lte("starts_at", new Date(started + 2 * 86_400_000).toISOString());
  if (shiftsError) console.error("Daily job: shifts lookup failed", shiftsError);
  const tomorrowShifts = ((soon ?? []) as unknown as { id: string; starts_at: string; events: { timezone: string } }[]).filter((sh) => {
    const tz = sh.events.timezone;
    const local = utcToZonedDate(new Date(started).toISOString(), tz);
    const next = new Date(`${local}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return utcToZonedDate(sh.starts_at, tz) === next.toISOString().slice(0, 10);
  });
  if (tomorrowShifts.length) {
    const { data: due, error: dueError } = await admin
      .from("volunteer_assignments")
      .select("id")
      .in("shift_id", tomorrowShifts.map((sh) => sh.id))
      .is("reminded_at", null);
    // Before 20261116000000_volunteer_reminders.sql there's nothing to track reminders with.
    if (dueError && !isSchemaError(dueError)) console.error("Daily job: volunteer lookup failed", dueError);
    const entries = await loadCalendarEntries((due ?? []).map((a) => a.id));
    const byPerson = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = `${e.volunteer_email.toLowerCase()}|${e.event_name}`;
      byPerson.set(key, [...(byPerson.get(key) ?? []), e]);
    }
    for (const list of byPerson.values()) {
      if (Date.now() - started > 270_000) {
        volunteersUnsent += list.length;
        continue;
      }
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      if (await sendShiftReminder(list, list[0].timezone, origin)) {
        await admin
          .from("volunteer_assignments")
          .update({ reminded_at: new Date().toISOString() })
          .in("id", list.map((e) => e.assignment_id));
        volunteersReminded++;
      } else {
        volunteersUnsent++;
      }
      await pause();
    }
  }
  if (volunteersUnsent) console.error(`Daily job: ${volunteersUnsent} volunteer reminder(s) not sent`);

  return NextResponse.json({
    purged: purged ?? 0,
    bookingsPurged: bookingsPurged ?? 0,
    conferencesReminded,
    conferencesUnsent,
    volunteersPurged: volunteersPurged ?? 0,
    emailsPurged: emailsPurged ?? 0,
    ...retention,
    reminded,
    unsent,
    volunteersReminded,
    volunteersUnsent,
  });
}
