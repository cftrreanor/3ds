import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { eachDate, formatDate, formatDateRange, formatTime, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { createShift, createStation, deleteShift, deleteStation, generateShifts } from "../../actions";
import { AddShiftForm, AddStationForm, DeleteButton, GenerateShiftsForm } from "./forms";

export const metadata: Metadata = { title: "Event setup" };

type Shift = {
  id: string;
  station_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  max_capacity: number;
  registered_count: number;
};

export default async function EventPage({ params }: PageProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, status, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: stations }, { data: shifts }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, station_type, location, instructions")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shifts")
      .select("id, station_id, title, starts_at, ends_at, max_capacity, registered_count")
      .eq("event_id", eventId)
      .order("starts_at"),
  ]);

  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);
  const multiDay = days.length > 1;
  const windowLabel = `${formatTime(event.window_start, tz)} – ${formatTime(event.window_end, tz)}`;
  const shiftsByStation = new Map<string, Shift[]>();
  for (const s of (shifts ?? []) as Shift[]) {
    shiftsByStation.set(s.station_id, [...(shiftsByStation.get(s.station_id) ?? []), s]);
  }
  const totalSlots = (shifts ?? []).reduce((n, s) => n + s.max_capacity, 0);

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-1 text-muted">
            {formatDateRange(event.starts_on, event.ends_on)} · {windowLabel}
          </p>
          <p className="mt-1 text-sm text-muted">
            {[event.venue_name, event.venue_address].filter(Boolean).join(" · ")}
            {" · "}
            <a
              href={mapsUrl(event.venue_address, event.venue_place_id)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Map
            </a>
          </p>
        </div>
        <Badge tone={event.status === "published" ? "brand" : "neutral"}>
          {event.status === "published" ? "Published" : "Draft: only your team can see this"}
        </Badge>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">Stations &amp; volunteer shifts</h2>
          {totalSlots > 0 && (
            <p className="text-sm text-muted">
              {stations?.length} station{stations?.length === 1 ? "" : "s"} · {shifts?.length} shifts ·{" "}
              {totalSlots} volunteer slots
            </p>
          )}
        </div>

        {(stations ?? []).length === 0 && (
          <p className="mt-2 max-w-2xl leading-7 text-muted">
            A station is a place or job volunteers are assigned to, like Parking, Concessions or a Warm-Up
            area. Add your first one below, then create its shifts.
          </p>
        )}

        <div className="mt-6 space-y-6">
          {(stations ?? []).map((station) => {
            const stationShifts = shiftsByStation.get(station.id) ?? [];
            return (
              <Card key={station.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{station.name}</h3>
                      {station.station_type === "active_checkpoint" && <Badge tone="accent">Band checkpoint</Badge>}
                    </div>
                    {station.location && <p className="mt-1 text-sm text-muted">{station.location}</p>}
                  </div>
                  <DeleteButton
                    action={deleteStation.bind(null, eventId, station.id)}
                    label={`Delete station ${station.name}`}
                    confirmMessage={`Delete “${station.name}” and all of its shifts?`}
                  />
                </div>

                {stationShifts.length > 0 ? (
                  <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                    {stationShifts.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.title}</p>
                          <p className="text-sm text-muted">
                            {multiDay && `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · `}
                            {formatTimeRange(s.starts_at, s.ends_at, tz)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm tabular-nums text-muted">
                            {s.registered_count} / {s.max_capacity} filled
                          </span>
                          <DeleteButton
                            action={deleteShift.bind(null, eventId, s.id)}
                            label={`Delete shift ${s.title}`}
                            confirmMessage={`Delete “${s.title}”?`}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted">No shifts yet.</p>
                )}

                <div className="mt-4 flex flex-col gap-3">
                  <details className="group rounded-lg border border-border px-4 py-3" open={stationShifts.length === 0}>
                    <summary className="cursor-pointer text-sm font-medium">Fill the day with shifts</summary>
                    <div className="mt-4">
                      <GenerateShiftsForm
                        action={generateShifts.bind(null, eventId, station.id)}
                        windowLabel={windowLabel}
                      />
                    </div>
                  </details>
                  <details className="rounded-lg border border-border px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium">Add a single shift</summary>
                    <div className="mt-4">
                      <AddShiftForm action={createShift.bind(null, eventId, station.id)} days={days} />
                    </div>
                  </details>
                </div>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <h3 className="mb-4 font-semibold">Add a station</h3>
            <AddStationForm action={createStation.bind(null, eventId)} />
          </Card>
        </div>
      </section>
    </div>
  );
}

function mapsUrl(address: string, placeId: string | null) {
  const params = new URLSearchParams({ api: "1", query: address });
  if (placeId) params.set("query_place_id", placeId);
  return `https://www.google.com/maps/search/?${params}`;
}
