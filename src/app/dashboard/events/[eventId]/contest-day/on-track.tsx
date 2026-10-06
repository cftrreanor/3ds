import Link from "next/link";
import { shortName, waitingOn, type Attention, type OnTrack, type Tile } from "@/lib/contest-day";

type NamedBand = { id: string; school_name: string } & Attention["band"];

/** 21 → "21m", 576 → "9h 36m". */
const span = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);

const DOT = { green: "bg-success", gold: "bg-accent", red: "bg-danger", neutral: "bg-border" } as const;

/** One line: 🔴 2 behind · 🟡 1 due soon, or On track / Parking hasn't started / Contest day is Sat, Oct 24. */
export function StatusLine({
  status,
  hasPath,
  dayLabel,
  time,
}: {
  status: OnTrack<NamedBand>;
  hasPath: boolean;
  dayLabel: string;
  time: (iso: string) => string;
}) {
  const { late, soon, phase, started } = status;
  const lateBands = new Set(late.map((a) => a.band.id)).size;
  const soonBands = new Set(soon.map((a) => a.band.id)).size;
  const waiting = phase === "day" && !started && !lateBands && !soonBands;
  const parts: { dot: keyof typeof DOT; text: string }[] = !hasPath
    ? [{ dot: "neutral", text: "Set up check-in stations to track the day" }]
    : phase === "before"
      ? [{ dot: "neutral", text: `Contest day is ${dayLabel}` }]
      : phase === "after"
        ? [{ dot: "neutral", text: "Contest day is over" }]
        : waiting
          ? [{ dot: "neutral", text: `Parking hasn't started${status.firstDue ? ` · first due ${time(status.firstDue)}` : ""}` }]
          : lateBands || soonBands
            ? [
                ...(lateBands ? [{ dot: "red" as const, text: `${lateBands} behind` }] : []),
                ...(soonBands ? [{ dot: "gold" as const, text: `${soonBands} due soon` }] : []),
              ]
            : [{ dot: "green", text: "On track" }];
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg font-semibold" role="status">
      {parts.map((p) => (
        <span key={p.text} className="inline-flex items-center gap-2">
          <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${DOT[p.dot]}`} />
          {p.text}
        </span>
      ))}
    </p>
  );
}

/** A number per check-in station (done of total, with a bar), plus who's next on the field. */
export function DayTiles({
  tiles,
  next,
  eventId,
  time,
}: {
  tiles: Tile[];
  next: { order: number; school: string; perform_at: string | null; atGate: boolean } | null;
  eventId: string;
  time: (iso: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => {
        const ring = t.late ? "ring-2 ring-danger" : t.soon ? "ring-2 ring-accent" : "ring-1 ring-border";
        return (
          <Link
            key={t.station.id}
            href={`/dashboard/events/${eventId}/contest-day?station=${t.station.id}`}
            className={`rounded-lg bg-background px-3 py-2 ${ring} hover:bg-surface`}
          >
            <p className="truncate text-xs text-muted">{t.label}</p>
            <p className="text-xl font-semibold tabular-nums">
              {t.done}
              <span className="text-sm font-normal text-muted"> / {t.total}</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
              <div className="h-full rounded-full bg-success" style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 h-4 text-xs">
              {t.late ? (
                <span className="font-semibold text-danger">{t.late} late</span>
              ) : t.soon ? (
                <span className="font-semibold">{t.soon} due soon</span>
              ) : t.atGate ? (
                <span className="text-muted">{t.atGate} at the gate</span>
              ) : null}
            </p>
          </Link>
        );
      })}
      {next && (
        <div className="col-span-2 rounded-lg bg-accent-soft px-3 py-2 sm:col-span-4">
          <p className="text-xs text-muted">Next on the field</p>
          <p className="font-semibold">
            #{next.order} {next.school}
            <span className="font-normal text-muted">
              {next.perform_at ? ` · ${time(next.perform_at)}` : ""}
              {next.atGate ? " · at the gate" : ""}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Short rows: ● School · Station · 21m late. Most urgent first; "+N more" links to the Overview. */
export function AttentionList({
  status,
  eventId,
  limit,
}: {
  status: OnTrack<NamedBand>;
  eventId: string;
  limit?: number;
}) {
  const rows = [...status.late, ...status.soon];
  if (rows.length === 0) return null;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div>
      <h3 className="text-sm font-semibold">Needs attention</h3>
      <ul className="mt-1 divide-y divide-border">
        {shown.map(({ band, check }) => (
          <li key={`${band.id}-${check.station.id}`}>
            <Link
              href={`/dashboard/events/${eventId}/contest-day?station=${check.station.id}`}
              title={`${band.school_name}: ${waitingOn(band, check)}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 py-1.5 text-sm hover:bg-background"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${check.state === "late" ? "bg-danger" : "bg-accent"}`} />
              <span className="truncate font-medium">{band.school_name}</span>
              <span className="text-muted">{shortName(check.station)}</span>
              <span className={`whitespace-nowrap text-right tabular-nums ${check.state === "late" ? "font-semibold text-danger" : "text-muted"}`}>
                {check.state === "late" ? `${span(check.minutes)} late` : `in ${span(check.minutes)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {limit && rows.length > limit && (
        <Link
          href={`/dashboard/events/${eventId}/contest-day?station=overview&filter=behind`}
          className="mt-1 inline-flex text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          +{rows.length - limit} more
        </Link>
      )}
    </div>
  );
}
