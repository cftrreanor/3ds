// Wall-clock schedule math shared by the schedule builder. Times are "HH:MM"
// strings in the event's time zone; minutes are counted from midnight.

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const toTime = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** "13:30" → "1:30 PM" */
export function displayTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export type Span = { start: number; end: number };

/**
 * Performance times for `count` bands, `slot` minutes apart from `first`,
 * pushed past any break a performance would run into.
 */
export function performTimes(count: number, first: number, slot: number, breaks: Span[]) {
  const sorted = [...breaks].sort((a, b) => a.start - b.start);
  const times: number[] = [];
  let t = first;
  for (let i = 0; i < count; i++) {
    for (const b of sorted) if (t < b.end && t + slot > b.start) t = b.end;
    times.push(t);
    t += slot;
  }
  return times;
}
