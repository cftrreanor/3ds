import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { RoomSchedule, type ScheduleSlot } from "@/components/room-schedule";
import { PublishBar, PublishLine } from "@/components/publish-bar";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { Card } from "@/components/ui";
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
import { SavedBy } from "@/components/saved-by";

export async function generateMetadata({ params }: PageProps<"/dashboard/events/[eventId]/rooms">): Promise<Metadata> {
  const { eventId } = await params;
  return { title: (await getEventAccess(eventId)).isHost ? "Rooms & Schedule Setup" : "Room schedule" };
}

/**
 * Group events. Hosts: Rooms & Schedule Setup, as setup steps with a publish
 * bar (see "Setup pages" in docs/DESIGN.md). The team: the schedule.
 */
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
  // Step 1 is done once at least one room is on the path.
  const roomsDone = rooms.some((r) => r.path_order !== null);
  const order: GroupPlan[] = ((orderData ?? []) as { band_id: string; skipped_room_ids: string[]; extra_minutes_before: number }[]).map((o) => ({
    bandId: o.band_id,
    skipped: o.skipped_room_ids,
    extraMinutes: o.extra_minutes_before,
  }));

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        {access.isHost ? "Rooms & Schedule Setup" : "Room schedule"}
      </h1>
      <SavedBy eventId={eventId} area="schedule" className="mt-2" />
      <p className="mt-2 text-sm text-muted">All times {zoneName(tz)}.</p>
      {isEventDay && event.performance_order_published && <AutoRefresh status className="mt-1" />}

      {slots.length > 0 && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm leading-6 text-muted">
            On the day, use <span className="font-medium text-foreground">Event day</span> to check groups in, see who&apos;s
            running over{access.isHost ? " and push the schedule back" : ""}.
          </p>
          <Link
            href={`/dashboard/events/${eventId}/event-day`}
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
          >
            Open event day
          </Link>
        </Card>
      )}

      {access.isHost && (
        <div className="mt-6 flex flex-col gap-3">
          <PublishBar>
            <PublishLine
              label="Schedule"
              on={event.performance_order_published}
              status={
                event.performance_order_published
                  ? "Posted: directors and the public can see it"
                  : event.status !== "published"
                    ? "Publish the event from its main page first"
                    : slots.length === 0
                      ? "Not posted. Save the group order first"
                      : "Not posted"
              }
            >
              {event.status === "published" && (event.performance_order_published || slots.length > 0) && (
                <ActionButton
                  action={setRoomSchedulePosted.bind(null, eventId, !event.performance_order_published)}
                  variant={event.performance_order_published ? "secondary" : "primary"}
                  pendingText={event.performance_order_published ? "Hiding…" : "Posting…"}
                  confirmMessage={
                    event.performance_order_published
                      ? "Hide the schedule? Directors and the public won't see times until you post it again."
                      : "Post the schedule? It goes on the public page and every director is emailed their group's times."
                  }
                >
                  {event.performance_order_published ? "Hide" : "Post the schedule"}
                </ActionButton>
              )}
            </PublishLine>
          </PublishBar>

          <SetupStep
            id="rooms"
            title="1. Rooms"
            status={<StepStatus done={roomsDone} doneLabel={`${rooms.length} ${rooms.length === 1 ? "room" : "rooms"}`} />}
            open={!roomsDone}
            intro="The rooms groups visit, in the order they visit them. Everything is at the event's address; use the note for a room number or directions inside the building."
          >
            <RoomsEditor key={rooms.map((r) => `${r.id}:${r.path_order}:${r.minutes}`).join(",")} rooms={rooms} save={saveRooms.bind(null, eventId)} />
          </SetupStep>

          <SetupStep
            id="group-order"
            title="2. Group order & times"
            status={
              <StepStatus
                done={slots.length > 0}
                doneLabel="Saved"
                todoLabel={!roomsDone ? "Set up rooms first" : groups.length === 0 ? "Waiting for groups to register" : "Needs to be done"}
              />
            }
            open={roomsDone && slots.length === 0}
            intro="Every group follows the path in order. Groups start one gap apart, so a room is never double-booked. Directors' scheduling conflicts are marked ⚠️. Post it from the outlined bar: each director is emailed their group's times."
          >
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
          </SetupStep>
        </div>
      )}

      <section className="mt-10" aria-labelledby="board-heading">
        <h2 id="board-heading" className="text-xl font-semibold">
          {access.isHost ? "Saved schedule, room by room" : "Schedule, room by room"}
        </h2>
        {rooms.length === 0 ? (
          <Card className="mt-4">
            <p className="text-muted">
              {access.isHost ? "No rooms yet. Add them in step 1 above." : "The organizer hasn't set up the rooms yet."}
            </p>
          </Card>
        ) : (
          <div className="mt-4">
            <RoomSchedule rooms={rooms} slots={slots} timezone={tz} live={isEventDay} />
          </div>
        )}
      </section>
    </div>
  );
}
