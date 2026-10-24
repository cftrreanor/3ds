import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout, sendEmail, type CalendarInvite } from "@/lib/email";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import type { ConferenceSettings } from "@/lib/conferences";
import { formatPhone } from "@/lib/phone";
import { isSchemaError } from "@/lib/schema-check";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";

// Parent-teacher conferences: a family's booked meeting, and the emails each
// parent on it gets (supabase/migrations/20261124000000_conference_bookings.sql).
// Bookings are erased 30 days after the conference.

export type BookingParent = { name: string; email: string; phone: string | null };

export type Booking = {
  id: string;
  starts_at: string;
  /** Null when the teacher doesn't ask for the child's name (20261219000000). */
  child_name: string | null;
  parents: BookingParent[];
  meeting_mode: "in_person" | "video" | "phone";
  note: string | null;
  calendar_sequence: number;
  /** Phone calls: the number the teacher calls (read with withCallPhone). */
  call_phone?: string | null;
};

export type BookingEvent = {
  name: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string;
};

/** The teacher, as families see them: their name, and an email to reply to. */
export type Teacher = { name: string; email: string | null };

export const BOOKING_COLUMNS = "id, starts_at, child_name, parents, meeting_mode, note, calendar_sequence";

/**
 * Reads bookings with the number to call for phone calls. Before the weekly
 * hours update (20261211000000) there's no such column (and no phone calls),
 * so it reads without it. `run` gets the columns to select.
 */
export async function withCallPhone<T extends { error: { code?: string } | null }>(run: (columns: string) => PromiseLike<T>): Promise<T> {
  const r = await run(`${BOOKING_COLUMNS}, call_phone`);
  return isSchemaError(r.error) ? run(BOOKING_COLUMNS) : r;
}

/** The privacy promise, in one line (emails). The pages show it in full (book/privacy-note). */
export const privacyLine = (teacher: Teacher, weekly = false, child = true) =>
  `Only ${teacher.name} sees ${child ? "your child's name, " : ""}your details, and your note. Other families never see who booked. Everything is deleted 30 days after ${weekly ? "your meeting" : "the conference"}.`;

/** A family's link to see, change or cancel their meeting. */
export const bookingLink = (origin: string, slug: string, token: string) => `${origin}/e/${slug}/book/r/${token}`;

export const meetingEnd = (startsAt: string, minutes: number) => new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();

/** "Fri, Oct 23 · 3:20 – 3:35 PM" */
export function meetingWhen(startsAt: string, minutes: number, tz: string) {
  return `${formatDate(utcToZonedDate(startsAt, tz), { year: undefined })} · ${formatTimeRange(startsAt, meetingEnd(startsAt, minutes), tz)}`;
}

/** What the family is called (in the waiting room, and to the teacher): by the child, or with no child's name, the first parent. */
export const familyName = (b: Pick<Booking, "child_name" | "parents">) => `${b.child_name ?? b.parents[0]?.name ?? "Your"}'s family`;

/** Where they'll meet and how they'll be let in, as short lines for emails and the family's page. */
export function meetingPlace(b: Pick<Booking, "meeting_mode" | "child_name" | "parents" | "call_phone">, event: BookingEvent, s: ConferenceSettings, teacher: Teacher) {
  if (b.meeting_mode === "phone") {
    return {
      title: "Phone call",
      lines: [
        `${teacher.name} will call you at ${formatPhone(b.call_phone) || "the number you gave"}. Please keep your phone nearby.`,
        "The call may come from a school or private number.",
      ],
      link: null as string | null,
    };
  }
  if (b.meeting_mode === "in_person") {
    const school = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
    return {
      title: "In person",
      lines: [
        [s.room, school].filter(Boolean).join(" · "),
        `Please wait outside the room. ${teacher.name} will invite you in when they're ready for you.`,
      ],
      link: null as string | null,
    };
  }
  if (s.own_link || !s.video_link) {
    return {
      title: "Video",
      lines: [`${teacher.name} will send you the video link in a calendar invite before your meeting.`],
      link: null,
    };
  }
  return {
    title: "Video",
    lines: [
      `Join a minute or two early, using “${familyName(b)}” as your name so ${teacher.name} knows who you are.`,
      "You'll wait in a waiting room until you're let in. If the meeting before yours runs over, please stay put: you'll be brought in as soon as they're ready.",
    ],
    link: s.video_link,
  };
}

function toIcsEvent(b: Booking, event: BookingEvent, s: ConferenceSettings, teacher: Teacher, link: string, to: BookingParent): IcsEvent {
  const place = meetingPlace(b, event, s, teacher);
  return {
    uid: `conference-${b.id}@fieldcommandevents.com`,
    timezone: event.timezone,
    sequence: b.calendar_sequence,
    start: new Date(b.starts_at),
    end: new Date(meetingEnd(b.starts_at, s.meeting_minutes)),
    summary: b.child_name ? `Conference with ${teacher.name}: ${b.child_name}` : `Conference with ${teacher.name}`,
    location: place.link ?? (b.meeting_mode === "in_person" ? place.lines[0] : b.meeting_mode === "phone" ? `${teacher.name} calls you` : "Video"),
    description: [...place.lines, ...(place.link ? [`Join: ${place.link}`] : []), `Change or cancel: ${link}`].join("\n"),
    url: link,
    attendee: { name: to.name, email: to.email },
    alarm: place.link ? `Join as ${familyName(b)}` : `Conference with ${teacher.name}`,
  };
}

const invite = (method: "REQUEST" | "CANCEL", ...args: Parameters<typeof toIcsEvent>): CalendarInvite => ({
  method,
  content: buildIcs(method, toIcsEvent(...args), brand.name),
});

/**
 * One parent's email: the confirmation (with a calendar invite), a changed
 * time (an updated invite), the reminder the day before, or the cancellation
 * (removes the invite).
 */
export function bookingEmail(
  kind: "confirmation" | "changed" | "reminder" | "canceled",
  b: Booking,
  event: BookingEvent,
  s: ConferenceSettings,
  teacher: Teacher,
  link: string,
  to: BookingParent,
  /** The teacher canceled it, or moved the conference to a new day (not the family). */
  byTeacher = false,
) {
  const when = meetingWhen(b.starts_at, s.meeting_minutes, event.timezone);
  const place = meetingPlace(b, event, s, teacher);
  const first = to.name.split(" ")[0];
  const footer = `Sent by ${brand.name} for ${teacher.name}.`;
  const about = b.child_name ? ` about ${b.child_name}` : "";
  const forChild = b.child_name ? ` for ${b.child_name}` : "";
  const details = b.child_name ? "your child's name, your contact details, and your note" : "your contact details and your note";
  // Subjects never name the child: our sent-email log keeps subjects (lib/email), and the child's name is only kept 30 days.

  if (kind === "canceled") {
    return {
      subject: `Canceled: your conference with ${teacher.name}`,
      ...emailLayout({
        heading: byTeacher ? `${teacher.name} canceled your conference` : "Your conference was canceled",
        paragraphs: [
          byTeacher
            ? `Hi ${first}, ${teacher.name} had to cancel the conference${forChild} (${when}). Your booking details (${details}) have been deleted. You're welcome to book another open time.`
            : `Hi ${first}, the conference${forChild} with ${teacher.name} (${when}) is canceled, and your booking details (${details}) have been deleted.`,
          "If you added our calendar invite, it will be removed from your calendar (in Gmail, you may need to open this email first).",
        ],
        button: { label: "Book another time", url: link },
        footer,
      }),
      invite: invite("CANCEL", { ...b, calendar_sequence: b.calendar_sequence + 1 }, event, s, teacher, link, to),
    };
  }

  const moved = kind === "changed" && byTeacher;
  const heading =
    kind === "confirmation"
      ? "Your conference is booked"
      : moved
        ? `${teacher.name} moved your conference to a new day`
        : kind === "changed"
          ? "Your conference was changed"
          : "Your conference is tomorrow";
  const subject =
    kind === "confirmation"
      ? `Booked: your conference with ${teacher.name}, ${when}`
      : kind === "changed"
        ? `${moved ? "New day" : "New time"}: your conference with ${teacher.name}, ${when}`
        : `Tomorrow: your conference with ${teacher.name}, ${when}`;
  return {
    subject,
    ...emailLayout({
      heading,
      paragraphs: [
        kind === "reminder"
          ? `Hi ${first}, a reminder that you're meeting ${teacher.name}${about} tomorrow (${event.name}).`
          : moved
            ? `Hi ${first}, ${teacher.name} moved ${event.name} to a new day. Your meeting${about} is at the same time of day, on the day below.`
            : `Hi ${first}, you're booked to meet ${teacher.name}${about} (${event.name}).`,
        ...(moved ? ["If the new day doesn't work for you, use the button below to pick another time or cancel."] : []),
        ...(kind !== "reminder" ? [moved ? "An updated calendar invite is attached, so your calendar shows the new day." : "A calendar invite is attached, so it's on your calendar with the details."] : []),
      ],
      rows: [
        { title: "When", detail: when, strong: true },
        { title: place.title, detail: place.lines.join(" ") },
        ...(b.parents.length > 1 ? [{ title: b.meeting_mode === "phone" ? "On the call" : "Coming", detail: b.parents.map((p) => p.name).join(", ") }] : []),
        { title: b.child_name ? "Your child's privacy" : "Your privacy", detail: privacyLine(teacher, s.schedule === "weekly", Boolean(b.child_name)) },
      ],
      // On video, joining is what they'll need most, so it gets the button.
      ...(place.link
        ? { button: { label: "Join the meeting", url: place.link }, link: { label: "Change or cancel", url: link } }
        : { button: { label: "Change or cancel", url: link } }),
      footer,
      preheader: `${when} · ${place.title} with ${teacher.name}`,
    }),
    ...(kind !== "reminder" ? { invite: invite("REQUEST", b, event, s, teacher, link, to) } : {}),
  };
}

/** This meeting on the teacher's Meetings page (meeting-list.tsx gives each one this id). */
export const meetingAnchor = (meetings: string, bookingId: string) => `${meetings}#meeting-${bookingId}`;

/** "Liam Patel" → "Liam P.": enough for the teacher's calendar, which others may be able to see. */
export const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};

/** For the teacher: "Call (512) 555-0101". */
const callLine = (b: Pick<Booking, "call_phone">) => (b.call_phone ? `Call ${formatPhone(b.call_phone)}` : "Phone call");

/** The meeting on the teacher's own calendar. Its own UID, so it never collides with a parent's copy. */
function teacherIcsEvent(b: Booking, event: BookingEvent, s: ConferenceSettings, teacher: Teacher, meetings: string): IcsEvent {
  const place = meetingPlace(b, event, s, teacher);
  const who = `${shortName(b.child_name ?? b.parents[0]?.name ?? "A")}'s family`;
  const mark = meetingAnchor(meetings, b.id);
  return {
    uid: `conference-${b.id}-teacher@fieldcommandevents.com`,
    timezone: event.timezone,
    sequence: b.calendar_sequence,
    start: new Date(b.starts_at),
    end: new Date(meetingEnd(b.starts_at, s.meeting_minutes)),
    summary: `Conference: ${who}`,
    location: place.link ?? (b.meeting_mode === "in_person" ? place.lines[0] : b.meeting_mode === "phone" ? callLine(b) : "Video"),
    description: [
      `${who} · ${b.meeting_mode === "phone" ? callLine(b) : place.title}`,
      `Mark Met or No-show after the meeting: ${mark}`,
    ].join("\n"),
    url: mark,
    attendee: teacher.email ? { name: teacher.name, email: teacher.email } : undefined,
    // Meetings run back to back: an alarm before each one would be noise.
    alarm: false,
  };
}

/**
 * The teacher's email when a family books, changes or cancels: with a
 * calendar invite that adds, moves or removes the meeting on their calendar.
 */
export function teacherBookingEmail(
  kind: "booked" | "changed" | "canceled",
  b: Booking,
  event: BookingEvent,
  s: ConferenceSettings,
  teacher: Teacher,
  /** Their Meetings page. */
  meetings: string,
  /** The teacher canceled it, or moved the conference to a new day, themselves. */
  byTeacher = false,
) {
  const when = meetingWhen(b.starts_at, s.meeting_minutes, event.timezone);
  const place = meetingPlace(b, event, s, teacher);
  const family = familyName(b);
  const footer = `Sent by ${brand.name}. Every booking is also on your Meetings page.`;
  // Subjects never name the child (see bookingEmail).
  const subject =
    kind === "booked"
      ? `New conference booked: ${when}`
      : kind === "changed"
        ? `${byTeacher ? "Conference moved" : "Conference changed"}: ${when}`
        : byTeacher
          ? `You canceled a conference: ${when}`
          : `Canceled conference: ${when}`;
  const ics = (method: "REQUEST" | "CANCEL", seq: number): CalendarInvite => ({
    method,
    content: buildIcs(method, teacherIcsEvent({ ...b, calendar_sequence: seq }, event, s, teacher, meetings), brand.name),
  });

  if (kind === "canceled") {
    return {
      subject,
      ...emailLayout({
        heading: byTeacher ? "You canceled a conference" : "A family canceled their conference",
        paragraphs: [
          byTeacher
            ? `You canceled the conference with ${family} (${when}). We emailed the family, and the time is open again.`
            : `${family} canceled their conference (${when}). The time is open again.`,
          "This email takes it off your calendar (in Gmail, you may need to open it first).",
        ],
        button: { label: "Open your Meetings page", url: meetings },
        footer,
      }),
      invite: ics("CANCEL", b.calendar_sequence + 1),
    };
  }

  return {
    subject,
    ...emailLayout({
      heading: kind === "booked" ? "A family booked a conference" : byTeacher ? "A conference moved to your new day" : "A family changed their conference",
      paragraphs: [
        kind === "booked"
          ? `${family} booked a conference with you (${event.name}). A calendar invite is attached, so it's on your calendar.`
          : byTeacher
            ? `You moved ${event.name} to a new day, so ${family}'s meeting moved with it, at the same time of day. We emailed the family, and your calendar invite is updated.`
            : `${family} changed their conference. The details below are current, and your calendar invite is updated.`,
        "After the meeting, mark it Met or No-show on your Meetings page, so your records are complete.",
      ],
      rows: [
        { title: "When", detail: when, strong: true },
        {
          title: place.title,
          detail:
            b.meeting_mode === "in_person"
              ? place.lines[0] || "Your room"
              : b.meeting_mode === "phone"
                ? callLine(b)
                : s.own_link || !s.video_link
                  ? "You send the family your video link"
                  : s.video_link,
        },
        { title: b.meeting_mode === "phone" ? "On the call" : "Coming", detail: b.parents.map((p) => p.name).join(", ") },
        ...(b.note ? [{ title: "Their note", detail: "They left you a note. It's on your Meetings page." }] : []),
      ],
      button: { label: "Open your Meetings page", url: meetingAnchor(meetings, b.id) },
      footer,
      preheader: `${when} · ${b.parents.map((p) => p.name).join(", ")}`,
    }),
    invite: ics("REQUEST", b.calendar_sequence),
  };
}

/** Emails the teacher (the conference's creator), if they have an email. True if it went. */
export async function emailTeacher(
  kind: Parameters<typeof teacherBookingEmail>[0],
  b: Booking,
  conf: { event: BookingEvent & { id: string }; settings: ConferenceSettings; teacher: Teacher },
  origin: string,
  byTeacher = false,
) {
  if (!conf.teacher.email) return false;
  const meetings = `${origin}/dashboard/events/${conf.event.id}/conferences/meetings`;
  return sendEmail({ to: conf.teacher.email, ...teacherBookingEmail(kind, b, conf.event, conf.settings, conf.teacher, meetings, byTeacher) });
}
