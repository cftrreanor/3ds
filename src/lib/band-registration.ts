import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import type { bandColumns } from "@/lib/bands";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { hasRooms } from "@/lib/event-types";
import { createClient } from "@/lib/supabase/server";
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
  const origin = await getOrigin();
  after(async () => {
    const { html, text } = emailLayout({
      heading: `${v.band_name} is registered`,
      paragraphs: [
        `Thanks. ${v.school_name} is registered for ${event?.name ?? "the event"} (${event ? formatDateRange(event.starts_on, event.ends_on) : ""}).`,
        `You can review or change your registration while registration is open. We'll email you when ${group ? "the schedule and your group's times in each room are" : "the performance order and your times are"} posted.`,
      ],
      rows: [
        { title: "Classification", detail: v.classification },
        { title: "People", detail: `${v.student_count} ${group ? "participants" : "students"} · ${v.chaperone_count} chaperones` },
        {
          title: "Vehicles",
          detail: group
            ? `${v.bus_count} ${v.bus_count === 1 ? "bus" : "buses"}`
            : `${v.bus_count} buses · ${v.box_truck_count} box trucks · ${v.truck_trailer_count} trucks + trailers · ${v.semi_truck_count} semis`,
        },
      ],
      button: { label: "View my registration", url: `${origin}/dashboard/bands/${data.id}` },
    });
    await sendEmail({ to: user.email, subject: `Registered: ${v.band_name} at ${event?.name ?? "the event"}`, html, text });
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/bands/${data.id}?registered=1`);
}

