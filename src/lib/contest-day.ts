/** Contest day: the ordered check-in stations a band moves through, and how each reads. */

import { utcToZonedDate } from "@/lib/time";

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
  clear_buses: "Took back Buses here",
  clear_equipment: "Took back Equipment here",
  clear_left: "Took back Left for the day",
  clear_here: "Took back Here",
  clear_performed: "Took back Performed",
};

// ---------------------------------------------------------------------------
// On track? Each band is due at parking (and any check-in point with a
// deadline) a set time before its warm-up, and at warm-up by its warm-up
// time. Hosts hear about a band before the deadline ("due soon"), not just after.
// ---------------------------------------------------------------------------

/** How far ahead a deadline counts as "due soon". */
export const DUE_SOON_MINUTES = 15;

export type CheckState = "done" | "late" | "soon" | "upcoming" | "none";
export type Check = {
  station: Checkpoint;
  /** When the band is due at this station (null: no deadline). */
  due: string | null;
  state: CheckState;
  /** Minutes late ("late") or until due ("soon"/"upcoming"). */
  minutes: number;
};
/** The band's prelims times from the schedule. */
export type SlotTimes = { warm_up_at: string | null; perform_at: string | null } | undefined;

const minusMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();

/** When this station expects the band, from its prelims schedule. */
export function dueAt(station: Checkpoint, slot: SlotTimes, readyMinutes: number): string | null {
  switch (station.checkpoint_kind) {
    case "warm_up":
      return slot?.warm_up_at ?? null;
    case "gate":
      return slot?.perform_at ? minusMinutes(slot.perform_at, readyMinutes) : null;
    default: {
      const before = station.due_minutes_before_warm_up;
      return slot?.warm_up_at && before != null ? minusMinutes(slot.warm_up_at, before) : null;
    }
  }
}

/** Has the band done this station (prelims)? Parking counts once buses and equipment are in. */
export function doneAt(b: BandDay, station: Checkpoint, stops: Stop[]): boolean {
  if (station.checkpoint_kind === "parking") return ["all", "away", "left"].includes(parking(b).key);
  return stops.some((s) => s.band_id === b.id && s.station_id === station.id && (s.round === null || s.round === "prelims"));
}

/** The band's check at every station on the path, as of `now`. */
export function bandChecks(b: BandDay, stops: Stop[], path: Checkpoint[], slot: SlotTimes, readyMinutes: number, now: Date): Check[] {
  return path.map((station) => {
    const due = dueAt(station, slot, readyMinutes);
    if (doneAt(b, station, stops)) return { station, due, state: "done", minutes: 0 };
    if (!due || b.scratched_at || b.left_at) return { station, due, state: "none", minutes: 0 };
    const diff = Math.round((new Date(due).getTime() - now.getTime()) / 60_000);
    if (diff < 0) return { station, due, state: "late", minutes: -diff };
    return { station, due, state: diff <= DUE_SOON_MINUTES ? "soon" : "upcoming", minutes: diff };
  });
}

/** The checks that decide "are we on time": parking, check-in points and warm-up (not the gate). */
export const countsForOnTrack = (c: Check) => c.station.checkpoint_kind !== "gate";

/** What a check is waiting on, e.g. "equipment not parked" or "not at Warm-Up". */
export function waitingOn(b: BandDay, c: Check): string {
  if (c.station.checkpoint_kind !== "parking") return `not at ${c.station.name}`;
  const p = parking(b);
  if (p.key === "buses") return "equipment not parked";
  if (p.key === "equipment") return "buses not here";
  return "not parked";
}

export type Attention<B extends BandDay = BandDay> = { band: B; check: Check };
export type OnTrack<B extends BandDay = BandDay> = {
  /** "before" / "after": not contest day, so nothing is late (no false alarms). */
  phase: Phase;
  tone: "green" | "gold" | "red" | "neutral";
  late: Attention<B>[];
  soon: Attention<B>[];
  /** Has anyone been tapped in anywhere yet today? */
  started: boolean;
  /** The earliest deadline still to come, for "first band due 7:00 AM". */
  firstDue: string | null;
  /** Bands fully parked, out of those expected (bands not scratched). */
  parked: number;
  expected: number;
};

export type Phase = "before" | "day" | "after";

/** Is it before, on, or after the event's day(s), in the event's time zone? */
export function eventPhase(e: { starts_on: string; ends_on: string; timezone: string }, now: Date): Phase {
  const today = utcToZonedDate(now.toISOString(), e.timezone);
  return today < e.starts_on ? "before" : today > e.ends_on ? "after" : "day";
}

/** The whole event: who's behind (most late first) and who's due soon (soonest first). */
export function onTrack<B extends BandDay>(
  bands: B[],
  stops: Stop[],
  path: Checkpoint[],
  slotOf: (bandId: string) => SlotTimes,
  readyMinutes: number,
  now: Date,
  phase: Phase,
): OnTrack<B> {
  const parkingStation = path.find((c) => c.checkpoint_kind === "parking");
  const active = bands.filter((b) => !b.scratched_at);
  const progress = {
    started: stops.length > 0 || bands.some((b) => b.buses_at || b.equipment_at),
    parked: parkingStation ? active.filter((b) => doneAt(b, parkingStation, stops)).length : 0,
    expected: active.length,
  };
  if (phase !== "day") return { phase, tone: "neutral", late: [], soon: [], firstDue: null, ...progress };
  const items = bands.flatMap((band) =>
    bandChecks(band, stops, path, slotOf(band.id), readyMinutes, now)
      .filter(countsForOnTrack)
      .map((check) => ({ band, check })),
  );
  const late = items.filter((i) => i.check.state === "late").sort((a, b) => b.check.minutes - a.check.minutes);
  const soon = items.filter((i) => i.check.state === "soon").sort((a, b) => a.check.minutes - b.check.minutes);
  const firstDue =
    items
      .filter((i) => i.check.state === "upcoming")
      .map((i) => i.check.due!)
      .sort()[0] ?? null;
  return { phase, tone: late.length ? "red" : soon.length ? "gold" : "green", late, soon, firstDue, ...progress };
}
