import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { Badge, Card } from "@/components/ui";
import { getEventAccess } from "@/lib/data";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { sortStations, whereIs, type BandDay, type Checkpoint, type Round, type Stop, type Tone } from "@/lib/contest-day";
import { formatDate, formatTime, utcToZonedDate, zoneName } from "@/lib/time";

export const metadata: Metadata = { title: "Band schedule" };

/** What leads may know about a band (event_bands): no contact details. Counts are for Volunteer Leads only. */
export type LeadBand = BandDay & {
  id: string;
  band_name: string;
  school_name: string;
  classification: string;
  student_count: number | null;
  chaperone_count: number | null;
};
type Slot = {
  band_id: string | null;
  number: string;
  warm_up_at: string | null;
  warm_up_minutes: number | null;
  warm_up_location: string | null;
  perform_at: string | null;
};
type BreakRow = { starts_at: string; minutes: number; label: string };

const BADGE_TONE: Record<Tone, "neutral" | "warning" | "success"> = { red: "neutral", gold: "warning", green: "success", neutral: "neutral" };

/** Where the band is: needs the day's stops and the check-in path. */
type Track = { stops: Stop[]; path: Checkpoint[] };

function Status({ band, round, track }: { band: LeadBand; round: Round; track: Track }) {
  const w = whereIs(band, track.stops, track.path, round);
  return <Badge tone={BADGE_TONE[w.tone]}>{w.label}</Badge>;
}

/** Read-only schedule and band status for Volunteer Leads and Section Leads. */
export default async function LeadSchedulePage({ params }: PageProps<"/dashboard/events/[eventId]/schedule">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  // Hosts build and edit the schedule on the Bands page.
  if (access.isHost) redirect(`/dashboard/events/${eventId}/bands`);

  const supabase = await createClient();
  const { data: onTeam } = await supabase.rpc("is_event_staff", { ev: eventId });
  if (!onTeam) redirect(`/dashboard/events/${eventId}`);
  const { data: event } = await supabase
    .from("events")
    .select("id, slug, name, timezone, starts_on, ends_on, performance_order_published, finals_published, finalists_revealed")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();

  // Each read only returns what this person may see: drafts stay with the hosts.
  const [
    { data: bandData },
    { data: slotData },
    { data: breakData },
    { data: finalsData },
    { data: finalsTimes },
    { data: stopData },
    { data: pathData },
  ] = await Promise.all([
      supabase.rpc("event_bands", { ev: eventId }),
      supabase
        .from("performance_slots")
        .select("band_id, performance_order, warm_up_at, warm_up_minutes, warm_up_location, perform_at")
        .eq("event_id", eventId)
        .order("performance_order"),
      supabase.from("schedule_breaks").select("starts_at, minutes, label").eq("event_id", eventId).order("starts_at"),
      supabase
        .from("finals_slots")
        .select("slot_number, band_id, warm_up_at, warm_up_minutes, warm_up_location, perform_at")
        .eq("event_id", eventId)
        .order("slot_number"),
      event.finals_published ? supabase.rpc("public_finals", { p_slug: event.slug }) : Promise.resolve({ data: [] }),
      supabase.from("band_stops").select("band_id, station_id, round, performed, reached_at").eq("event_id", eventId),
      supabase
        .from("stations")
        .select("id, name, checkpoint_kind, checkpoint_order")
        .eq("event_id", eventId)
        .not("checkpoint_kind", "is", null),
    ]);
  const track: Track = { stops: (stopData ?? []) as Stop[], path: sortStations((pathData ?? []) as Checkpoint[]) };
  const bands = (bandData ?? []) as LeadBand[];
  const byId = new Map(bands.map((b) => [b.id, b]));
  const breaks = (breakData ?? []) as BreakRow[];
  const prelims: Slot[] = (slotData ?? []).map((s) => ({ ...s, number: String(s.performance_order) }));
  // Finals: the revealed rows (with warm-up details), or just the times until the reveal.
  const finals: Slot[] = (finalsData ?? []).length
    ? (finalsData ?? []).map((f) => ({ ...f, number: `F${f.slot_number}` }))
    : ((finalsTimes ?? []) as { slot_number: number; perform_at: string | null }[]).map((f) => ({
        band_id: null,
        number: `F${f.slot_number}`,
        warm_up_at: null,
        warm_up_minutes: null,
        warm_up_location: null,
        perform_at: f.perform_at,
      }));
  const scheduled = new Set(prelims.map((s) => s.band_id));
  const unscheduled = bands.filter((b) => !scheduled.has(b.id));

  const tz = event.timezone;
  const multiDay = event.starts_on !== event.ends_on;
  const at = (iso: string) =>
    `${multiDay ? `${formatDate(utcToZonedDate(iso, tz), { year: undefined })} · ` : ""}${formatTime(iso, tz)}`;

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Band schedule</h1>
      <p className="mt-1 text-sm text-muted">
        All times are {zoneName(tz)}. Only the host can change bands or the schedule.
      </p>

      {bands.length > 0 && (
        <p className="mt-4 text-sm">
          {Object.entries(
            bands.reduce<Record<string, number>>((acc, b) => {
              const label = whereIs(b, track.stops, track.path).label;
              return { ...acc, [label]: (acc[label] ?? 0) + 1 };
            }, {}),
          )
            .map(([label, n]) => `${n} ${label.toLowerCase()}`)
            .join(" · ")}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Preliminaries</h2>
        {prelims.length > 0 ? (
          <ScheduleRows slots={prelims} byId={byId} breaks={breaks} at={at} round="prelims" track={track} />
        ) : (
          <Card className="mt-3">
            <p className="text-sm text-muted">The host hasn&apos;t published the performance order yet.</p>
          </Card>
        )}
      </section>

      {finals.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">🏆 Finals</h2>
          {!event.finalists_revealed && <p className="mt-1 text-sm text-muted">Finalists are announced by the host.</p>}
          <ScheduleRows slots={finals} byId={byId} breaks={breaks} at={at} round="finals" track={track} />
        </section>
      )}

      {unscheduled.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">{prelims.length ? "Not in the order yet" : "Registered bands"}</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {unscheduled.map((b) => (
              <li key={b.id} className="flex items-start gap-3 px-4 py-3">
                <BandLines band={b} />
                <Status band={b} round="prelims" track={track} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ScheduleRows({
  slots,
  byId,
  breaks,
  at,
  round,
  track,
}: {
  track: Track;
  slots: Slot[];
  byId: Map<string, LeadBand>;
  breaks: BreakRow[];
  at: (iso: string) => string;
  round: Round;
}) {
  return (
    <ol className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
      {slots.map((s, i) => {
        const prev = slots[i - 1]?.perform_at;
        const between = prev && s.perform_at ? breaks.filter((b) => b.starts_at >= prev && b.starts_at < s.perform_at!) : [];
        const band = s.band_id ? byId.get(s.band_id) : undefined;
        return (
          <Fragment key={s.number}>
            {between.map((b) => (
              <li key={b.starts_at} className="flex items-center gap-3 bg-background px-4 py-2 text-sm text-muted">
                <span className="w-8 shrink-0 text-center">☕</span>
                <span className="flex-1 font-medium">{b.label}</span>
                <span className="shrink-0 tabular-nums">
                  {at(b.starts_at)} · {b.minutes} min
                </span>
              </li>
            ))}
            <li className="flex items-start gap-3 px-4 py-3">
              <span className="w-8 shrink-0 pt-0.5 text-center text-sm font-semibold text-muted">{s.number}</span>
              {band ? <BandLines band={band} slot={s} at={at} /> : <p className="min-w-0 flex-1 font-medium text-muted">To be announced</p>}
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="font-medium tabular-nums">{s.perform_at ? at(s.perform_at) : "TBA"}</p>
                {band && <Status band={band} round={round} track={track} />}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Band name, school and class; warm-up details; and headcounts when the database shares them. */
function BandLines({ band, slot, at }: { band: LeadBand; slot?: Slot; at?: (iso: string) => string }) {
  const vehicles = [
    [band.bus_count, "bus", "buses"],
    [band.box_truck_count, "box truck", "box trucks"],
    [band.truck_trailer_count, "truck + trailer", "trucks + trailers"],
    [band.semi_truck_count, "semi", "semis"],
  ] as const;
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium">{band.band_name}</p>
      <p className="text-sm text-muted">
        {band.school_name} · {band.classification}
      </p>
      {slot?.warm_up_at && at && (
        <p className="text-sm text-muted">
          Warm-up {at(slot.warm_up_at)}
          {slot.warm_up_minutes ? ` (${slot.warm_up_minutes} min)` : ""}
          {slot.warm_up_location ? ` · ${slot.warm_up_location}` : ""}
        </p>
      )}
      {band.student_count != null && (
        <p className="text-sm text-muted">
          {[
            `${band.student_count} students`,
            `${band.chaperone_count} chaperones`,
            ...vehicles.filter(([n]) => n).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`),
          ].join(" · ")}
        </p>
      )}
    </div>
  );
}
