"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { bandColumns, parseBand, readyAt, warmUpEndAt } from "@/lib/bands";
import { getEventAccess, getOrigin } from "@/lib/data";
import { normalizePhone } from "@/lib/phone";
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
  const { data: same } = await supabase
    .from("bands")
    .select("id")
    .eq("event_id", eventId)
    .eq("director_user_id", user.id)
    .ilike("band_name", parsed.data.bandName.replace(/[%_\\]/g, "\\$&"));
  if (same?.length) {
    return { error: `You've already registered ${parsed.data.bandName} for this contest. Open it from your dashboard to make changes.` };
  }
  const { data, error } = await supabase
    .from("bands")
    .insert({ event_id: eventId, director_user_id: user.id, ...bandColumns(parsed.data) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return { error: "Band registration for this contest is closed. Please contact the host." };
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
  redirect(`/dashboard/bands/${bandId}?saved=1`);
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
      deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid deadline date")]),
      directorInfo: z.string().trim().max(3000, "Information for directors is too long (3,000 characters max)"),
      contactName: z.string().trim().max(150),
      contactPhone: z
        .string()
        .trim()
        .transform((v, ctx) => {
          if (!v) return "";
          const p = normalizePhone(v);
          if (!p) ctx.addIssue({ code: "custom", message: "Contact phone: enter a 10-digit number" });
          return p ?? "";
        }),
      contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("Contact email isn't valid")]),
    })
    .safeParse({
      deadline: "",
      directorInfo: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      ...Object.fromEntries(formData),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const result = await updateEventRow(eventId, {
    chaperone_limit: v.chaperoneLimit,
    classifications: v.classifications,
    band_registration_deadline: v.deadline || null,
    director_info: v.directorInfo || null,
  });
  if (result.error) return result;
  const supabase = await createClient();
  const { error } = await supabase.from("event_director_contacts").upsert({
    event_id: eventId,
    name: v.contactName,
    phone: v.contactPhone,
    email: v.contactEmail,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: friendlyDbError(error) };
  return { ok: true, message: "Settings saved." };
}

const timesSchema = z.object({
  band_id: z.union([z.string().uuid(), z.literal("")]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warmUp: z.string().regex(/^(\d{2}:\d{2})?$/),
  warmUpMinutes: z.number().int().min(0).max(240).refine((m) => m % 15 === 0, "Warm-up length must be in 15-minute steps"),
  perform: z.string().regex(/^(\d{2}:\d{2})?$/),
  location: z.string().trim().max(120),
});

const readyMinutes = (label: string) =>
  z
    .string()
    .regex(/^\d{1,2}$/, `${label} ready position: enter a number of minutes from 0 to 60.`)
    .transform(Number)
    .pipe(z.number().max(60, `${label} ready position: enter a number of minutes from 0 to 60.`));

const scheduleSchema = z.object({
  readyMinutes: readyMinutes("Preliminaries"),
  finalsReadyMinutes: readyMinutes("Finals"),
  slots: z.array(timesSchema.extend({ band_id: z.string().uuid() })),
  breaks: z
    .array(
      z.object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start: z.string().regex(/^\d{2}:\d{2}$/, "Each break needs a start time."),
        minutes: z.string().regex(/^\d{1,3}$/, "Each break needs a length in minutes.").transform(Number)
          .pipe(z.number().min(5, "Breaks must be at least 5 minutes.").max(480, "Breaks can be at most 8 hours.")),
        label: z.string().trim().max(80).transform((v) => v || "Break"),
      }),
    )
    .max(30),
  finals: z.array(timesSchema).max(30),
});

/** Bands whose published times a save changed, so the host can tell their directors. */
export type ChangedBands = { order: string[]; finals: string[] };
export type ScheduleSaveState = ActionState & { changed?: ChangedBands };

type SlotTimes = {
  band_id: string | null;
  warm_up_at: string | null;
  warm_up_minutes: number | null;
  perform_at: string | null;
  warm_up_location: string | null;
};
const sameInstant = (a: string | null, b: string | null) => (a && b ? new Date(a).getTime() === new Date(b).getTime() : a === b);
const sameTimes = (a: SlotTimes, b: SlotTimes) =>
  sameInstant(a.warm_up_at, b.warm_up_at) &&
  sameInstant(a.perform_at, b.perform_at) &&
  (a.warm_up_minutes ?? null) === (b.warm_up_minutes ?? null) &&
  (a.warm_up_location ?? null) === (b.warm_up_location ?? null);

/** Save the whole schedule. Times arrive as the event's local wall-clock times. */
export async function saveSchedule(eventId: string, scheduleJson: string): Promise<ScheduleSaveState> {
  await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(scheduleJson);
  } catch {
    raw = null;
  }
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => !i.message.startsWith("Invalid"));
    return { error: issue?.message ?? "Something about the schedule wasn't valid. Please try again." };
  }

  const supabase = await createClient();
  // The schedule as it was, to tell which published bands' times change.
  const [{ data: event }, { data: oldSlots }, { data: oldFinals }] = await Promise.all([
    supabase.from("events").select("timezone, ready_minutes_before, finals_ready_minutes_before, performance_order_published, finalists_revealed").eq("id", eventId).single(),
    supabase.from("performance_slots").select("band_id, performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("event_id", eventId),
    supabase.from("finals_slots").select("slot_number, band_id, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("event_id", eventId),
  ]);
  if (!event) return { error: "Event not found." };
  const toUtc = (day: string, time: string) => (time ? zonedToUtc(day, time, event.timezone).toISOString() : null);
  const times = (s: z.infer<typeof timesSchema>) => ({
    band_id: s.band_id || null,
    warm_up_at: toUtc(s.day, s.warmUp),
    warm_up_minutes: s.warmUpMinutes || null,
    perform_at: toUtc(s.day, s.perform),
    warm_up_location: s.location || null,
  });
  const newSlots = parsed.data.slots.map(times);
  const newFinals = parsed.data.finals.map(times);
  const { error } = await supabase.rpc("save_schedule", {
    p_event_id: eventId,
    p_ready_minutes: parsed.data.readyMinutes,
    p_finals_ready_minutes: parsed.data.finalsReadyMinutes,
    p_slots: newSlots,
    p_breaks: parsed.data.breaks.map((b) => ({ starts_at: toUtc(b.day, b.start), minutes: b.minutes, label: b.label })),
    p_finals: newFinals,
  });
  if (error) {
    if (error.code === "23505") return { error: "The same band is picked for two finals slots." };
    return { error: friendlyDbError(error) };
  }
  revalidatePath(`/dashboard/events/${eventId}/bands`);

  // A new ready position changes every band's ready time in that round.
  const readyChanged = parsed.data.readyMinutes !== event.ready_minutes_before;
  const finalsReadyChanged = parsed.data.finalsReadyMinutes !== event.finals_ready_minutes_before;
  const changed: ChangedBands = { order: [], finals: [] };
  if (event.performance_order_published) {
    const before = new Map((oldSlots ?? []).map((o) => [o.band_id, o]));
    newSlots.forEach((n, i) => {
      const o = before.get(n.band_id!);
      if (readyChanged || !o || o.performance_order !== i + 1 || !sameTimes(o, n)) changed.order.push(n.band_id!);
    });
  }
  // Finalists only hear about their finals times once they're revealed.
  if (event.finalists_revealed) {
    const before = new Map((oldFinals ?? []).filter((o) => o.band_id).map((o) => [o.band_id, o]));
    newFinals.forEach((n, i) => {
      if (!n.band_id) return;
      const o = before.get(n.band_id);
      if (finalsReadyChanged || !o || o.slot_number !== i + 1 || !sameTimes(o, n)) changed.finals.push(n.band_id);
    });
  }
  return { ok: true, message: "Schedule saved.", ...(changed.order.length || changed.finals.length ? { changed } : {}) };
}

type EmailEvent = {
  name: string;
  slug: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string;
  ready_minutes_before: number;
  finals_ready_minutes_before: number;
};
type EmailSlot = {
  label: string;
  warm_up_at: string | null;
  warm_up_minutes: number | null;
  perform_at: string | null;
  warm_up_location: string | null;
  bands: { band_name: string; school_name: string; contact_email: string; head_director_email: string } | null;
};

const EMAIL_EVENT_COLUMNS = "name, slug, timezone, venue_name, venue_address, ready_minutes_before, finals_ready_minutes_before";
const EMAIL_BAND_COLUMNS = "bands(band_name, school_name, contact_email, head_director_email)";

/** Email each band's director their times. Runs after the response is sent. */
function emailTimes(event: EmailEvent, slots: EmailSlot[], origin: string, round: "order" | "finals", kind: "posted" | "changed" = "posted") {
  const readyMin = round === "finals" ? event.finals_ready_minutes_before : event.ready_minutes_before;
  after(async () => {
    const tz = event.timezone;
    const at = (iso: string | null) =>
      iso ? `${formatDate(utcToZonedDate(iso, tz))}, ${formatTime(iso, tz)} ${zoneAbbreviation(iso, tz)}` : "To be announced";
    for (const s of slots) {
      if (!s.bands) continue;
      const warmEnd = warmUpEndAt(s.warm_up_at, s.warm_up_minutes);
      const { html, text } = emailLayout({
        heading:
          kind === "changed"
            ? `Updated ${round === "finals" ? "finals " : ""}times for ${s.bands.band_name}`
            : round === "finals"
              ? `You're in the finals at ${event.name}!`
              : `Your performance time at ${event.name}`,
        paragraphs: [
          kind === "changed"
            ? `The host updated the ${round === "finals" ? "finals " : ""}schedule for ${event.name}. Here are your current times; please use these from now on.`
            : round === "finals"
              ? `Congratulations! ${s.bands.band_name} is performing in finals. Here are your finals times.`
              : `The performance order for ${event.name} is posted. Here are the times for ${s.bands.band_name}.`,
        ],
        rows: [
          { title: round === "finals" ? "Finals order" : "Performance order", detail: s.label },
          {
            title: "Warm-up",
            detail: [at(s.warm_up_at), warmEnd ? `until ${formatTime(warmEnd, tz)} (${s.warm_up_minutes} min)` : null, s.warm_up_location]
              .filter(Boolean)
              .join(" · "),
          },
          {
            title: "Ready position",
            detail: `${at(readyAt(s.perform_at, readyMin))} (${readyMin} min before performing)`,
          },
          { title: "Performance", detail: at(s.perform_at) },
          { title: "Venue", detail: [event.venue_name, event.venue_address].filter(Boolean).join(", ") },
        ],
        button: { label: "See the full schedule", url: `${origin}/e/${event.slug}` },
      });
      const subject =
        kind === "changed"
          ? `Time change: ${s.bands.band_name} at ${event.name}`
          : round === "finals"
            ? `Finals time: ${s.bands.band_name} at ${event.name}`
            : `Performance time: ${s.bands.band_name} at ${event.name}`;
      for (const to of new Set([s.bands.head_director_email, s.bands.contact_email])) {
        await sendEmail({ to, subject, html, text });
        await pause();
      }
    }
  });
}

/** Publish (or hide) the running order. Publishing emails every director their times. */
export async function publishRunningOrder(eventId: string, publish: boolean): Promise<ActionState> {
  const result = await updateEventRow(eventId, { performance_order_published: publish });
  if (result.error || !publish) return result;

  const supabase = await createClient();
  const [{ data: event }, { data: slots }] = await Promise.all([
    supabase.from("events").select(EMAIL_EVENT_COLUMNS).eq("id", eventId).single(),
    supabase
      .from("performance_slots")
      .select(`performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location, ${EMAIL_BAND_COLUMNS}`)
      .eq("event_id", eventId)
      .order("performance_order"),
  ]);
  if (event) {
    const rows = ((slots ?? []) as unknown as (Omit<EmailSlot, "label"> & { performance_order: number })[]).map((s) => ({
      ...s,
      label: `#${s.performance_order}`,
    }));
    emailTimes(event, rows, await getOrigin(), "order");
  }
  return { ok: true, message: "Published. Directors are being emailed their times." };
}

/** Publish (or hide) the finals. Finalists are emailed separately, once they're picked. */
export async function publishFinals(eventId: string, publish: boolean): Promise<ActionState> {
  const result = await updateEventRow(eventId, publish ? { finals_published: true } : { finals_published: false, finalists_revealed: false });
  return result.error ? result : { ok: true, message: publish ? "Finals published." : "Finals hidden." };
}

/**
 * Show (or hide again) the finalist names on the public schedule and the
 * finalists' director pages. Revealing also publishes the finals times.
 */
export async function revealFinalists(eventId: string, reveal: boolean): Promise<ActionState> {
  const result = await updateEventRow(eventId, reveal ? { finals_published: true, finalists_revealed: true } : { finalists_revealed: false });
  return result.error ? result : { ok: true, message: reveal ? "Finalists revealed." : "Finalist names hidden again." };
}

/** Email each picked finalist their finals times. */
export async function emailFinalists(eventId: string): Promise<ActionState> {
  await requireUser();
  if (!(await getEventAccess(eventId)).isHost) return { error: "Only the event's host can do this." };
  const supabase = await createClient();
  const [{ data: event }, { data: slots }] = await Promise.all([
    supabase.from("events").select(`${EMAIL_EVENT_COLUMNS}, finalists_revealed`).eq("id", eventId).single(),
    supabase
      .from("finals_slots")
      .select(`slot_number, warm_up_at, warm_up_minutes, perform_at, warm_up_location, ${EMAIL_BAND_COLUMNS}`)
      .eq("event_id", eventId)
      .not("band_id", "is", null)
      .order("slot_number"),
  ]);
  if (!event) return { error: "Event not found." };
  if (!event.finalists_revealed) return { error: "Reveal the finalists first." };
  if (!slots?.length) return { error: "Pick the finalists and save the schedule first." };
  const rows = (slots as unknown as (Omit<EmailSlot, "label"> & { slot_number: number })[]).map((s) => ({
    ...s,
    label: `Finalist #${s.slot_number}`,
  }));
  emailTimes(event, rows, await getOrigin(), "finals");
  return { ok: true, message: `Emailing ${rows.length} finalist${rows.length === 1 ? "" : "s"} their times.` };
}

/** After a save changed published times: email just those bands' directors their current times. */
export async function emailTimeChanges(eventId: string, bands: ChangedBands): Promise<ActionState> {
  await requireUser();
  if (!(await getEventAccess(eventId)).isHost) return { error: "Only the event's host can do this." };
  const ids = z.object({ order: z.array(z.string().uuid()).max(500), finals: z.array(z.string().uuid()).max(50) }).safeParse(bands);
  if (!ids.success) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(`${EMAIL_EVENT_COLUMNS}, performance_order_published, finalists_revealed`)
    .eq("id", eventId)
    .single();
  if (!event) return { error: "Event not found." };
  const columns = `warm_up_at, warm_up_minutes, perform_at, warm_up_location, ${EMAIL_BAND_COLUMNS}`;
  const [{ data: order }, { data: finals }] = await Promise.all([
    event.performance_order_published && ids.data.order.length
      ? supabase.from("performance_slots").select(`performance_order, ${columns}`).eq("event_id", eventId).in("band_id", ids.data.order)
      : Promise.resolve({ data: [] }),
    event.finalists_revealed && ids.data.finals.length
      ? supabase.from("finals_slots").select(`slot_number, ${columns}`).eq("event_id", eventId).in("band_id", ids.data.finals)
      : Promise.resolve({ data: [] }),
  ]);
  const origin = await getOrigin();
  const orderRows = ((order ?? []) as unknown as (Omit<EmailSlot, "label"> & { performance_order: number })[]).map((r) => ({
    ...r,
    label: `#${r.performance_order}`,
  }));
  const finalsRows = ((finals ?? []) as unknown as (Omit<EmailSlot, "label"> & { slot_number: number })[]).map((r) => ({
    ...r,
    label: `Finalist #${r.slot_number}`,
  }));
  if (orderRows.length) emailTimes(event, orderRows, origin, "order", "changed");
  if (finalsRows.length) emailTimes(event, finalsRows, origin, "finals", "changed");
  const n = new Set([...ids.data.order, ...ids.data.finals]).size;
  return { ok: true, message: `Emailing ${n} band director${n === 1 ? "" : "s"} their updated times.` };
}

const pushBackSchema = z.object({
  fromOrder: z.string().regex(/^\d{1,3}$/, "Pick the first band to move.").transform(Number),
  minutes: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Enter how many minutes.")
    .transform(Number)
    .pipe(z.number().min(1, "Enter at least 1 minute.").max(240, "Push back at most 240 minutes (4 hours).")),
});

/** Contest day, running behind: move every band from #N onward later, and tell their directors. */
export async function pushScheduleBack(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = pushBackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fromOrder, minutes } = parsed.data;
  const includeFinals = formData.get("includeFinals") === "on";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("push_schedule_back", {
    p_event_id: eventId,
    p_from_order: fromOrder,
    p_minutes: minutes,
    p_include_finals: includeFinals,
  });
  if (error) return { error: friendlyDbError(error) };
  const rows = (data ?? []) as { round: "prelims" | "finals"; band_id: string | null }[];
  revalidatePath(`/dashboard/events/${eventId}`, "layout");

  const count = rows.filter((r) => r.round === "prelims").length;
  const moved = `Moved ${count} band${count === 1 ? "" : "s"} ${minutes} minutes later${includeFinals ? ", and the finals" : ""}.`;
  if (formData.get("email") !== "on") return { ok: true, message: moved };
  // Only directors who can already see their times (published order, revealed finalists) hear about it.
  const emailed = await emailTimeChanges(eventId, {
    order: rows.filter((r) => r.round === "prelims" && r.band_id).map((r) => r.band_id!),
    finals: rows.filter((r) => r.round === "finals" && r.band_id).map((r) => r.band_id!),
  });
  return emailed.error ? { ok: true, message: `${moved} The emails couldn't be sent: ${emailed.error}` } : { ok: true, message: `${moved} ${emailed.message}` };
}
