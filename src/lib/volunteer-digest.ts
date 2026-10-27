import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { notificationEmails } from "@/lib/notify-recipients";
import { isSchemaError } from "@/lib/schema-check";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";

type ShiftInfo = { id: string; starts_at: string; ends_at: string; max_capacity: number; registered_count: number; stations: { name: string } | null };

/**
 * The daily job: for each event whose hosts picked people for "Volunteer
 * sign-ups" (Edit details → Email settings), one email listing the last day's
 * new sign-ups and cancellations, and how full the shifts are. Nothing on days
 * without changes, or once the event is over. Returns how many went out.
 */
export async function sendVolunteerDigests(admin: SupabaseClient, origin: string, now: number) {
  const { data: picked, error } = await admin.from("event_notification_recipients").select("event_id").eq("kind", "volunteer_digest");
  if (error) {
    if (!isSchemaError(error)) console.error("Daily job: volunteer summary lookup failed", error);
    return 0;
  }
  const since = new Date(now - 86_400_000).toISOString();
  let sent = 0;
  for (const { event_id: eventId } of picked ?? []) {
    const { data: event } = await admin.from("events").select("id, name, timezone, ends_on").eq("id", eventId).maybeSingle();
    if (!event || event.ends_on < utcToZonedDate(new Date(now).toISOString(), event.timezone)) continue;

    const [{ data: added }, { data: dropped }, { data: shiftRows }] = await Promise.all([
      admin
        .from("volunteer_assignments")
        .select("shift_id, volunteers(full_name), shifts!inner(event_id)")
        .eq("shifts.event_id", eventId)
        .gte("created_at", since),
      admin.from("volunteer_dropped_shifts").select("shift_id, full_name").eq("event_id", eventId).gte("dropped_at", since),
      admin.from("shifts").select("id, starts_at, ends_at, max_capacity, registered_count, stations(name)").eq("event_id", eventId),
    ]);
    const signedUp = (added ?? []) as unknown as { shift_id: string; volunteers: { full_name: string } | null }[];
    const left = (dropped ?? []) as { shift_id: string; full_name: string }[];
    if (!signedUp.length && !left.length) continue;
    const to = await notificationEmails(eventId, "volunteer_digest");
    if (!to.length) continue;

    const shifts = new Map(((shiftRows ?? []) as unknown as ShiftInfo[]).map((s) => [s.id, s]));
    const where = (shiftId: string) => {
      const s = shifts.get(shiftId);
      if (!s) return "a shift that was removed";
      const day = formatDate(utcToZonedDate(s.starts_at, event.timezone), { year: undefined });
      return `${s.stations?.name ?? "Shift"}, ${day}, ${formatTimeRange(s.starts_at, s.ends_at, event.timezone)}`;
    };
    const changes = [
      ...signedUp.map((a) => ({ title: `${a.volunteers?.full_name ?? "A volunteer"} signed up`, detail: where(a.shift_id) })),
      ...left.map((d) => ({ title: `${d.full_name} is no longer signed up`, detail: where(d.shift_id) })),
    ];
    const filled = [...shifts.values()].reduce((n, s) => n + s.registered_count, 0);
    const spots = [...shifts.values()].reduce((n, s) => n + s.max_capacity, 0);
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

    const { html, text } = emailLayout({
      heading: `Volunteer sign-ups for ${event.name}`,
      paragraphs: [
        `In the last day: ${plural(signedUp.length, "new sign-up", "new sign-ups")} and ${plural(left.length, "cancellation", "cancellations")}. ${filled} of ${spots} spots are filled.`,
        ...(changes.length > 30 ? [`Here are the first 30. The other ${changes.length - 30} are on your Volunteers page.`] : []),
      ],
      // One row per change, up to 30; the rest are on the Volunteers page.
      rows: changes.slice(0, 30),
      button: { label: "See all volunteers", url: `${origin}/dashboard/events/${eventId}/volunteers` },
      footer: "You get this once a day, on days with changes, because you're set to get volunteer sign-ups for this event. Change it in Edit details → Email settings.",
    });
    for (const address of to) {
      if (await sendEmail({ to: address, subject: `Volunteer sign-ups: ${event.name}`, html, text, eventId })) sent++;
      await pause();
    }
  }
  return sent;
}
