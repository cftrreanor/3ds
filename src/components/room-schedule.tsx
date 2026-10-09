import { Card } from "@/components/ui";
import { formatDate, formatTime, utcToZonedDate } from "@/lib/time";

export type ScheduleRoom = { id: string; name: string; note: string | null; path_order: number | null };
export type ScheduleSlot = {
  room_id: string;
  starts_at: string;
  ends_at: string;
  band_name: string;
  school_name: string;
  classification?: string | null;
};

/**
 * A choir festival's schedule, room by room: who's in each room and when.
 * On the day, each room shows who's in it now and who's next.
 */
export function RoomSchedule({
  rooms,
  slots,
  timezone,
  live = false,
  columns = 2,
}: {
  rooms: ScheduleRoom[];
  slots: ScheduleSlot[];
  timezone: string;
  /** The event is today: mark now and next in each room. */
  live?: boolean;
  /** Rooms side by side on wide screens (1 on narrow pages). */
  columns?: 1 | 2;
}) {
  const now = new Date().getTime();
  const path = rooms.filter((r) => r.path_order != null).sort((a, b) => a.path_order! - b.path_order!);
  const multiDay = new Set(slots.map((s) => utcToZonedDate(s.starts_at, timezone))).size > 1;
  return (
    <div className={`grid gap-4 ${columns === 2 ? "lg:grid-cols-2" : ""}`}>
      {path.map((room) => {
        const list = slots.filter((s) => s.room_id === room.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        const current = live ? list.find((s) => new Date(s.starts_at).getTime() <= now && now < new Date(s.ends_at).getTime()) : undefined;
        const next = live ? list.find((s) => new Date(s.starts_at).getTime() > now) : undefined;
        return (
          <Card key={room.id} className="p-4">
            <h3 className="text-lg font-semibold">{room.name}</h3>
            {room.note && <p className="text-sm text-muted">{room.note}</p>}
            {live && (current || next) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {current && <NowNext label="Now" slot={current} timezone={timezone} />}
                {next && <NowNext label="Up next" slot={next} timezone={timezone} />}
              </div>
            )}
            {list.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No choirs scheduled here yet.</p>
            ) : (
              <ol className="mt-3 divide-y divide-border">
                {list.map((s) => {
                  const done = live && new Date(s.ends_at).getTime() <= now;
                  const isNow = s === current;
                  return (
                    <li key={`${s.room_id}-${s.starts_at}-${s.band_name}`} className={`flex gap-3 py-2 text-sm ${done ? "text-muted" : ""}`}>
                      <span className="w-28 shrink-0 tabular-nums">
                        {multiDay && `${formatDate(utcToZonedDate(s.starts_at, timezone), { year: undefined, weekday: undefined })} `}
                        {formatTime(s.starts_at, timezone)}
                      </span>
                      <span className="min-w-0">
                        <span className={isNow ? "font-semibold text-brand" : "font-medium"}>{s.band_name}</span>
                        <span className="text-muted">
                          {" "}
                          · {s.school_name}
                          {s.classification ? ` · ${s.classification}` : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        );
      })}
      {rooms
        .filter((r) => r.path_order == null)
        .map((room) => (
          <Card key={room.id} className="p-4">
            <h3 className="font-semibold">{room.name}</h3>
            {room.note && <p className="text-sm text-muted">{room.note}</p>}
          </Card>
        ))}
    </div>
  );
}

function NowNext({ label, slot, timezone }: { label: string; slot: ScheduleSlot; timezone: string }) {
  return (
    <div className={`rounded-md px-3 py-2 ${label === "Now" ? "bg-brand-soft" : "bg-background"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label} · {formatTime(slot.starts_at, timezone)}
      </p>
      <p className="font-semibold">{slot.band_name}</p>
      <p className="text-sm text-muted">{slot.school_name}</p>
    </div>
  );
}
