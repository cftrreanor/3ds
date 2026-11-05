import "server-only";
import { emailLayout } from "@/lib/email";
import { formatDateRange } from "@/lib/time";

// Emails about the team changing: someone left an event (to its Account Host and Volunteer
// Leads), and someone was removed (to that person, when the remover ticks "Let them know").
// Design review 2026-11-05, finding 3.

const ROLE = { volunteer_director: "Volunteer Lead", section_lead: "Coordinator", co_host: "co-host" } as const;
type Role = keyof typeof ROLE;

/** "Tasha Brooks left Lone Star Marching Invitational": what's now without anyone, and where to fix it. */
export function leftEventEmail(o: {
  who: string;
  role: Exclude<Role, "co_host">;
  event: { name: string; starts_on: string; ends_on: string };
  /** The jobs they led there. */
  jobs: string[];
  /** The event was left with no Volunteer Lead. */
  noLead: boolean;
  setupUrl: string;
}) {
  const when = formatDateRange(o.event.starts_on, o.event.ends_on);
  const gaps = [
    ...o.jobs.map((job) => `${job} needs a new Coordinator.`),
    ...(o.noLead ? [`${o.event.name} has no Volunteer Lead now, so the Account Host and co-hosts run its volunteers.`] : []),
  ];
  return {
    subject: `${o.who} left ${o.event.name}`,
    ...emailLayout({
      heading: `${o.who} left ${o.event.name}`,
      paragraphs: [
        `${o.who} is no longer the ${ROLE[o.role]}${o.jobs.length ? ` for ${o.jobs.join(", ")}` : ""} at ${o.event.name} (${when}).`,
        ...gaps,
        "You can invite someone from the event's team setup.",
      ],
      button: { label: "Open team setup", url: o.setupUrl },
      footer: "You're getting this because you're the Account Host or a Volunteer Lead for this event.",
    }),
  };
}

/**
 * To someone who was removed, when the person removing them chose to let them know. Says what
 * they're no longer, and what they still are, so a partial removal never reads as "off the team".
 */
export function removedEmail(o: {
  remover: string;
  /** The account's name, if known. */
  organization: string | null;
  /** "Coordinator of Lone Star Marching Invitational", or "co-host". */
  roles: string[];
  /** Roles they still have on the account's events. */
  keeps: string[];
  /** Who to ask about it. */
  contact: string;
}) {
  const coHost = o.roles.length === 1 && o.roles[0] === "co-host";
  const what = coHost ? `a co-host${o.organization ? ` for ${o.organization}` : ""}` : o.roles.join(" and ");
  const title = `You're no longer ${what}`;
  return {
    subject: title,
    ...emailLayout({
      heading: title,
      paragraphs: [
        `${o.remover} removed you as ${what}.`,
        ...(o.keeps.length ? [`You're still ${o.keeps.join(" and ")}.`] : []),
        `Questions? Contact ${o.remover} at ${o.contact}.`,
      ],
      footer: "Your own account and any volunteer sign-ups you made stay as they are.",
    }),
  };
}
