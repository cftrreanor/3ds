"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { emailLayout, sendEmailToMany } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { utcToZonedDate, zonedToUtc } from "@/lib/time";

const AUDIENCES = ["public", "band_directors", "volunteers", "section_leads"] as const;
const PRIORITIES = ["routine", "schedule", "emergency"] as const;
/** How long a banner stays up: minutes, "day" (until midnight at the event) or "open" (until ended). */
const DURATIONS = ["1", "5", "10", "30", "60", "120", "240", "day", "open"] as const;

const refresh = (eventId: string, slug?: string) => {
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  revalidatePath("/dashboard/bands", "layout");
  revalidatePath("/my");
  if (slug) revalidatePath(`/e/${slug}`);
};

/**
 * Post a day-of banner. The database checks who may post to whom: hosts to
 * anyone, Volunteer Leads to volunteers and Section Leads.
 */
export async function postAnnouncement(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const priority = String(formData.get("priority") ?? "routine");
  const audiences = formData.getAll("audiences").map(String);
  const duration = String(formData.get("duration") ?? "120");
  if (!body) return { error: "Write the announcement first." };
  if (body.length > 1000) return { error: "Keep it under 1,000 characters." };
  if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) return { error: "Pick a type." };
  if (audiences.length === 0 || !audiences.every((a) => AUDIENCES.includes(a as (typeof AUDIENCES)[number]))) {
    return { error: "Pick who should see it." };
  }
  if (!DURATIONS.includes(duration as (typeof DURATIONS)[number])) return { error: "Pick how long it stays up." };

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("name, slug, timezone").eq("id", eventId).maybeSingle();
  if (!event) return { error: "This event isn't available." };
  const now = new Date();
  let endsAt: string | null = null;
  if (duration === "day") {
    const today = utcToZonedDate(now.toISOString(), event.timezone);
    endsAt = new Date(zonedToUtc(today, "23:59", event.timezone).getTime() + 60_000).toISOString();
  } else if (duration !== "open") {
    endsAt = new Date(now.getTime() + Number(duration) * 60_000).toISOString();
  }

  const { error } = await supabase
    .from("announcements")
    .insert({ event_id: eventId, sender_id: user.id, body, priority, audiences, ends_at: endsAt });
  if (error) {
    if (error.code === "42501") return { error: "Volunteer Leads can post to volunteers and Section Leads only. Ask a host to post to directors or the public." };
    return { error: friendlyDbError(error) };
  }
  refresh(eventId, event.slug);

  // Emergencies are also emailed, since not everyone has the page open.
  if (priority !== "emergency" || formData.get("email") !== "on") return { ok: true, message: "Posted. It's showing now." };
  const to = (await emergencyRecipients(eventId, audiences)).filter((e) => e !== user.email?.toLowerCase());
  if (to.length === 0) return { ok: true, message: "Posted. It's showing now. No one in the groups you picked has an email address on file yet." };
  const { html, text } = emailLayout({
    heading: `Emergency message: ${event.name}`,
    paragraphs: body.split(/\n+/).filter(Boolean),
    footer: `You're getting this because you're part of ${event.name}. Sent by ${brand.name} for the event's organizers.`,
  });
  after(async () => {
    const sent = await sendEmailToMany({ to, subject: `Emergency: ${event.name}`, html, text, replyTo: user.email ?? undefined });
    if (sent < to.length) console.error(`Emergency email reached ${sent} of ${to.length} people`, { eventId });
  });
  return { ok: true, message: `Posted. It's showing now and being emailed to ${to.length} ${to.length === 1 ? "person" : "people"}.` };
}

/**
 * Everyone an emergency goes to by email: directors' and contact addresses
 * (directors), signed-up volunteers who gave an email (volunteers), and the
 * event team (Volunteer Leads and Section Leads). The public has no list. Read
 * with the admin client, only after the database accepted the post above.
 */
async function emergencyRecipients(eventId: string, audiences: string[]): Promise<string[]> {
  const admin = createAdminClient();
  const emails: string[] = [];
  if (audiences.includes("band_directors")) {
    const { data, error } = await admin.from("bands").select("head_director_email, contact_email").eq("event_id", eventId);
    if (error) console.error("emergency recipients (directors) failed", error.message);
    for (const b of data ?? []) emails.push(b.head_director_email, b.contact_email);
  }
  if (audiences.includes("volunteers")) {
    const { data, error } = await admin
      .from("volunteers")
      .select("email, volunteer_assignments!inner(id)")
      .eq("event_id", eventId)
      .not("email", "is", null);
    if (error) console.error("emergency recipients (volunteers) failed", error.message);
    for (const v of data ?? []) if (v.email) emails.push(v.email);
  }
  if (audiences.includes("section_leads")) {
    const [staff, leads] = await Promise.all([
      admin.from("event_staff").select("profiles(email)").eq("event_id", eventId),
      admin.from("station_leads").select("profiles(email)").eq("event_id", eventId),
    ]);
    if (staff.error || leads.error) console.error("emergency recipients (team) failed", staff.error?.message ?? leads.error?.message);
    for (const r of [...(staff.data ?? []), ...(leads.data ?? [])] as unknown as { profiles: { email: string } | null }[]) {
      if (r.profiles?.email) emails.push(r.profiles.email);
    }
  }
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Take a banner down now. */
export async function endAnnouncement(eventId: string, announcementId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ ends_at: new Date().toISOString() }).eq("id", announcementId).eq("event_id", eventId);
  if (error) console.error("endAnnouncement failed", error.message);
  const { data: event } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  refresh(eventId, event?.slug);
}
