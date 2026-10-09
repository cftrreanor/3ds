import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout } from "@/lib/email";
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

/** The confirmation, and the reminder the day before. */
export function parentEmail(
  kind: "confirmation" | "reminder",
  r: { parent_name: string; children: Child[] },
  event: { name: string; starts_on: string; ends_on: string; window_start: string; window_end: string; timezone: string; venue_name: string | null; venue_address: string },
  link: string,
) {
  const when = `${formatDateRange(event.starts_on, event.ends_on)}, ${formatTimeRange(event.window_start, event.window_end, event.timezone)}`;
  const where = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const subject = kind === "confirmation" ? `You're registered: ${event.name}` : `Tomorrow: ${event.name}. Bring your photo ID`;
  return {
    subject,
    ...emailLayout({
      heading: kind === "confirmation" ? "You're registered" : "See you tomorrow",
      paragraphs: [
        `Hi ${r.parent_name.split(" ")[0]}, ${kind === "confirmation" ? "you're registered for" : "a reminder about"} ${event.name}: ${when} at ${where}.`,
        ID_REMINDER,
      ],
      rows: r.children.map((c, i) => ({ title: r.children.length > 1 ? `Child ${i + 1}` : "Your child", detail: childLine(c) })),
      button: { label: "View or cancel my registration", url: link },
      footer: `Sent by ${brand.name}. Your children's details are deleted 30 days after the event.`,
    }),
  };
}
