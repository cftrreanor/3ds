import "server-only";
import { isSchemaError } from "@/lib/schema-check";
import type { createClient } from "@/lib/supabase/server";

// Conference bookings are the teacher's alone: the person who set up the
// conference (supabase/migrations/20261209000000_conference_teacher_only.sql).
// Other hosts on a school's account see how many times are booked, not who.

type Client = Awaited<ReturnType<typeof createClient>>;

/** Whether the signed-in person is this conference's teacher. Before the update is run, every host is. */
export async function isConferenceTeacher(supabase: Client, eventId: string) {
  const { data, error } = await supabase.rpc("is_conference_teacher", { ev: eventId });
  if (error) return isSchemaError(error);
  return Boolean(data);
}

/** How many times are booked, for anyone who runs the event. */
export async function conferenceBookedCount(supabase: Client, eventId: string) {
  const { data, error } = await supabase.rpc("conference_booked_count", { ev: eventId });
  if (!error) return (data as number | null) ?? 0;
  if (!isSchemaError(error)) return 0;
  const { count } = await supabase.from("conference_bookings").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  return count ?? 0;
}
