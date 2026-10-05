/** Contest day: which band steps a station handles, and how each step reads. */

export type Duty = "parking" | "check_in" | "warm_up" | "gate";
export type RoundStep = "warming_up" | "at_gate" | "on_field" | "performed";
export type Round = "prelims" | "finals";

export const DUTIES: { value: Duty; label: string; hint: string }[] = [
  { value: "parking", label: "Parking", hint: "Buses and equipment arriving, equipment spots, leaving" },
  { value: "check_in", label: "Check-in", hint: "The band checks in at the table" },
  { value: "warm_up", label: "Warm-up", hint: "Warming up, then sent to the gate" },
  { value: "gate", label: "Gate", hint: "On the field, then done" },
];

export const dutyLabel = (d: Duty) => DUTIES.find((x) => x.value === d)?.label ?? d;

export const STEP_LABEL: Record<RoundStep, string> = {
  warming_up: "Warming up",
  at_gate: "At the gate",
  on_field: "On the field",
  performed: "Done",
};

/** A band's contest-day fields, as event_bands() returns them. */
export type BandDay = {
  bus_count: number;
  box_truck_count: number;
  truck_trailer_count: number;
  semi_truck_count: number;
  buses_at: string | null;
  equipment_at: string | null;
  equipment_spot: number | null;
  away_at: string | null;
  left_at: string | null;
  checked_in_at: string | null;
  scratched_at: string | null;
  prelims_step: RoundStep | null;
  finals_step: RoundStep | null;
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

/** Where the band is overall, for one round. */
export function whereIs(b: BandDay, round: Round = "prelims"): { label: string; tone: Tone } {
  if (b.scratched_at) return { label: "Scratched", tone: "neutral" };
  const step = round === "finals" ? b.finals_step : b.prelims_step;
  if (step) return { label: STEP_LABEL[step], tone: step === "performed" ? "neutral" : "green" };
  if (b.left_at) return { label: "Left for the day", tone: "neutral" };
  if (b.away_at) return { label: "Away, coming back", tone: "gold" };
  if (b.checked_in_at) return { label: "Checked in", tone: "green" };
  const p = parking(b);
  return { label: p.key === "nothing" ? "Not here yet" : p.label, tone: p.tone };
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
  checked_in: "Checked in",
  warming_up: "Started warm-up",
  at_gate: "Sent to the gate",
  on_field: "On the field",
  performed: "Done",
  scratched: "Scratched",
  unscratched: "Un-scratched",
};
