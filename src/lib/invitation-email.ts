import "server-only";
import { brand } from "@/lib/brand";
import { emailLayout } from "@/lib/email";
import { formatDate, formatDateRange } from "@/lib/time";

/** What prepare_invitation_email() returns. */
export type InvitationDetails = {
  email: string;
  role: "volunteer_director" | "section_lead" | null;
  as_host: boolean;
  token: string;
  expires_at: string;
  event_name: string;
  starts_on: string;
  ends_on: string;
  venue_name: string | null;
  organization: string;
  station_name: string | null;
  inviter_name: string | null;
};

/** A different email for co-hosts, Volunteer Leads and Section Leads, with a one-tap accept link. */
/** `bands`: the event is a band contest (a volunteer event has no bands). */
export function invitationEmail(inv: InvitationDetails, acceptUrl: string, bands = true) {
  const who = inv.inviter_name ? `${inv.inviter_name} from ${inv.organization}` : inv.organization;
  const when = `${formatDateRange(inv.starts_on, inv.ends_on)}${inv.venue_name ? ` at ${inv.venue_name}` : ""}`;
  const station = inv.station_name ?? "a station";

  const { subject, heading, paragraphs } = inv.as_host
    ? {
        subject: `You're invited to co-host ${inv.organization} on ${brand.name}`,
        heading: `Co-host ${inv.organization}'s events`,
        paragraphs: [
          `${who} invited you to co-host their events on ${brand.name}, starting with ${inv.event_name} (${when}).`,
          bands
            ? "Co-hosts have the same access as the host on every event: bands, the schedule, volunteers, the team and contest day."
            : "Co-hosts have the same access as the host on every event: stations, shifts, volunteers, the team and the event day.",
        ],
      }
    : inv.role === "volunteer_director"
      ? {
          subject: `Help run volunteers for ${inv.event_name}`,
          heading: "You're invited to be a Volunteer Lead",
          paragraphs: [
            `${who} invited you to help run volunteers for ${inv.event_name} (${when}).`,
            `As a Volunteer Lead you'll set up stations and shifts, see who's signed up, check people in, and help run ${bands ? "contest day" : "the event day"}.`,
          ],
        }
      : {
          subject: `Lead ${station} at ${inv.event_name}`,
          heading: "You're invited to be a Section Lead",
          paragraphs: [
            `${who} asked you to lead ${station} at ${inv.event_name} (${when}).`,
            bands
              ? "You'll see who's on your station's shifts and check bands in on contest day. Volunteers' phone numbers unlock on the day."
              : "You'll see who's on your station's shifts, and their phone numbers unlock on the day of the event.",
          ],
        };

  return {
    subject,
    ...emailLayout({
      heading,
      paragraphs: [
        ...paragraphs,
        `Tap the button to accept. There's no password: it signs you in as ${inv.email}, and sets up your account if you don't have one yet.`,
      ],
      button: { label: "Accept invitation", url: acceptUrl },
      footer: `This invitation is for ${inv.email} and works until ${formatDate(inv.expires_at.slice(0, 10))}. If you weren't expecting it, you can ignore this email.`,
    }),
  };
}
