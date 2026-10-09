import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout, type CalendarInvite } from "@/lib/email";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { formatDate, formatDateRange, formatTime, formatTimeRange, utcToZonedDate, zoneAbbreviation } from "@/lib/time";

// School visitor events: parents register their children ahead and are
// checked in at the door with a government-issued photo ID. Registrations
// are erased 30 days after the event (supabase/migrations/20261030000000_school_visits.sql).

export type Child = { name: string; teacher: string; grade: string };

/** An adult coming with the registering parent, checked in on their own at the door. */
export type OtherAdult = { name: string; checked_in_at: string | null };

/** The other adults' names, from the stored list. */
export const adultNames = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map((a) => (typeof a === "string" ? a : String((a as OtherAdult)?.name ?? ""))).filter(Boolean) : [];

export const ID_REMINDER =
  "Bring a valid government-issued photo ID (driver's license, state ID or passport). You won't be let in without it.";

type OpenFields = {
  status: string;
  timezone: string;
  ends_on: string;
  parent_registration_open: boolean;
  parent_registration_closes_at: string | null;
};

/** Why parent registration isn't taking sign-ups, or null when it's open. */
export function parentRegistrationClosed(e: OpenFields, now = new Date()): "draft" | "over" | "closed" | "deadline" | null {
  if (e.status !== "published") return "draft";
  if (utcToZonedDate(now.toISOString(), e.timezone) > e.ends_on) return "over";
  if (!e.parent_registration_open) return "closed";
  if (e.parent_registration_closes_at && now >= new Date(e.parent_registration_closes_at)) return "deadline";
  return null;
}

/** "Thu, Oct 22 at 5:00 PM CDT" */
export const closesAtLabel = (iso: string, tz: string) =>
  `${formatDate(utcToZonedDate(iso, tz), { year: undefined })} at ${formatTime(iso, tz)} ${zoneAbbreviation(iso, tz)}`;

/** A link to view or cancel a registration. */
export const parentLink = (origin: string, slug: string, token: string) => `${origin}/e/${slug}/parents/r/${token}`;

const childLine = (c: Child) => `${c.name} · ${c.grade} · ${c.teacher}`;

type ParentEvent = {
  name: string;
  starts_on: string;
  ends_on: string;
  window_start: string;
  window_end: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string;
};
type Registration = { id: string; parent_name: string; email: string; children: Child[]; other_adults: string[]; calendar_sequence: number };


/** The visit as a calendar event, with the photo ID reminder in it. */
function toIcsEvent(r: Registration, event: ParentEvent, link: string): IcsEvent {
  return {
    uid: `parent-${r.id}@fieldcommandevents.com`,
    timezone: event.timezone,
    sequence: r.calendar_sequence,
    start: new Date(event.window_start),
    end: new Date(event.window_end),
    summary: event.name,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(", "),
    description: [
      `Registered: ${r.children.map(childLine).join("; ")}`,
      `Adults: ${[r.parent_name, ...r.other_adults].join(", ")} (each needs a photo ID)`,
      ID_REMINDER,
      `View or cancel: ${link}`,
    ].join("\n"),
    url: link,
    attendee: { name: r.parent_name, email: r.email },
    alarm: "Bring your photo ID",
  };
}

const invite = (method: "REQUEST" | "CANCEL", r: Registration, event: ParentEvent, link: string): CalendarInvite => ({
  method,
  content: buildIcs(method, toIcsEvent(r, event, link), brand.name),
});

const CALENDAR_TIP =
  "A calendar invite is attached, so you can add the visit to your calendar with a reminder to bring your photo ID.";

/**
 * The confirmation (a calendar invite; registering again updates it), the
 * reminder the day before, and the cancellation (removes the invite).
 */
export function parentEmail(kind: "confirmation" | "reminder" | "canceled", r: Registration, event: ParentEvent, link: string) {
  const when = `${formatDateRange(event.starts_on, event.ends_on)}, ${formatTimeRange(event.window_start, event.window_end, event.timezone)}`;
  const where = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const first = r.parent_name.split(" ")[0];
  const footer = `Sent by ${brand.name}. Your children's details are deleted 30 days after the event.`;

  if (kind === "canceled") {
    return {
      subject: `Canceled: ${event.name}`,
      ...emailLayout({
        heading: "Your registration was canceled",
        paragraphs: [
          `Hi ${first}, your registration for ${event.name} (${when}) is canceled, and your children's details have been deleted.`,
          "If you added our calendar invite, it will be removed from your calendar (in Gmail, you may need to open this email first).",
        ],
        button: { label: "Register again", url: link },
        footer,
      }),
      invite: invite("CANCEL", { ...r, calendar_sequence: r.calendar_sequence + 1 }, event, link),
    };
  }

  return {
    subject: kind === "confirmation" ? `You're registered: ${event.name}` : `Tomorrow: ${event.name}. Bring your photo ID`,
    ...emailLayout({
      heading: kind === "confirmation" ? "You're registered" : "See you tomorrow",
      paragraphs: [
        `Hi ${first}, ${kind === "confirmation" ? "you're registered for" : "a reminder about"} ${event.name}: ${when} at ${where}.`,
        ID_REMINDER,
        ...(kind === "confirmation" ? [CALENDAR_TIP] : []),
      ],
      rows: [
        ...r.children.map((c, i) => ({ title: r.children.length > 1 ? `Child ${i + 1}` : "Your child", detail: childLine(c) })),
        ...(r.other_adults.length
          ? [{ title: "Also coming", detail: `${r.other_adults.join(", ")}. Each adult needs their own photo ID.` }]
          : []),
      ],
      button: { label: "View or cancel my registration", url: link },
      footer,
    }),
    ...(kind === "confirmation" ? { invite: invite("REQUEST", r, event, link) } : {}),
  };
}
