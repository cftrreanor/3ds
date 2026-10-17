import Link from "next/link";
import { SavedBy } from "@/components/saved-by";
import { redirect } from "next/navigation";
import {
  emailFinalists,
  emailTimeChanges,
  publishFinals,
  publishRunningOrder,
  revealFinalists,
  saveSchedule,
} from "@/app/dashboard/band-actions";
import { BAND_COLUMNS, type BandRow } from "@/lib/bands";
import { hasRooms } from "@/lib/event-types";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { eachDate, utcToZonedDate, utcToZonedTime, zoneName } from "@/lib/time";
import { ScheduleBuilder, type FinalsSlot, type OrderBand, type ScheduleBreak } from "../bands/schedule-builder";

type Slot = {
  band_id: string;
  performance_order: number;
  warm_up_at: string | null;
  warm_up_minutes: number | null;
  perform_at: string | null;
  warm_up_location: string | null;
};

/** Performance Schedule Setup: the host builds, publishes and edits the running order and finals. */
export async function HostSchedule({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_type, timezone, starts_on, ends_on, performance_order_published, ready_minutes_before, finals_ready_minutes_before, finals_published, finalists_revealed")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  // Group events build their schedule room by room.
  if (hasRooms(event.event_type)) redirect(`/dashboard/events/${eventId}/rooms`);

  const [{ data: bandData }, { data: slotData }, { data: breakData }, { data: finalsData }] = await Promise.all([
    supabase.from("bands").select(BAND_COLUMNS).eq("event_id", eventId).order("created_at"),
    supabase.from("performance_slots").select("band_id, performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("event_id", eventId),
    supabase.from("schedule_breaks").select("starts_at, minutes, label").eq("event_id", eventId).order("starts_at"),
    supabase
      .from("finals_slots")
      .select("slot_number, band_id, warm_up_at, warm_up_minutes, perform_at, warm_up_location")
      .eq("event_id", eventId)
      .order("slot_number"),
  ]);
  const bands = (bandData ?? []) as BandRow[];
  const slots = new Map(((slotData ?? []) as Slot[]).map((s) => [s.band_id, s]));
  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);

  // Scheduled bands in their order, then anyone not yet placed.
  const ordered = [...bands].sort((a, b) => {
    const sa = slots.get(a.id)?.performance_order ?? Infinity;
    const sb = slots.get(b.id)?.performance_order ?? Infinity;
    return sa - sb || a.created_at.localeCompare(b.created_at);
  });
  // Stored times → wall-clock times on the event's days, for the builder.
  const toTimes = (s: Omit<Slot, "band_id" | "performance_order"> | undefined, fallbackDay: string) => {
    const ref = s?.perform_at ?? s?.warm_up_at;
    return {
      day: ref ? utcToZonedDate(ref, tz) : fallbackDay,
      warmUp: s?.warm_up_at ? utcToZonedTime(s.warm_up_at, tz) : "",
      warmUpMinutes: s?.warm_up_minutes ?? 0,
      perform: s?.perform_at ? utcToZonedTime(s.perform_at, tz) : "",
      location: s?.warm_up_location ?? "",
    };
  };
  const builderBands: OrderBand[] = ordered.map((b) => ({
    id: b.id,
    name: b.band_name,
    school: b.school_name,
    classification: b.classification,
    conflicts: b.contest_day_conflicts,
    ...toTimes(slots.get(b.id), days[0]),
  }));
  const builderBreaks: ScheduleBreak[] = (breakData ?? []).map((b) => ({
    day: utcToZonedDate(b.starts_at, tz),
    start: utcToZonedTime(b.starts_at, tz),
    minutes: b.minutes,
    label: b.label,
  }));
  const finalsSlots = (finalsData ?? []) as (Omit<Slot, "band_id" | "performance_order"> & { slot_number: number; band_id: string | null })[];
  const builderFinals: FinalsSlot[] = finalsSlots.map((f) => ({ bandId: f.band_id ?? "", ...toTimes(f, days.at(-1)!) }));

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Performance Schedule Setup</h1>
      <SavedBy eventId={eventId} area="schedule" className="mt-2" />
      <p className="mt-2 mb-6 text-sm text-muted">
        All times {zoneName(tz)}. Directors and the public only see a round once you publish it. Conflicts directors
        reported are shown with ⚠️.
        {bands.length === 0 && (
          <>
            {" "}
            No bands have registered yet: they appear here as directors sign up on{" "}
            <Link href={`/dashboard/events/${eventId}/bands`} className="font-medium text-brand hover:underline">
              Band Registration
            </Link>
            .
          </>
        )}
      </p>
      <ScheduleBuilder
        initialBands={builderBands}
        initialBreaks={builderBreaks}
        initialFinals={builderFinals}
        initialReadyMinutes={event.ready_minutes_before}
        initialFinalsReadyMinutes={event.finals_ready_minutes_before}
        days={days}
        zoneLabel={zoneName(tz)}
        orderPublished={event.performance_order_published}
        finalsPublished={event.finals_published}
        finalistsRevealed={event.finalists_revealed}
        revealFinalists={revealFinalists.bind(null, eventId)}
        save={saveSchedule.bind(null, eventId)}
        emailChanges={emailTimeChanges.bind(null, eventId)}
        publishOrder={publishRunningOrder.bind(null, eventId)}
        publishFinals={publishFinals.bind(null, eventId)}
        emailFinalists={emailFinalists.bind(null, eventId)}
      />
    </div>
  );
}
