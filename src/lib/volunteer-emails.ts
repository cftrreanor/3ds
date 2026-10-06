import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout, pause, sendEmail, type CalendarInvite } from "@/lib/email";
import { buildIcs, googleCalendarUrl, type IcsEvent } from "@/lib/ics";
import { formatPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate, zoneName } from "@/lib/time";

/** One signup, with everything needed for its email and calendar invite. */
export type CalendarEntry = {
  assignment_id: string;
  manage_token: string;
  access_token: string;
  calendar_sequence: number;
  volunteer_name: string;
  volunteer_email: string;
  event_name: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string;
  station_name: string;
  station_location: string | null;
  instructions: string | null;
  shift_title: string;
  shift_description: string | null;
  starts_at: string;
  ends_at: string;
  lead_name: string | null;
  lead_phone: string | null;
};

/** Load signups for emailing. With bump, they're marked as a new calendar version first. */
export async function loadCalendarEntries(assignmentIds: string[], bump = false): Promise<CalendarEntry[]> {
  if (assignmentIds.length === 0) return [];
  const { data, error } = await createAdminClient().rpc("calendar_entries", {
    p_assignment_ids: assignmentIds,
    p_bump: bump,
  });
  if (error) {
    console.error("calendar_entries failed", error);
    return [];
  }
  // Walk-ups added at the desk have no email, so there's nothing to send them.
  return ((data ?? []) as CalendarEntry[]).filter((e) => e.volunteer_email);
}

export const manageUrl = (origin: string, e: { access_token: string }) => `${origin}/pass/${e.access_token}`;
export const icsDownloadUrl = (origin: string, manageToken: string) => `${origin}/cal/${manageToken}`;

export function toIcsEvent(e: CalendarEntry, origin: string): IcsEvent {
  const lead = e.lead_name ? `Lead: ${e.lead_name}${e.lead_phone ? `, ${formatPhone(e.lead_phone)}` : ""}` : null;
  return {
    uid: `${e.assignment_id}@fieldcommandevents.com`,
    timezone: e.timezone,
    sequence: e.calendar_sequence,
    start: new Date(e.starts_at),
    end: new Date(e.ends_at),
    summary: `Volunteer: ${e.station_name} (${e.event_name})`,
    location: [e.venue_name, e.venue_address].filter(Boolean).join(", "),
    description: [
      `${e.station_name}: ${e.shift_title}`,
      `When: ${formatDate(utcToZonedDate(e.starts_at, e.timezone))}, ${formatTimeRange(e.starts_at, e.ends_at, e.timezone)} (${zoneName(e.timezone)})`,
      e.station_location ? `Report to: ${e.station_location}` : null,
      e.shift_description,
      e.instructions,
      lead,
      `Manage or cancel: ${manageUrl(origin, e)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    url: manageUrl(origin, e),
    attendee: { name: e.volunteer_name, email: e.volunteer_email },
  };
}

function invite(method: "REQUEST" | "CANCEL", e: CalendarEntry, origin: string): CalendarInvite {
  return { method, content: buildIcs(method, toIcsEvent(e, origin)) };
}

const CALENDAR_TIP =
  "Use the calendar invite in this email (\u201cAdd to calendar\u201d, or \u201cYes\u201d in Gmail) and we'll keep that calendar entry up to date if anything changes. Copies added with the buttons below won't update on their own.";

function shiftRow(e: CalendarEntry, tz: string, origin: string, multiDay: boolean) {
  return {
    title: `${e.station_name}: ${e.shift_title}`,
    detail: [
      multiDay ? formatDate(utcToZonedDate(e.starts_at, tz), { year: undefined }) : formatDate(utcToZonedDate(e.starts_at, tz)),
      formatTimeRange(e.starts_at, e.ends_at, tz),
      e.station_location,
    ]
      .filter(Boolean)
      .join(" · "),
    links: [
      { label: "Add to Google Calendar", url: googleCalendarUrl(toIcsEvent(e, origin)) },
      { label: "Apple / Outlook calendar", url: icsDownloadUrl(origin, e.manage_token) },
    ],
  };
}

/**
 * The signup confirmation. Each email can carry one calendar invite, so a
 * single shift rides in the confirmation itself; with several shifts, the
 * confirmation lists them and each shift gets its own short invite email.
 */
export async function sendSignupConfirmation(
  entries: CalendarEntry[],
  tz: string,
  origin: string,
  multiDay: boolean,
  /** Other people signed up on the same shifts. */
  others: string[] = [],
) {
  if (entries.length === 0) return false;
  const first = entries[0];
  const single = entries.length === 1;
  const { html, text } = emailLayout({
    heading: `You're signed up for ${first.event_name}`,
    paragraphs: [
      `Thanks, ${first.volunteer_name.split(" ")[0]}! Here ${single ? "is your shift" : "are your shifts"}${first.venue_name ? ` at ${first.venue_name}` : ""}.`,
      ...(others.length ? [`Also signed up for ${single ? "this shift" : "these shifts"}: ${others.join(", ")}.`] : []),
      single
        ? CALENDAR_TIP
        : `We're sending a separate calendar invite for each shift. ${CALENDAR_TIP}`,
    ],
    rows: entries.map((e) => shiftRow(e, tz, origin, multiDay)),
    button: { label: "View or cancel my shifts", url: manageUrl(origin, first) },
    footer: `You're receiving this because you signed up to volunteer through ${brand.name}. This link is just for you; anyone you forward it to can view and cancel your shifts.`,
  });
  const sent = await sendEmail({
    to: first.volunteer_email,
    subject: `You're signed up: ${first.event_name}`,
    html,
    text,
    ...(single ? { invite: invite("REQUEST", first, origin) } : {}),
  });
  if (!single) {
    for (const e of entries) {
      await pause();
      const when = `${formatDate(utcToZonedDate(e.starts_at, tz), { year: undefined })}, ${formatTimeRange(e.starts_at, e.ends_at, tz)}`;
      const msg = emailLayout({
        heading: `Calendar invite: ${e.station_name}`,
        paragraphs: [`${e.event_name} · ${when}`, CALENDAR_TIP],
        button: { label: "View or cancel my shifts", url: manageUrl(origin, e) },
      });
      await sendEmail({
        to: e.volunteer_email,
        subject: `Calendar invite: ${e.station_name}, ${when}`,
        html: msg.html,
        text: msg.text,
        invite: invite("REQUEST", e, origin),
      });
    }
  }
  return sent;
}

/** Tell each volunteer their shift changed and update their calendar. */
export async function sendShiftUpdates(entries: CalendarEntry[], tz: string, origin: string) {
  for (const e of entries) {
    const { html, text } = emailLayout({
      heading: "Your volunteer shift changed",
      paragraphs: [
        `Hi ${e.volunteer_name.split(" ")[0]}, the organizers of ${e.event_name} updated your shift. Here are the new details.`,
        "If you added our calendar invite, it updates automatically. If you added the shift with a button or download, please update that calendar entry yourself.",
      ],
      rows: [shiftRow(e, tz, origin, false)],
      button: { label: "View or cancel my shifts", url: manageUrl(origin, e) },
    });
    await sendEmail({
      to: e.volunteer_email,
      subject: `Updated: your shift at ${e.event_name}`,
      html,
      text,
      invite: invite("REQUEST", e, origin),
    });
    await pause();
  }
}

/** Confirm a cancellation and remove the event from their calendar. */
export async function sendCancellation(e: CalendarEntry, tz: string, origin: string, signupUrl: string | null = null) {
  const { html, text } = emailLayout({
    heading: "Your shift was cancelled",
    paragraphs: [
      `Hi ${e.volunteer_name.split(" ")[0]}, you're no longer signed up for ${e.station_name} (${formatTimeRange(e.starts_at, e.ends_at, tz)}) at ${e.event_name}.`,
      "If you added our calendar invite, it will be removed from your calendar (in Gmail, you may need to open this email first). If you added the shift with a button or download, please delete it from your calendar.",
      signupUrl
        ? "Changed your mind, or want a different time? Signup is still open."
        : "Thanks for letting the organizers know.",
    ],
    button: signupUrl
      ? { label: "Sign up for more shifts", url: signupUrl }
      : { label: "View my other shifts", url: manageUrl(origin, e) },
  });
  return sendEmail({
    to: e.volunteer_email,
    subject: `Cancelled: your shift at ${e.event_name}`,
    html,
    text,
    invite: invite("CANCEL", { ...e, calendar_sequence: e.calendar_sequence + 1 }, origin),
  });
}
