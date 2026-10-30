/**
 * How full an event's volunteer jobs are, counted the same way on every page:
 * shifts and things to bring, for the jobs volunteers can see (hidden jobs
 * take no sign-ups, so they'd only add empty spots).
 */
export function volunteerTotals<
  S extends { station_id: string; registered_count: number; max_capacity: number },
  I extends { station_id: string; claimed_count: number; needed: number },
>(stations: { id: string; showing?: boolean }[], shifts: S[], items: I[]) {
  const counted = new Set(stations.filter((st) => st.showing !== false).map((st) => st.id));
  const liveShifts = shifts.filter((s) => counted.has(s.station_id));
  const liveItems = items.filter((i) => counted.has(i.station_id));
  const shiftFilled = liveShifts.reduce((n, s) => n + s.registered_count, 0);
  const shiftCapacity = liveShifts.reduce((n, s) => n + s.max_capacity, 0);
  const itemFilled = liveItems.reduce((n, i) => n + i.claimed_count, 0);
  const itemCapacity = liveItems.reduce((n, i) => n + i.needed, 0);
  // Shift spots and things to bring are different kinds of help, so they're counted apart in words.
  const parts = [
    liveShifts.length ? `${shiftFilled} of ${shiftCapacity} shift spots filled` : null,
    liveItems.length ? `${itemFilled} of ${itemCapacity} things to bring covered` : null,
  ].filter(Boolean);
  return {
    /** "3 of 8 shift spots filled · 2 of 12 things to bring covered". */
    sentence: parts.length ? parts.join(" · ") : "0 of 0 spots filled",
    filled: liveShifts.reduce((n, s) => n + s.registered_count, 0) + liveItems.reduce((n, i) => n + i.claimed_count, 0),
    capacity: liveShifts.reduce((n, s) => n + s.max_capacity, 0) + liveItems.reduce((n, i) => n + i.needed, 0),
    liveShifts,
    liveItems,
  };
}
