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
  times: BandTimes;
  event: { name: string; timezone: string; venue_name: string | null; venue_address: string; ready_minutes_before: number };
  url: string;
};

/**
 * A band's contest-day block for a calendar: from warm-up (or an hour before
 * performing) until 15 minutes after the performance. Null until there's a
 * performance time.
 */
export function bandCalendarEvent({ bandId, bandName, round, times: t, event, url }: CalendarInput): IcsEvent | null {
  if (!t.perform_at) return null;
  const tz = event.timezone;
  const perform = new Date(t.perform_at);
  const warmEnd = warmUpEndAt(t.warm_up_at, t.warm_up_minutes);
  const ready = readyAt(t.perform_at, event.ready_minutes_before);
  const finals = round === "finals";
  return {
    uid: `band-${bandId}-${round}@fieldcommandevents.com`,
    timezone: tz,
    sequence: 0,
    start: t.warm_up_at ? new Date(t.warm_up_at) : new Date(perform.getTime() - 60 * 60_000),
    end: new Date(perform.getTime() + 15 * 60_000),
    summary: `${bandName}${finals ? " finals" : ""} at ${event.name}`,
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
    alarm: `${bandName}${finals ? " finals" : ""}: warm-up soon`,
  };
}
