import { EMAIL_LINK_DAYS } from "@/lib/email-link-age";
import { formatDate, formatDateRange } from "@/lib/time";

/**
 * What a band invitation (or its reminder) says: one place, so "Preview the email" shows exactly
 * what's sent. A saved custom wording (Email settings) replaces the opening, never the deadline.
 */
export function bandInviteEmail(o: {
  firstName: string | null;
  host: string;
  one: string;
  event: { name: string; starts_on: string; ends_on: string; venue_name: string | null; band_registration_deadline: string | null };
  /** Their band's details came from the host's spreadsheet, not an earlier contest. */
  fromSpreadsheet: boolean;
  reminder: boolean;
  email: string;
  custom?: { subject?: string; heading?: string; paragraphs: string[]; button?: string | null } | null;
}) {
  const { event, one } = o;
  const when = `${formatDateRange(event.starts_on, event.ends_on)}${event.venue_name ? ` at ${event.venue_name}` : ""}`;
  const deadline = event.band_registration_deadline ? [`Registration closes at the end of ${formatDate(event.band_registration_deadline)}.`] : [];
  const hi = o.firstName ? `Hi ${o.firstName}. ` : "";
  const subject = o.reminder ? `Reminder: register for ${event.name}` : o.custom?.subject || `You're invited: ${event.name}`;
  const paragraphs = o.reminder
    ? [
        `${hi}A reminder from ${o.host}: registration is still open for ${event.name}, ${when}.`,
        `Your ${one}'s details are saved. Check them, change anything you need, and register.`,
        ...deadline,
      ]
    : o.custom
      ? [...o.custom.paragraphs, ...deadline]
      : [
          `${hi}${o.host} would love to have your ${one} at ${event.name}, ${when}.`,
          o.fromSpreadsheet
            ? `Your ${one}'s details are already filled in from ${o.host}'s list. Check them, change anything you need, and register.`
            : `Your ${one}'s details from last time are saved. Check them, change anything you need, and register.`,
          ...deadline,
        ];
  return {
    subject,
    heading: o.reminder ? subject : o.custom?.heading || subject,
    paragraphs,
    button: (!o.reminder && o.custom?.button) || "Review and register",
    footer: `This button is just for you (${o.email}) and works once in the next ${EMAIL_LINK_DAYS} days. Please don't forward this email.`,
  };
}
