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
    ...(o.noLead ? [`${o.event.name} has no Volunteer Lead now, so its hosts run volunteers.`] : []),
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

/** To someone who was removed, when the person removing them chose to let them know. */
export function removedEmail(o: {
  remover: string;
  organization: string;
  /** "Coordinator of Lone Star Marching Invitational", or "co-host" for the whole account. */
  roles: string[];
  /** Who to ask about it. */
  contact: string;
}) {
  const what = o.roles.join(" and ");
  return {
    subject: `You've been removed from ${o.organization}'s team`,
    ...emailLayout({
      heading: `You're no longer on ${o.organization}'s team`,
      paragraphs: [
        `${o.remover} removed you as ${what}. You can't see ${o.roles.length > 1 || o.roles[0] === ROLE.co_host ? "those events" : "that event"} in your account anymore.`,
        `Questions? Contact ${o.remover} at ${o.contact}.`,
      ],
      footer: "If you weren't expecting this, you can ignore this email. Your account and any volunteer sign-ups of your own stay as they are.",
    }),
  };
}
