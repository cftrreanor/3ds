// iCalendar (RFC 5545) files for volunteer shifts. Email apps recognize these
// as calendar events: Gmail, Apple Mail and Outlook show "Add to calendar".
//
// METHOD:REQUEST makes it an invitation, so later emails with the same UID and
// a higher SEQUENCE update the event in the volunteer's calendar, and
// METHOD:CANCEL removes it. METHOD:PUBLISH is a plain "add this" download.

export type IcsEvent = {
  uid: string;
  sequence: number;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  url?: string;
  attendee?: { name: string; email: string };
};

export type IcsMethod = "REQUEST" | "CANCEL" | "PUBLISH";

const ORGANIZER_EMAIL = "no-reply@fieldcommandevents.com";

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Parameter values (like CN=) are quoted, not backslash-escaped. */
function param(s: string) {
  return `"${s.replace(/"/g, "'").replace(/[\r\n]/g, " ")}"`;
}

/** Lines longer than 75 bytes must be folded (continued with a leading space). */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (size + len > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(method: IcsMethod, event: IcsEvent, organizerName = "FieldCommand") {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//FieldCommand//Volunteer Shifts//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(method === "PUBLISH"
      ? []
      : [
          `ORGANIZER;CN=${param(organizerName)}:mailto:${ORGANIZER_EMAIL}`,
          ...(event.attendee
            ? [
                // Already accepted and no reply wanted, so apps don't nag for an RSVP.
                `ATTENDEE;CN=${param(event.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${event.attendee.email}`,
              ]
            : []),
        ]),
    ...(method === "CANCEL"
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Volunteer shift", "TRIGGER:-PT1H", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link for one event. */
export function googleCalendarUrl(event: Pick<IcsEvent, "start" | "end" | "summary" | "location" | "description">) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${stamp(event.start)}/${stamp(event.end)}`,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { details: event.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
