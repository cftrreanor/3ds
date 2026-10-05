/** Contest day: the ordered check-in stations a band moves through, and how each reads. */

export type CheckpointKind = "parking" | "stop" | "warm_up" | "gate";
export type Round = "prelims" | "finals";

export const CHECKPOINT_KINDS: { value: CheckpointKind; label: string; hint: string }[] = [
  { value: "parking", label: "Parking", hint: "Buses and equipment arriving, equipment spots, leaving" },
  { value: "stop", label: "Check-in point", hint: "One “Here” tap, e.g. the check-in table" },
  { value: "warm_up", label: "Warm-up", hint: "One “Here” tap, due at the band’s warm-up time" },
  { value: "gate", label: "Gate", hint: "“Here” due at the ready time, then “Performed”" },
];
export const kindLabel = (k: CheckpointKind) => CHECKPOINT_KINDS.find((x) => x.value === k)?.label ?? k;

/** Check-in stations first, in their order; then everything else as before. */
export function sortStations<T extends { checkpoint_order: number | null }>(stations: T[]): T[] {
  return [...stations].sort((a, b) => (a.checkpoint_order ?? Infinity) - (b.checkpoint_order ?? Infinity));
}

/** A check-in station, as the contest-day screens need it. */
export type Checkpoint = {
  id: string;
  name: string;
  checkpoint_kind: CheckpointKind;
  checkpoint_order: number;
  /** Parking and check-in points: due this long before the band's warm-up (null: no deadline). */
  due_minutes_before_warm_up?: number | null;
};
/** One "Here" (or the gate's "Performed"). */
export type Stop = { band_id: string; station_id: string; round: Round | null; performed: boolean; reached_at: string };

/** A band's contest-day fields, as event_bands() returns them. */
export type BandDay = {
  id: string;
  bus_count: number;
  box_truck_count: number;
  truck_trailer_count: number;
  semi_truck_count: number;
  buses_at: string | null;
  equipment_at: string | null;
  equipment_spot: number | null;
  away_at: string | null;
  left_at: string | null;
  scratched_at: string | null;
};

export type Tone = "red" | "gold" | "green" | "neutral";

export const hasEquipment = (b: BandDay) => b.box_truck_count + b.truck_trailer_count + b.semi_truck_count > 0;
const needsBuses = (b: BandDay) => b.bus_count > 0;

/** Parking: what's here. A band with no equipment (or no buses) doesn't wait on it. */
export function parking(b: BandDay): { key: "nothing" | "buses" | "equipment" | "all" | "away" | "left"; label: string; tone: Tone } {
  if (b.left_at) return { key: "left", label: "Left for the day", tone: "neutral" };
  if (b.away_at) return { key: "away", label: "Away, coming back", tone: "gold" };
  const buses = !needsBuses(b) || !!b.buses_at;
  const equipment = !hasEquipment(b) || !!b.equipment_at;
  if (buses && equipment && (b.buses_at || b.equipment_at)) return { key: "all", label: "All on-site", tone: "green" };
  if (b.buses_at && !equipment) return { key: "buses", label: "Buses on-site", tone: "gold" };
  if (b.equipment_at && !buses) return { key: "equipment", label: "Equipment on-site", tone: "gold" };
  return { key: "nothing", label: "Nothing on-site", tone: "red" };
}

/** Does this stop count for the round? Parking and check-in points count for both. */
const inRound = (s: Stop, round: Round) => s.round === null || s.round === round;

/** The furthest station the band has reached along the path, for one round. */
export function furthest(b: BandDay, stops: Stop[], path: Checkpoint[], round: Round) {
  const mine = stops.filter((s) => s.band_id === b.id && inRound(s, round));
  if (mine.some((s) => s.performed)) return { performed: true as const, station: undefined };
  const reached = path.filter((c) => mine.some((s) => s.station_id === c.id));
  return { performed: false as const, station: reached.at(-1) };
}

/** Where the band is overall, for one round. */
export function whereIs(b: BandDay, stops: Stop[], path: Checkpoint[], round: Round = "prelims"): { label: string; tone: Tone } {
  if (b.scratched_at) return { label: "Scratched", tone: "neutral" };
  const f = furthest(b, stops, path, round);
  if (f.performed) return { label: "Performed", tone: "neutral" };
  if (f.station) return { label: `At ${f.station.name}`, tone: "green" };
  const p = parking(b);
  if (p.key === "nothing") return { label: "Not here yet", tone: "red" };
  return { label: p.label, tone: p.tone };
}

/** "3 buses · 1 box truck" from registration. */
export function vehicles(b: BandDay) {
  return (
    [
      [b.bus_count, "bus", "buses"],
      [b.box_truck_count, "box truck", "box trucks"],
      [b.truck_trailer_count, "truck + trailer", "trucks + trailers"],
      [b.semi_truck_count, "semi", "semis"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(" · ");
}

/** How each logged tap reads in "Last: … · Lee, 9:05 AM". */
export const ACTION_LABEL: Record<string, string> = {
  buses_here: "Buses here",
  equipment_here: "Equipment here",
  away: "Away",
  back: "Back on-site",
  left: "Left for the day",
  here: "Here",
  performed: "Performed",
  scratched: "Scratched",
  unscratched: "Un-scratched",
};
