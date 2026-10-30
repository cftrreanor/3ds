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
  return {
    filled: liveShifts.reduce((n, s) => n + s.registered_count, 0) + liveItems.reduce((n, i) => n + i.claimed_count, 0),
    capacity: liveShifts.reduce((n, s) => n + s.max_capacity, 0) + liveItems.reduce((n, i) => n + i.needed, 0),
    liveShifts,
    liveItems,
  };
}

/** "3 jobs are hidden, 2 ready to show", the same words wherever hidden jobs are counted. */
export function hiddenJobsSentence(hidden: { ready: boolean }[]) {
  const ready = hidden.filter((j) => j.ready).length;
  const head = `${hidden.length} ${hidden.length === 1 ? "job is" : "jobs are"} hidden`;
  if (ready === hidden.length) return hidden.length === 1 ? `${head} and ready to show` : `${head}, all ready to show`;
  return ready ? `${head}, ${ready} ready to show` : head;
}
