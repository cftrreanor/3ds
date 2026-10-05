"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { bandColumns, parseBand, readyAt, warmUpEndAt } from "@/lib/bands";
import { getOrigin } from "@/lib/data";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTime, utcToZonedDate, zoneAbbreviation, zonedToUtc } from "@/lib/time";

// ---------------------------------------------------------------------------
// Band directors
// ---------------------------------------------------------------------------

export async function registerBand(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseBand(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bands")
    .insert({ event_id: eventId, director_user_id: user.id, ...bandColumns(parsed.data) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return { error: "Band registration for this event is closed. Please contact the host." };
    return { error: friendlyDbError(error) };
  }

  const { data: event } = await supabase.from("events").select("name, starts_on, ends_on").eq("id", eventId).single();
  const origin = await getOrigin();
  const v = parsed.data;
  after(async () => {
    const { html, text } = emailLayout({
      heading: `${v.bandName} is registered`,
      paragraphs: [
        `Thanks! ${v.schoolName} is registered for ${event?.name ?? "the contest"} (${event ? formatDateRange(event.starts_on, event.ends_on) : ""}).`,
        "You can review or change your registration while registration is open. We'll email you when the performance order and your times are posted.",
      ],
      rows: [
        { title: "Classification", detail: v.classification },
        { title: "People", detail: `${v.studentCount} students · ${v.chaperoneCount} chaperones` },
        {
          title: "Vehicles",
          detail: `${v.busCount} buses · ${v.boxTruckCount} box trucks · ${v.truckTrailerCount} truck/trailers · ${v.semiTruckCount} semis`,
        },
      ],
      button: { label: "View my registration", url: `${origin}/dashboard/bands/${data.id}` },
    });
    await sendEmail({ to: user.email, subject: `Registered: ${v.bandName} at ${event?.name ?? "the contest"}`, html, text });
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/bands/${data.id}?registered=1`);
}

export async function updateBand(bandId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = parseBand(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("bands").update(bandColumns(parsed.data)).eq("id", bandId).select("id, event_id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Registration is closed, so changes have to go through the host." };
  revalidatePath(`/dashboard/bands/${bandId}`);
  revalidatePath(`/dashboard/events/${data[0].event_id}/bands`);
  return { ok: true, message: "Saved." };
}

export async function withdrawBand(bandId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("bands").delete().eq("id", bandId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Registration is closed. Please contact the host to withdraw." };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

async function updateEventRow(eventId: string, values: Record<string, unknown>): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(values).eq("id", eventId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can change this." };
  revalidatePath(`/dashboard/events/${eventId}/bands`);
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

export async function setBandRegistrationOpen(eventId: string, open: boolean) {
  return updateEventRow(eventId, { band_registration_open: open });
}

export async function updateBandSettings(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      chaperoneLimit: z.coerce.number().int().min(0).max(500),
      classifications: z
        .string()
        .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
        .refine((v) => v.length > 0, "Add at least one classification"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await updateEventRow(eventId, {
    chaperone_limit: parsed.data.chaperoneLimit,
    classifications: parsed.data.classifications,
  });
  return result.error ? result : { ok: true, message: "Settings saved." };
}

const slotSchema = z.array(
  z.object({
    band_id: z.string().uuid(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    warmUp: z.string().regex(/^(\d{2}:\d{2})?$/),
    warmUpMinutes: z.number().int().min(0).max(240).refine((m) => m % 15 === 0, "Warm-up length must be in 15-minute steps"),
    perform: z.string().regex(/^(\d{2}:\d{2})?$/),
    location: z.string().trim().max(120),
  }),
);

/** Save the running order. Times arrive as the event's local wall-clock times. */
export async function saveRunningOrder(eventId: string, slotsJson: string, readyMinutes: string): Promise<ActionState> {
  await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(slotsJson);
  } catch {
    raw = null;
  }
  const parsed = slotSchema.safeParse(raw);
  if (!parsed.success) return { error: "Something about the order wasn't valid. Please try again." };
  const ready = z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().max(60)).safeParse(readyMinutes);
  if (!ready.success) return { error: "Ready position: enter a number of minutes from 0 to 60." };

  const saved = await updateEventRow(eventId, { ready_minutes_before: ready.data });
  if (saved.error) return saved;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("timezone").eq("id", eventId).single();
  if (!event) return { error: "Event not found." };
  const toUtc = (day: string, time: string) => (time ? zonedToUtc(day, time, event.timezone).toISOString() : null);
  const slots = parsed.data.map((s) => ({
    band_id: s.band_id,
    warm_up_at: toUtc(s.day, s.warmUp),
    warm_up_minutes: s.warmUpMinutes || null,
    perform_at: toUtc(s.day, s.perform),
    warm_up_location: s.location || null,
  }));
  const { error } = await supabase.rpc("save_performance_order", { p_event_id: eventId, p_slots: slots });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}/bands`);
  return { ok: true, message: "Order saved." };
}

/** Publish (or hide) the running order. Publishing emails every director their times. */
export async function publishRunningOrder(eventId: string, publish: boolean): Promise<ActionState> {
  const result = await updateEventRow(eventId, { performance_order_published: publish });
  if (result.error || !publish) return result;

  const supabase = await createClient();
  const [{ data: event }, { data: slots }] = await Promise.all([
    supabase.from("events").select("name, slug, timezone, venue_name, venue_address, ready_minutes_before").eq("id", eventId).single(),
    supabase
      .from("performance_slots")
      .select("performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location, bands(band_name, school_name, contact_email, head_director_email)")
      .eq("event_id", eventId)
      .order("performance_order"),
  ]);
  const origin = await getOrigin();
  type Slot = {
    performance_order: number;
    warm_up_at: string | null;
    warm_up_minutes: number | null;
    perform_at: string | null;
    warm_up_location: string | null;
    bands: { band_name: string; school_name: string; contact_email: string; head_director_email: string } | null;
  };
  after(async () => {
    for (const s of (slots ?? []) as unknown as Slot[]) {
      if (!s.bands || !event) continue;
      const tz = event.timezone;
      const at = (iso: string | null) =>
        iso ? `${formatDate(utcToZonedDate(iso, tz))}, ${formatTime(iso, tz)} ${zoneAbbreviation(iso, tz)}` : "To be announced";
      const { html, text } = emailLayout({
        heading: `Your performance time at ${event.name}`,
        paragraphs: [`The performance order for ${event.name} is posted. Here are the times for ${s.bands.band_name}.`],
        rows: [
          { title: "Performance order", detail: `#${s.performance_order}` },
          {
            title: "Warm-up",
            detail: [
              at(s.warm_up_at),
              warmUpEndAt(s.warm_up_at, s.warm_up_minutes)
                ? `until ${formatTime(warmUpEndAt(s.warm_up_at, s.warm_up_minutes)!, tz)} (${s.warm_up_minutes} min)`
                : null,
              s.warm_up_location,
            ]
              .filter(Boolean)
              .join(" · "),
          },
          { title: "Ready position", detail: `${at(readyAt(s.perform_at, event.ready_minutes_before))} (${event.ready_minutes_before} min before performing)` },
          { title: "Performance", detail: at(s.perform_at) },
          { title: "Venue", detail: [event.venue_name, event.venue_address].filter(Boolean).join(", ") },
        ],
        button: { label: "See the full schedule", url: `${origin}/e/${event.slug}` },
      });
      const recipients = [...new Set([s.bands.head_director_email, s.bands.contact_email])];
      for (const to of recipients) {
        await sendEmail({ to, subject: `Performance time: ${s.bands.band_name} at ${event.name}`, html, text });
        await pause();
      }
    }
  });
  return { ok: true, message: "Published. Directors are being emailed their times." };
}

