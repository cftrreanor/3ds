import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import { RoomSchedule, type ScheduleSlot } from "@/components/room-schedule";
import { Badge, Card } from "@/components/ui";
import { getEventAccess } from "@/lib/data";
import { hasRooms } from "@/lib/event-types";
import type { GroupPlan, Room } from "@/lib/rooms";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { eachDate, utcToZonedDate, utcToZonedTime, zoneName } from "@/lib/time";
import { ActionButton } from "../forms";
import { saveRooms, saveRoomSchedule, setRoomSchedulePosted } from "./actions";
import { RoomsEditor } from "./rooms-editor";
import { ScheduleEditor, type ScheduleGroup } from "./schedule-editor";

export const metadata: Metadata = { title: "Rooms & schedule" };

/** Group events: hosts set up the rooms and the groups' order; the team sees the schedule. */
export default async function RoomsPage({ params }: PageProps<"/dashboard/events/[eventId]/rooms">) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, access, { data: onTeam }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, slug, name, status, event_type, timezone, starts_on, ends_on, window_start, performance_order_published, room_schedule_start, room_interval_minutes, room_passing_minutes",
      )
      .eq("id", eventId)
      .maybeSingle(),
    getEventAccess(eventId),
    supabase.rpc("is_event_staff", { ev: eventId }),
  ]);
  if (!event) missing();
  if (!hasRooms(event.event_type) || !onTeam) redirect(`/dashboard/events/${eventId}`);

  const [{ data: roomData }, { data: slotData }, { data: orderData }, { data: bandData }] = await Promise.all([
    supabase.from("rooms").select("id, name, note, path_order, minutes").eq("event_id", eventId).order("created_at"),
    supabase.from("room_slots").select("room_id, band_id, starts_at, ends_at").eq("event_id", eventId).order("starts_at"),
    access.isHost
      ? supabase.from("group_order").select("band_id, position, skipped_room_ids, extra_minutes_before").eq("event_id", eventId).order("position")
      : Promise.resolve({ data: [] }),
    // Hosts read every registration; the team gets names only.
    access.isHost
      ? supabase.from("bands").select("id, band_name, school_name, classification, contest_day_conflicts").eq("event_id", eventId).order("created_at")
      : supabase.rpc("event_bands", { ev: eventId }),
  ]);
  const rooms = (roomData ?? []) as Room[];
  const bands = (bandData ?? []) as { id: string; band_name: string; school_name: string; classification: string; contest_day_conflicts?: string | null }[];
  const bandById = new Map(bands.map((b) => [b.id, b]));
  const slots: ScheduleSlot[] = (slotData ?? []).flatMap((s) => {
    const b = bandById.get(s.band_id);
    return b ? [{ ...s, band_name: b.band_name, school_name: b.school_name, classification: b.classification }] : [];
  });

  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);
  const start = event.room_schedule_start ?? event.window_start;
  const today = utcToZonedDate(new Date().toISOString(), tz);
  const isEventDay = today >= event.starts_on && today <= event.ends_on;
  const groups: ScheduleGroup[] = bands.map((b) => ({
    id: b.id,
    name: b.band_name,
    school: b.school_name,
    classification: b.classification,
    conflicts: b.contest_day_conflicts ?? null,
  }));
  const order: GroupPlan[] = ((orderData ?? []) as { band_id: string; skipped_room_ids: string[]; extra_minutes_before: number }[]).map((o) => ({
    bandId: o.band_id,
    skipped: o.skipped_room_ids,
    extraMinutes: o.extra_minutes_before,
  }));

  return (
    <div>
      {isEventDay && event.performance_order_published && <AutoRefresh seconds={30} />}
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Rooms &amp; schedule</h1>
        <Badge tone={event.performance_order_published ? "brand" : "neutral"}>
          {event.performance_order_published ? "Posted: directors and the public can see it" : "Not posted yet"}
        </Badge>
      </div>

      {slots.length > 0 && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm leading-6 text-muted">
            On the day, use <span className="font-medium text-foreground">Event day</span> to check groups in, see who&apos;s
            running over{access.isHost ? " and push the schedule back" : ""}.
          </p>
          <Link
            href={`/dashboard/events/${eventId}/event-day`}
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Open event day
          </Link>
        </Card>
      )}

      {access.isHost && (
        <>
          <section className="mt-8" aria-labelledby="rooms-heading">
            <h2 id="rooms-heading" className="text-xl font-semibold">
              Rooms
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              Everything is at the event&apos;s address; use the note for a room number or directions inside the building.
            </p>
            <RoomsEditor key={rooms.map((r) => `${r.id}:${r.path_order}:${r.minutes}`).join(",")} rooms={rooms} save={saveRooms.bind(null, eventId)} />
          </section>

          <section className="mt-10" aria-labelledby="order-heading">
            <h2 id="order-heading" className="text-xl font-semibold">
              Group order
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              Every group follows the path in order. Groups start one gap apart, so a room is never double-booked. Directors&apos;
              scheduling conflicts are marked ⚠️.
            </p>
            <ScheduleEditor
              key={`${order.map((o) => `${o.bandId}:${o.extraMinutes}`).join(",")}|${start}|${bands.length}|${rooms.length}`}
              groups={groups}
              rooms={rooms}
              initialOrder={order}
              initialDate={utcToZonedDate(start, tz)}
              initialTime={utcToZonedTime(start, tz)}
              initialInterval={event.room_interval_minutes}
              initialPassing={event.room_passing_minutes}
              days={days}
              timezone={tz}
              zoneLabel={zoneName(tz)}
              posted={event.performance_order_published}
              save={saveRoomSchedule.bind(null, eventId)}
            />
          </section>

          <section className="mt-10">
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-6 text-muted">
                {event.performance_order_published
                  ? "The schedule is on the public page and on each director's page."
                  : event.status !== "published"
                    ? "Publish the event from its main page, then post the schedule."
                    : "When it looks right, post it: it goes on the public page and each director gets their group's times by email."}
              </p>
              {event.status === "published" && (
                <ActionButton
                  action={setRoomSchedulePosted.bind(null, eventId, !event.performance_order_published)}
                  variant={event.performance_order_published ? "stop" : "go"}
                  pendingText={event.performance_order_published ? "Hiding…" : "Posting…"}
                  confirmMessage={
                    event.performance_order_published
                      ? "Hide the schedule? Directors and the public won't see times until you post it again."
                      : "Post the schedule? It goes on the public page and every director is emailed their group's times."
                  }
                >
                  {event.performance_order_published ? "Hide the schedule" : "Post the schedule"}
                </ActionButton>
              )}
            </Card>
          </section>
        </>
      )}

      <section className="mt-10" aria-labelledby="board-heading">
        <h2 id="board-heading" className="text-xl font-semibold">
          {access.isHost ? "Saved schedule, room by room" : "Schedule, room by room"}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">All times {zoneName(tz)}.</p>
        {rooms.length === 0 ? (
          <Card>
            <p className="text-muted">The host hasn&apos;t set up the rooms yet.</p>
          </Card>
        ) : (
          <RoomSchedule rooms={rooms} slots={slots} timezone={tz} live={isEventDay} />
        )}
      </section>
    </div>
  );
}
