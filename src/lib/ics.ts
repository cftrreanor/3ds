import { zonedStamp } from "./time";

// iCalendar (RFC 5545) files for volunteer shifts. Email apps recognize these
// as calendar events: Gmail, Apple Mail and Outlook show "Add to calendar".
//
// METHOD:REQUEST makes it an invitation, so later emails with the same UID and
// a higher SEQUENCE update the event in the volunteer's calendar, and
// METHOD:CANCEL removes it. METHOD:PUBLISH is a plain "add this" download.

export type IcsEvent = {
  uid: string;
  /** The event's IANA time zone, e.g. America/Chicago. Times are written in it. */
  timezone: string;
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

// Time zone definitions embedded in each file, so every calendar app reads
// "7:00 AM Central" exactly as the host set it, whatever the phone's own
// setting. US daylight saving rules (since 2007): 2nd Sunday of March to
// 1st Sunday of November.
const US_ZONES: Record<string, { std: [string, string]; dst?: [string, string] }> = {
  "America/New_York": { std: ["-0500", "EST"], dst: ["-0400", "EDT"] },
  "America/Chicago": { std: ["-0600", "CST"], dst: ["-0500", "CDT"] },
  "America/Denver": { std: ["-0700", "MST"], dst: ["-0600", "MDT"] },
  "America/Phoenix": { std: ["-0700", "MST"] },
  "America/Los_Angeles": { std: ["-0800", "PST"], dst: ["-0700", "PDT"] },
  "America/Anchorage": { std: ["-0900", "AKST"], dst: ["-0800", "AKDT"] },
  "Pacific/Honolulu": { std: ["-1000", "HST"] },
};

function vtimezone(tz: string) {
  const z = US_ZONES[tz];
  if (!z) return [];
  const [stdOffset, stdName] = z.std;
  if (!z.dst) {
    return [
      "BEGIN:VTIMEZONE",
      `TZID:${tz}`,
      "BEGIN:STANDARD",
      `TZOFFSETFROM:${stdOffset}`,
      `TZOFFSETTO:${stdOffset}`,
      `TZNAME:${stdName}`,
      "DTSTART:19700101T000000",
      "END:STANDARD",
      "END:VTIMEZONE",
    ];
  }
  const [dstOffset, dstName] = z.dst;
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    "BEGIN:DAYLIGHT",
    `TZOFFSETFROM:${stdOffset}`,
    `TZOFFSETTO:${dstOffset}`,
    `TZNAME:${dstName}`,
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    `TZOFFSETFROM:${dstOffset}`,
    `TZOFFSETTO:${stdOffset}`,
    `TZNAME:${stdName}`,
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

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
    `X-WR-TIMEZONE:${event.timezone}`,
    ...vtimezone(event.timezone),
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    ...(US_ZONES[event.timezone]
      ? [
          `DTSTART;TZID=${event.timezone}:${zonedStamp(event.start, event.timezone)}`,
          `DTEND;TZID=${event.timezone}:${zonedStamp(event.end, event.timezone)}`,
        ]
      : [`DTSTART:${stamp(event.start)}`, `DTEND:${stamp(event.end)}`]),
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

/** "Add to Google Calendar" link for one event, pinned to the event's time zone. */
export function googleCalendarUrl(
  event: Pick<IcsEvent, "start" | "end" | "summary" | "location" | "description" | "timezone">,
) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${zonedStamp(event.start, event.timezone)}/${zonedStamp(event.end, event.timezone)}`,
    ctz: event.timezone,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { details: event.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
