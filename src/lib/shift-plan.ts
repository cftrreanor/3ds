/**
 * "Fill the day": splits a stretch of time (From to To, in minutes after midnight) into shifts of one
 * length. With an overlap, every shift after the first starts that much earlier, so the next volunteer
 * arrives before the last one leaves; the boundaries stay on the grid (8:00, 9:45–12:00, 11:45–2:00).
 * A To earlier than From runs past midnight. The last shift ends at To, even if that makes it short.
 */
export function planShifts(from: number, to: number, length: number, overlap = 0): { start: number; end: number }[] {
  if (length <= 0) return [];
  const end = to <= from ? to + 24 * 60 : to;
  const out: { start: number; end: number }[] = [];
  for (let t = from; t < end && out.length < 100; t += length) {
    out.push({ start: out.length ? Math.max(from, t - overlap) : t, end: Math.min(t + length, end) });
  }
  return out;
}

/** "07:30" → 450. */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** 450 → "7:30 AM" (minutes past midnight, wrapping past the next midnight). */
export function clockLabel(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** The overlap choices, in minutes: 5-minute steps up to half an hour. */
export const OVERLAPS = [5, 10, 15, 20, 25, 30] as const;

/** 135 → "2 hours 15 minutes", 60 → "1 hour", 45 → "45 minutes". */
export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hour${h === 1 ? "" : "s"}` : null, m ? `${m} minutes` : null].filter(Boolean).join(" ");
}
