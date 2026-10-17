import { readyAt, warmUpEndAt } from "@/lib/bands";
import type { IcsEvent } from "@/lib/ics";
import { formatTime } from "@/lib/time";

export type BandTimes = {
  warm_up_at: string | null;
  warm_up_minutes: number | null;
  perform_at: string | null;
  warm_up_location: string | null;
};

type CalendarInput = {
  bandId: string;
  bandName: string;
  round: "order" | "finals";
  /** The contest has finals, so the first round is named "preliminaries". */
  hasFinals?: boolean;
  times: BandTimes;
  event: { name: string; timezone: string; venue_name: string | null; venue_address: string; ready_minutes_before: number };
  url: string;
};

/**
 * A band's contest-day block for a calendar: from warm-up (or an hour before
 * performing) until 15 minutes after the performance. Null until there's a
 * performance time.
 */
export function bandCalendarEvent({ bandId, bandName, round, hasFinals = false, times: t, event, url }: CalendarInput): IcsEvent | null {
  if (!t.perform_at) return null;
  const tz = event.timezone;
  const perform = new Date(t.perform_at);
  const warmEnd = warmUpEndAt(t.warm_up_at, t.warm_up_minutes);
  const ready = readyAt(t.perform_at, event.ready_minutes_before);
  const finals = round === "finals";
  const roundWord = finals ? " finals" : hasFinals ? " preliminaries" : "";
  return {
    uid: `band-${bandId}-${round}@fieldcommandevents.com`,
    timezone: tz,
    sequence: 0,
    start: t.warm_up_at ? new Date(t.warm_up_at) : new Date(perform.getTime() - 60 * 60_000),
    end: new Date(perform.getTime() + 15 * 60_000),
    summary: `${bandName}${roundWord} at ${event.name}`,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(", "),
    description: [
      t.warm_up_at &&
        `Warm-up: ${formatTime(t.warm_up_at, tz)}${warmEnd ? `–${formatTime(warmEnd, tz)}` : ""}${t.warm_up_location ? ` at ${t.warm_up_location}` : ""}`,
      ready && `Ready position: ${formatTime(ready, tz)}`,
      `Performance: ${formatTime(t.perform_at, tz)}`,
      url,
    ]
      .filter(Boolean)
      .join("\n"),
    url,
    alarm: `${bandName}${roundWord}: warm-up soon`,
  };
}

type RoomStop = { name: string; note: string | null; starts_at: string; ends_at: string };

/**
 * A group's festival day for a calendar: from its first room to the end of its
 * last, with each room's time in the notes. Null until the schedule has times.
 */
export function groupCalendarEvent({
  bandId,
  bandName,
  stops,
  event,
  url,
}: {
  bandId: string;
  bandName: string;
  stops: RoomStop[];
  event: { name: string; timezone: string; venue_name: string | null; venue_address: string };
  url: string;
}): IcsEvent | null {
  if (stops.length === 0) return null;
  const sorted = [...stops].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const tz = event.timezone;
  return {
    uid: `group-${bandId}-rooms@fieldcommandevents.com`,
    timezone: tz,
    sequence: 0,
    start: new Date(sorted[0].starts_at),
    end: new Date(sorted.reduce((end, s) => (s.ends_at > end ? s.ends_at : end), sorted[0].ends_at)),
    summary: `${bandName} at ${event.name}`,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(", "),
    description: [
      ...sorted.map((s) => `${formatTime(s.starts_at, tz)}–${formatTime(s.ends_at, tz)}: ${s.name}${s.note ? ` (${s.note})` : ""}`),
      url,
    ].join("\n"),
    url,
    alarm: `${bandName}: first room soon`,
  };
}
