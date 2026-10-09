// Group events: rooms, the path every group follows, and each group's
// times. The same arithmetic as rebuild_room_slots() in
// supabase/migrations/20261103000000_group_events.sql, so the schedule
// builder can preview times before saving.

export type Room = { id: string; name: string; note: string | null; path_order: number | null; minutes: number };

export type GroupPlan = {
  bandId: string;
  /** Rooms on the path this group doesn't visit. */
  skipped: string[];
  /** A break before this group (pushes it and everyone after it later). */
  extraMinutes: number;
};

export type RoomTime = { roomId: string; startsAt: Date; endsAt: Date };

/** The rooms every group visits, in order. */
export const pathRooms = (rooms: Room[]) =>
  rooms.filter((r) => r.path_order != null).sort((a, b) => a.path_order! - b.path_order!);

/** Each group's time in each room, in path order. */
export function roomTimes(
  start: Date,
  intervalMinutes: number,
  passingMinutes: number,
  rooms: Room[],
  order: GroupPlan[],
): Map<string, RoomTime[]> {
  const path = pathRooms(rooms);
  const out = new Map<string, RoomTime[]>();
  let breaks = 0;
  order.forEach((c, i) => {
    breaks += c.extraMinutes;
    const base = start.getTime() + (i * intervalMinutes + breaks) * 60_000;
    let offset = 0;
    const times: RoomTime[] = [];
    for (const r of path) {
      // A skipped room keeps its place in time, so rooms never double-book.
      if (!c.skipped.includes(r.id)) {
        times.push({
          roomId: r.id,
          startsAt: new Date(base + offset * 60_000),
          endsAt: new Date(base + (offset + r.minutes) * 60_000),
        });
      }
      offset += r.minutes + passingMinutes;
    }
    out.set(c.bandId, times);
  });
  return out;
}

/** Groups start one interval apart; a room longer than that would hold two groups at once. */
export const tooLongRooms = (rooms: Room[], intervalMinutes: number) =>
  pathRooms(rooms).filter((r) => r.minutes > intervalMinutes);
