import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout, type CalendarInvite } from "@/lib/email";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { formatDateRange, formatTimeRange } from "@/lib/time";

// School visitor events: parents register their children ahead and are
// checked in at the door with a government-issued photo ID. Registrations
// are erased 30 days after the event (supabase/migrations/20261030000000_school_visits.sql).

export type Child = { name: string; teacher: string; grade: string };

export const ID_REMINDER =
  "Bring a valid government-issued photo ID (driver's license, state ID or passport). You won't be let in without it.";

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
type Registration = { id: string; parent_name: string; email: string; children: Child[]; adult_count: number; calendar_sequence: number };

/** "1 adult", "3 adults". */
export const adultsLabel = (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`;

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
      `Adults coming: ${r.adult_count}`,
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
        {
          title: "Adults coming",
          detail: r.adult_count > 1 ? `${adultsLabel(r.adult_count)}. Each of you needs a photo ID.` : "Just you",
        },
      ],
      button: { label: "View or cancel my registration", url: link },
      footer,
    }),
    ...(kind === "confirmation" ? { invite: invite("REQUEST", r, event, link) } : {}),
  };
}
