import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout, type CalendarInvite } from "@/lib/email";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import type { ConferenceSettings } from "@/lib/conferences";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";

// Parent-teacher conferences: a family's booked meeting, and the emails each
// parent on it gets (supabase/migrations/20261124000000_conference_bookings.sql).
// Bookings are erased 30 days after the conference.

export type BookingParent = { name: string; email: string; phone: string | null };

export type Booking = {
  id: string;
  starts_at: string;
  child_name: string;
  parents: BookingParent[];
  meeting_mode: "in_person" | "video";
  note: string | null;
  calendar_sequence: number;
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

/** A family's link to see, change or cancel their meeting. */
export const bookingLink = (origin: string, slug: string, token: string) => `${origin}/e/${slug}/book/r/${token}`;

export const meetingEnd = (startsAt: string, minutes: number) => new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();

/** "Fri, Oct 23 · 3:20 – 3:35 PM" */
export function meetingWhen(startsAt: string, minutes: number, tz: string) {
  return `${formatDate(utcToZonedDate(startsAt, tz), { year: undefined })} · ${formatTimeRange(startsAt, meetingEnd(startsAt, minutes), tz)}`;
}

/** What the family is called in the waiting room, so the teacher knows who's there. */
export const familyName = (child: string) => `${child}'s family`;

/** Where they'll meet and how they'll be let in, as short lines for emails and the family's page. */
export function meetingPlace(b: Pick<Booking, "meeting_mode" | "child_name">, event: BookingEvent, s: ConferenceSettings, teacher: Teacher) {
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
      `Join a minute or two early, using “${familyName(b.child_name)}” as your name so ${teacher.name} knows who you are.`,
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
    summary: `Conference with ${teacher.name}: ${b.child_name}`,
    location: place.link ?? (b.meeting_mode === "in_person" ? place.lines[0] : "Video"),
    description: [...place.lines, ...(place.link ? [`Join: ${place.link}`] : []), `Change or cancel: ${link}`].join("\n"),
    url: link,
    attendee: { name: to.name, email: to.email },
    alarm: place.link ? `Join as ${familyName(b.child_name)}` : `Conference with ${teacher.name}`,
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
) {
  const when = meetingWhen(b.starts_at, s.meeting_minutes, event.timezone);
  const place = meetingPlace(b, event, s, teacher);
  const first = to.name.split(" ")[0];
  const footer = `Sent by ${brand.name} for ${teacher.name}. Your child's name and your note are deleted 30 days after the conference.`;

  if (kind === "canceled") {
    return {
      subject: `Canceled: conference for ${b.child_name}`,
      ...emailLayout({
        heading: "Your conference was canceled",
        paragraphs: [
          `Hi ${first}, the conference for ${b.child_name} with ${teacher.name} (${when}) is canceled.`,
          "If you added our calendar invite, it will be removed from your calendar (in Gmail, you may need to open this email first).",
        ],
        button: { label: "Book another time", url: link },
        footer,
      }),
      invite: invite("CANCEL", { ...b, calendar_sequence: b.calendar_sequence + 1 }, event, s, teacher, link, to),
    };
  }

  const heading = kind === "confirmation" ? "Your conference is booked" : kind === "changed" ? "Your conference was changed" : "Your conference is tomorrow";
  const subject =
    kind === "confirmation"
      ? `Booked: conference for ${b.child_name}, ${when}`
      : kind === "changed"
        ? `New time: conference for ${b.child_name}, ${when}`
        : `Tomorrow: conference for ${b.child_name}, ${when}`;
  return {
    subject,
    ...emailLayout({
      heading,
      paragraphs: [
        kind === "reminder"
          ? `Hi ${first}, a reminder that you're meeting ${teacher.name} about ${b.child_name} tomorrow (${event.name}).`
          : `Hi ${first}, you're booked to meet ${teacher.name} about ${b.child_name} (${event.name}).`,
        ...(kind !== "reminder" ? ["A calendar invite is attached, so it's on your calendar with the details."] : []),
      ],
      rows: [
        { title: "When", detail: when },
        {
          title: place.title,
          detail: place.lines.join(" "),
          links: place.link ? [{ label: "Join the meeting", url: place.link }] : undefined,
        },
        ...(b.parents.length > 1 ? [{ title: "Coming", detail: b.parents.map((p) => p.name).join(", ") }] : []),
      ],
      button: { label: "Change or cancel", url: link },
      footer,
    }),
    ...(kind !== "reminder" ? { invite: invite("REQUEST", b, event, s, teacher, link, to) } : {}),
  };
}
