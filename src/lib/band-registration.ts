import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import type { bandColumns } from "@/lib/bands";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { groupWords, hasRooms } from "@/lib/event-types";
import { notificationEmails } from "@/lib/notify-recipients";
import { createClient } from "@/lib/supabase/server";
import { customWords, loadSystemEmail } from "@/lib/system-email-overrides";
import { formatDateRange } from "@/lib/time";

/** Save a registration, email the director a copy and open their band's page. */
export async function createRegistration(
  eventId: string,
  user: { id: string; email: string },
  v: ReturnType<typeof bandColumns>,
  /** A client already signed in as the director (just confirmed by email code); otherwise this request's. */
  client?: SupabaseClient,
): Promise<ActionState> {
  const supabase = client ?? (await createClient());
  const { data: same } = await supabase
    .from("bands")
    .select("id")
    .eq("event_id", eventId)
    .eq("director_user_id", user.id)
    .ilike("band_name", v.band_name.replace(/[%_\\]/g, "\\$&"));
  if (same?.length) {
    return { error: `You've already registered ${v.band_name} for this event. Open it from your dashboard to make changes.` };
  }
  const { data, error } = await supabase
    .from("bands")
    .insert({ event_id: eventId, director_user_id: user.id, ...v })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return { error: "Registration for this event is closed. Please contact the organizer." };
    return { error: friendlyDbError(error) };
  }

  const { data: event } = await supabase.from("events").select("name, starts_on, ends_on, event_type").eq("id", eventId).single();
  const group = hasRooms(event?.event_type);
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const origin = await getOrigin();
  after(async () => {
    const custom = customWords("director_registered", await loadSystemEmail("director_registered"), {
      band_name: v.band_name,
      school: v.school_name,
      event_name: event?.name ?? "the event",
      event_dates: event ? formatDateRange(event.starts_on, event.ends_on) : "",
    });
    const { html, text } = emailLayout({
      heading: custom?.heading || `${v.band_name} is registered`,
      paragraphs: custom?.paragraphs ?? [
        `Thanks. ${v.school_name} is registered for ${event?.name ?? "the event"} (${event ? formatDateRange(event.starts_on, event.ends_on) : ""}).`,
        `You can review or change your registration while registration is open. We'll email you when ${group ? "the schedule and your group's times in each room are" : "the performance order and your times are"} posted.`,
      ],
      rows: [
        { title: "Classification", detail: v.classification },
        { title: "People", detail: `${v.student_count} ${group ? "participants" : "students"} · ${count(v.chaperone_count, "chaperone", "chaperones")}` },
        {
          title: "Vehicles",
          detail: group
            ? count(v.bus_count, "bus", "buses")
            : [
                count(v.bus_count, "bus", "buses"),
                count(v.box_truck_count, "box truck", "box trucks"),
                count(v.truck_trailer_count, "truck + trailer", "trucks + trailers"),
                count(v.semi_truck_count, "semi", "semis"),
              ].join(" · "),
        },
      ],
      button: { label: custom?.button || "View my registration", url: `${origin}/dashboard/bands/${data.id}` },
    });
    await sendEmail({ to: user.email, subject: custom?.subject || `Registered: ${v.band_name} at ${event?.name ?? "the event"}`, html, text, eventId });

    // The people the hosts picked to hear about registrations (Edit details → Email settings).
    const organizers = await notificationEmails(eventId, "band_registered");
    if (!organizers.length) return;
    const w = groupWords(event?.event_type);
    const note = emailLayout({
      heading: `${v.band_name} registered`,
      paragraphs: [`${v.school_name} registered ${v.band_name} for ${event?.name ?? "your event"}.`],
      rows: [
        { title: "Classification", detail: v.classification },
        { title: "People", detail: `${v.student_count} ${group ? "participants" : "students"} · ${count(v.chaperone_count, "chaperone", "chaperones")}` },
      ],
      button: { label: `See all ${w.many}`, url: `${origin}/dashboard/events/${eventId}/bands` },
      footer: "You get this because you're set to hear about registrations for this event. Change it in Event settings → Email settings.",
    });
    for (const to of organizers) {
      await sendEmail({ to, subject: `New ${w.one} registration: ${v.band_name}`, html: note.html, text: note.text, eventId });
    }
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/bands/${data.id}?registered=1`);
}

