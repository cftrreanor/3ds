// Time helpers. Events happen in the venue's time zone, not the server's or
// the viewer's, so every conversion takes the event's IANA zone explicitly.

export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
] as const;

export function isValidTimezone(tz: string) {
  return US_TIMEZONES.some((t) => t.value === tz);
}

/** Wall-clock parts of an instant in a zone. */
function zonedParts(instant: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(instant: Date, tz: string) {
  const p = zonedParts(instant, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant.getTime();
}

/** "2026-10-24" + "07:00" in America/Chicago → the matching UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes so times near a daylight-saving switch land correctly.
  let ts = wall - offsetMs(new Date(wall), tz);
  ts = wall - offsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** UTC instant → "HH:MM" wall-clock time in the zone. */
export function utcToZonedTime(iso: string, tz: string): string {
  const p = zonedParts(new Date(iso), tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** UTC instant → "YYYY-MM-DD" in the zone. */
export function utcToZonedDate(iso: string, tz: string): string {
  const p = zonedParts(new Date(iso), tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatTimeRange(startIso: string, endIso: string, tz: string) {
  return `${formatTime(startIso, tz)} – ${formatTime(endIso, tz)}`;
}

/** "2026-10-24" → "Sat, Oct 24, 2026" (a calendar date, no zone shifting). */
export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = {}) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateRange(startsOn: string, endsOn: string) {
  return startsOn === endsOn ? formatDate(startsOn) : `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
}

/** Every calendar date from start to end inclusive. */
export function eachDate(startsOn: string, endsOn: string): string[] {
  const out: string[] = [];
  const [y, m, d] = startsOn.split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  while (out.length < 31) {
    const s = cur.toISOString().slice(0, 10);
    if (s > endsOn) break;
    out.push(s);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
