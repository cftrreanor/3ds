import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { eventPhase, kindLabel, sortStations, type CheckpointKind } from "@/lib/contest-day";
import { getEventAccess } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { addWalkUp, releaseSpot, setCheckedIn } from "./actions";
import { Desk, type DeskStation } from "./desk";

export const metadata: Metadata = { title: "Volunteer Check-in" };

type StationRow = { id: string; name: string; checkpoint_kind: CheckpointKind | null; checkpoint_order: number | null; adults_only: boolean };
type ShiftRow = { id: string; station_id: string; title: string; starts_at: string; ends_at: string; max_capacity: number };
type Row = {
  id: string;
  shift_id: string;
  checked_in_at: string | null;
  volunteers: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    walk_up: boolean;
    minor: boolean;
    contact: { full_name: string } | null;
  } | null;
};

/** The volunteer desk on the day of the event: a tab per station, check-in, walk-ups and no-shows. */
export default async function VolunteersPage({ params }: PageProps<"/dashboard/events/[eventId]/volunteers">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, timezone, starts_on, ends_on")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();

  const [{ data: stationData }, { data: shiftData }, { data: rowData }, { data: consentData }] = await Promise.all([
    supabase
      .from("stations")
      // Every column: showing arrives with the 20270105000000 update.
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase.from("shifts").select("id, station_id, title, starts_at, ends_at, max_capacity").eq("event_id", eventId).order("starts_at"),
    supabase
      .from("volunteer_assignments")
      .select("id, shift_id, checked_in_at, volunteers(id, full_name, email, phone, walk_up, minor, contact:volunteers!contact_id(full_name)), shifts!inner(event_id)")
      .eq("shifts.event_id", eventId),
    // Minors whose parent or guardian confirmed at sign-up (none before the 20270102000000 update).
    supabase.from("minor_consents").select("volunteer_id").eq("event_id", eventId),
  ]);
  const confirmed = new Set((consentData ?? []).map((c) => c.volunteer_id as string));

  const tz = event.timezone;
  const multiDay = event.starts_on !== event.ends_on;
  const now = new Date();
  const eventDay = eventPhase(event, now) === "day";
  // Check-in and walk-ups from the day before (setup, a practice run) through the event, not weeks ahead.
  const today = utcToZonedDate(now.toISOString(), event.timezone);
  const dayBefore = new Date(Date.parse(`${event.starts_on}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const open = today >= dayBefore && today <= event.ends_on;
  const rows = (rowData ?? []) as unknown as Row[];
  const shifts = (shiftData ?? []) as ShiftRow[];

  // Same station order as everywhere else: the bands' check-in path first.
  // Stations without shifts (a gate run by its lead alone) have no one to check in.
  // Hidden jobs take no sign-ups or walk-ups, so the desk leaves them out.
  const stations: DeskStation[] = sortStations((stationData ?? []) as (StationRow & { showing?: boolean })[])
    .filter((st) => st.showing !== false && shifts.some((sh) => sh.station_id === st.id))
    .map((st) => ({
    id: st.id,
    name: st.name,
    kind: st.checkpoint_kind ? kindLabel(st.checkpoint_kind) : null,
    adultsOnly: st.adults_only,
    shifts: shifts
      .filter((sh) => sh.station_id === st.id)
      .map((sh) => {
        const started = eventDay && new Date(sh.starts_at) <= now;
        const over = eventDay && new Date(sh.ends_at) <= now;
        return {
          id: sh.id,
          title: sh.title,
          time: `${multiDay ? `${formatDate(utcToZonedDate(sh.starts_at, tz), { year: undefined })} · ` : ""}${formatTimeRange(sh.starts_at, sh.ends_at, tz)}`,
          capacity: sh.max_capacity,
          started,
          now: started && !over,
          over,
          volunteers: rows
            .filter((r) => r.shift_id === sh.id && r.volunteers)
            .map((r) => ({
              assignmentId: r.id,
              name: r.volunteers!.full_name,
              phone: r.volunteers!.phone,
              phoneDisplay: r.volunteers!.phone ? formatPhone(r.volunteers!.phone) : null,
              email: r.volunteers!.email,
              walkUp: r.volunteers!.walk_up,
              minor: r.volunteers!.minor,
              signedUpBy: r.volunteers!.contact?.full_name ?? null,
              guardianConfirmed: confirmed.has(r.volunteers!.id),
              checkedIn: Boolean(r.checked_in_at),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
  }));

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Volunteer Check-in</h1>
      <p className="mt-1 mb-6 text-muted">
        Tap <strong className="text-foreground">Check in</strong> as people arrive at the volunteer desk. Someone new
        wants to help? Add them as a walk-up on a shift with open spots.
      </p>
      <AutoRefresh seconds={10} status className="-mt-4 mb-6" />
      <Desk
        stations={stations}
        eventDay={eventDay}
        open={open}
        opensOn={formatDate(dayBefore)}
        toggle={setCheckedIn.bind(null, eventId)}
        addWalkUp={addWalkUp.bind(null, eventId)}
        release={releaseSpot.bind(null, eventId)}
      />
    </div>
  );
}
