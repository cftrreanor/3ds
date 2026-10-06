import "server-only";
import { kindLabel, eventPhase, type CheckpointKind } from "@/lib/contest-day";
import { formatPhone } from "@/lib/phone";
import type { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import type { LeadStation } from "./lead-stations";
import type { RosterEntry, Shift } from "./station-panel";

type StationRow = {
  id: string;
  name: string;
  checkpoint_kind: CheckpointKind | null;
  checkpoint_order: number | null;
  location: string | null;
  instructions: string | null;
};

/**
 * What a Section Lead sees for each station they lead: its shifts and who's on
 * them. Contact details come from station_roster(), which only releases them
 * on event day.
 */
export async function loadLeadStations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stations: StationRow[],
  event: { timezone: string; starts_on: string; ends_on: string },
): Promise<LeadStation[]> {
  if (stations.length === 0) return [];
  const [{ data: shiftData }, rosters] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, station_id, title, description, starts_at, ends_at, max_capacity, registered_count")
      .in(
        "station_id",
        stations.map((s) => s.id),
      )
      .order("starts_at"),
    Promise.all(
      stations.map(async (s) => ((await supabase.rpc("station_roster", { p_station_id: s.id })).data ?? []) as RosterEntry[]),
    ),
  ]);
  const shifts = (shiftData ?? []) as Shift[];
  const tz = event.timezone;
  const multiDay = event.starts_on !== event.ends_on;
  const now = new Date();
  const day = eventPhase(event, now) === "day";

  return stations.map((station, i) => ({
    id: station.id,
    name: station.name,
    checkpoint: station.checkpoint_kind ? `Check-in stop ${station.checkpoint_order} · ${kindLabel(station.checkpoint_kind)}` : null,
    location: station.location,
    instructions: station.instructions,
    shifts: shifts
      .filter((sh) => sh.station_id === station.id)
      .map((sh) => ({
        id: sh.id,
        title: sh.title,
        time: `${multiDay ? `${formatDate(utcToZonedDate(sh.starts_at, tz), { year: undefined })} · ` : ""}${formatTimeRange(sh.starts_at, sh.ends_at, tz)}`,
        capacity: sh.max_capacity,
        now: day && new Date(sh.starts_at) <= now && now < new Date(sh.ends_at),
        over: day && new Date(sh.ends_at) <= now,
        volunteers: rosters[i]
          .filter((v) => v.shift_id === sh.id)
          .sort((a, b) => a.volunteer_name.localeCompare(b.volunteer_name))
          .map((v) => ({
            assignmentId: v.assignment_id,
            name: v.volunteer_name,
            phone: v.phone,
            phoneDisplay: v.phone ? formatPhone(v.phone) : null,
            checkedIn: Boolean(v.checked_in_at),
          })),
      })),
  }));
}
