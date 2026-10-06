import Link from "next/link";
import { waitingOn, type Attention, type OnTrack } from "@/lib/contest-day";

const TONE = {
  green: { dot: "bg-success", text: "text-success" },
  gold: { dot: "bg-accent", text: "text-foreground" },
  red: { dot: "bg-danger", text: "text-danger" },
  neutral: { dot: "bg-border", text: "text-foreground" },
} as const;

type NamedBand = { id: string; school_name: string } & Attention["band"];

/** "On track" / "2 bands due soon" / "1 band behind", with who and where. */
export function OnTrackSummary({
  status,
  eventId,
  time,
  limit,
  hasPath,
  dayLabel,
}: {
  status: OnTrack<NamedBand>;
  eventId: string;
  time: (iso: string) => string;
  /** Show at most this many bands (the event page shows a few; the overview shows all). */
  limit?: number;
  /** False when no check-in stations are set up yet. */
  hasPath: boolean;
  /** e.g. "Sat, Oct 24", for "Contest day is Sat, Oct 24". */
  dayLabel: string;
}) {
  const { late, soon, phase, started } = status;
  const waiting = phase === "day" && !started && late.length === 0 && soon.length === 0;
  const tone = !hasPath || waiting ? "neutral" : status.tone;
  const headline = !hasPath
    ? "Set up check-in stations to track the day"
    : phase === "before"
      ? `Contest day is ${dayLabel}`
      : phase === "after"
        ? "Contest day is over"
        : late.length
          ? `${late.length} ${late.length === 1 ? "band is" : "bands are"} behind`
          : soon.length
            ? `${soon.length} due in the next 15 minutes`
            : waiting
              ? "Parking hasn't started yet"
              : "On track";
  // What's actually happened so far, so "on track" never reads as "everyone's parked".
  const progress = status.expected ? `${status.parked} of ${status.expected} bands fully parked.` : "";
  const detail = !hasPath
    ? null
    : phase === "before"
      ? "On the day, this shows whether bands are parked and at warm-up on time."
      : phase === "after"
        ? progress || null
        : waiting
          ? status.firstDue
            ? `The first band is due at ${time(status.firstDue)}.`
            : "No deadlines yet: check the schedule's warm-up times."
          : late.length || soon.length
            ? progress || null
            : `No band has missed a deadline yet. ${progress}`;
  const rows = [...late, ...soon];
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div>
      <p className={`flex items-center gap-2 text-base font-semibold ${TONE[tone].text}`} role="status">
        <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${TONE[tone].dot}`} />
        {headline}
      </p>
      {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
      {shown.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {shown.map(({ band, check }) => (
            <li key={`${band.id}-${check.station.id}`}>
              <Link
                href={`/dashboard/events/${eventId}/contest-day?station=${check.station.id}`}
                className="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-background"
              >
                <span aria-hidden className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${check.state === "late" ? "bg-danger" : "bg-accent"}`} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{band.school_name}</span>: {waitingOn(band, check)} · due {time(check.due!)}{" "}
                  <span className={check.state === "late" ? "font-semibold text-danger" : "text-muted"}>
                    ({check.state === "late" ? `${check.minutes} min late` : `in ${check.minutes} min`})
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {limit && rows.length > limit && (
        <p className="mt-1 text-sm text-muted">
          and {rows.length - limit} more. Open contest day to see them all.
        </p>
      )}
    </div>
  );
}
