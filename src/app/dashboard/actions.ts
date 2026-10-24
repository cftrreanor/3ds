"use server";

import { revalidatePath } from "next/cache";
import { brand } from "@/lib/brand";
import { eventTypeLabel, isEventType } from "@/lib/event-types";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { emailMovedMeetings } from "@/app/e/[slug]/book/data";
import { getOrigin } from "@/lib/data";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/slug";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { asksChildName } from "@/lib/conference-settings";
import { FILES_BUCKET } from "@/lib/event-files";
import { eachDate, isValidTimezone, utcToZonedTime, zonedToUtc } from "@/lib/time";
import { loadCalendarEntries, sendShiftUpdates } from "@/lib/volunteer-emails";

// Every action re-checks who is signed in; the database's Row Level Security
// then decides what they're allowed to change.

const text = (max: number) => z.string().trim().min(1, "Required").max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Pick a time");
const timezone = z.string().refine(isValidTimezone, "Pick a time zone");
/** An optional latitude/longitude; blank or invalid becomes undefined. */
const coordinate = (limit: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().min(-limit).max(limit).optional().catch(undefined),
  );

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue.path.join(".");
  return field ? `${labelFor(field)}: ${issue.message}` : issue.message;
}

function labelFor(field: string) {
  const labels: Record<string, string> = {
    fullName: "Your name",
    orgName: "Organization name",
    name: "Name",
    startsOn: "Start date",
    endsOn: "End date",
    startTime: "Start time",
    endTime: "End time",
    venueAddress: "Venue",
    capacity: "Volunteers needed",
    blockHours: "Shift length",
    title: "Title",
  };
  return labels[field] ?? field;
}

/**
 * After a schedule change, email each affected volunteer an updated calendar
 * invite. Runs after the response is sent, so the host isn't kept waiting.
 */
async function notifyVolunteersOfChanges(shiftIds: string[]) {
  if (shiftIds.length === 0) return;
  const supabase = await createClient();
  const { data } = await supabase.from("volunteer_assignments").select("id").in("shift_id", shiftIds);
  const ids = (data ?? []).map((a) => a.id);
  if (ids.length === 0) return;
  const origin = await getOrigin();
  after(async () => {
    const entries = await loadCalendarEntries(ids, true);
    await sendShiftUpdates(entries, entries[0]?.timezone ?? "America/Chicago", origin);
  });
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------
const orgSchema = z.object({
  fullName: text(120),
  phone: z.string().trim(),
  orgName: text(120),
  timezone,
});

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = orgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { fullName, phone, orgName, timezone: tz } = parsed.data;

  const e164 = phone ? normalizePhone(phone) : null;
  if (phone && !e164) return { error: "Mobile phone: please enter a 10-digit US number." };

  const supabase = await createClient();
  const profile = await supabase.from("profiles").update({ full_name: fullName, phone: e164 }).eq("id", user.id);
  if (profile.error) return { error: friendlyDbError(profile.error) };

  const { error } = await supabase.rpc("create_organization", {
    org_name: orgName,
    org_slug: slugify(orgName),
    tz,
  });
  // No host invitation: the database says how to get one.
  if (error?.code === "42501") return { error: error.message };
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
const eventSchema = z
  .object({
    organizationId: z.string().uuid(),
    name: text(120),
    startsOn: date,
    endsOn: date,
    startTime: time,
    endTime: time,
    timezone,
    eventType: z.string().optional(),
    // Conferences ask for the school later, in Conference Setup (step 2), so
    // their form sends no venue fields at all.
    venueName: optionalText(120).optional(),
    venueAddress: optionalText(300).optional(),
    venuePlaceId: optionalText(300).optional(),
    venueLat: coordinate(90),
    venueLng: coordinate(180),
    // Conferences: "on" when families are asked for their child's name (the field is there when askChildNameField is).
    askChildName: z.string().optional(),
    askChildNameField: z.string().optional(),
  })
  .refine((v) => v.eventType === "conference" || Boolean(v.venueAddress), { message: "Required", path: ["venueAddress"] })
  .refine((v) => v.endsOn >= v.startsOn, { message: "End date can't be before the start date", path: ["endsOn"] })
  .refine((v) => v.endsOn > v.startsOn || v.endTime > v.startTime, {
    message: "End time must be after the start time",
    path: ["endTime"],
  });

export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const eventType = formData.get("eventType");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      event_type: isEventType(eventType) ? eventType : "band_contest",
      organization_id: v.organizationId,
      name: v.name,
      slug: slugify(v.name),
      timezone: v.timezone,
      starts_on: v.startsOn,
      ends_on: v.endsOn,
      window_start: zonedToUtc(v.startsOn, v.startTime, v.timezone).toISOString(),
      window_end: zonedToUtc(v.endsOn, v.endTime, v.timezone).toISOString(),
      venue_name: v.venueName ?? null,
      venue_address: v.venueAddress ?? "",
      venue_place_id: v.venuePlaceId ?? null,
      venue_lat: v.venuePlaceId ? (v.venueLat ?? null) : null,
      venue_lng: v.venuePlaceId ? (v.venueLng ?? null) : null,
      created_by: user.id,
      // Only when off, so new conferences still save before the 20261219000000 update.
      ...(v.askChildNameField && v.askChildName !== "on" ? { ask_child_name: false } : {}),
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${data.id}`);
}

export async function updateEvent(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("events")
    .select("timezone, starts_on, window_start, venue_name, venue_address, name, event_type")
    .eq("id", eventId)
    .maybeSingle();
  // A conference's school is set in Conference Setup, not here.
  const conference = before?.event_type === "conference";
  if (!conference && !v.venueAddress) return { error: "Venue: Required" };
  const details = await supabase
    .from("events")
    .update({
      name: v.name,
      ...(conference
        ? // Only when it changed, so details still save before the 20261219000000 update.
          v.askChildNameField && (v.askChildName === "on") !== (await asksChildName(supabase, eventId))
          ? { ask_child_name: v.askChildName === "on" }
          : {}
        : {
            venue_name: v.venueName ?? null,
            venue_address: v.venueAddress,
            venue_place_id: v.venuePlaceId ?? null,
            venue_lat: v.venuePlaceId ? (v.venueLat ?? null) : null,
            venue_lng: v.venuePlaceId ? (v.venueLng ?? null) : null,
          }),
    })
    .eq("id", eventId)
    .select("id");
  if (details.error) return { error: friendlyDbError(details.error) };
  if (!details.data?.length) return { error: "Only the event's host can change its details." };

  // Dates, hours and time zone go through one database call that also moves
  // existing shifts so they keep their times on the new day.
  const { error } = await supabase.rpc("reschedule_event", {
    p_event_id: eventId,
    p_starts_on: v.startsOn,
    p_ends_on: v.endsOn,
    p_window_start: zonedToUtc(v.startsOn, v.startTime, v.timezone).toISOString(),
    p_window_end: zonedToUtc(v.endsOn, v.endTime, v.timezone).toISOString(),
    p_timezone: v.timezone,
  });
  if (error) return { error: friendlyDbError(error) };

  // Volunteers' calendars need updating if the day, time zone, venue or name changed.
  const changed =
    before &&
    (before.starts_on !== v.startsOn ||
      before.timezone !== v.timezone ||
      (!conference && before.venue_address !== v.venueAddress) ||
      (!conference && (before.venue_name ?? null) !== (v.venueName ?? null)) ||
      before.name !== v.name);
  // A conference's booked meetings moved with the day: email each family.
  if (conference && (before.starts_on !== v.startsOn || before.timezone !== v.timezone)) await emailMovedMeetings(eventId);
  if (changed) {
    const { data: shiftRows } = await supabase.from("shifts").select("id").eq("event_id", eventId);
    await notifyVolunteersOfChanges((shiftRows ?? []).map((r) => r.id));
  }

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  redirect(`/dashboard/events/${eventId}`);
}

/**
 * Deletes an event for good, with everything attached to it (the database
 * removes stations, shifts, volunteers, registrations, schedules and the
 * team along with it), then its uploaded files from storage. Hosts only.
 */
export async function deleteEvent(eventId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: files } = await supabase.from("event_files").select("path").eq("event_id", eventId);
  const { data, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can delete it." };
  const paths = (files ?? []).map((f) => f.path);
  if (paths.length) {
    const { error: removeError } = await createAdminClient().storage.from(FILES_BUCKET).remove(paths);
    if (removeError) console.error("Removing a deleted event's files from storage failed", removeError);
  }
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard?deleted=1");
}

export async function setEventPublished(eventId: string, publish: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update(publish ? { status: "published" } : { status: "draft", volunteer_signup_open: false })
    .eq("id", eventId)
    .select("id");
  if (error) {
    if (error.code === "42501" && error.message.startsWith("Weekly hours are a premium feature")) {
      return { error: `Weekly hours are a premium feature. Write to us at ${brand.supportEmail} to add them to your account.` };
    }
    if (error.code === "42501") {
      return {
        error:
          `Publishing needs an active ${brand.name} plan for your organization. During the pilot, ask us to activate it.`,
      };
    }
    // Another conference went live in the meantime (the event page usually says so before the click).
    const other = error.message.match(/already have a published conference: (.+)\. Unpublish/)?.[1];
    if (other) {
      return {
        error: `While we're in the pilot, a free teacher account can have one published conference at a time, and ${other} is published now. Unpublish it first, or write to us at ${brand.supportEmail} if you need more than one at a time.`,
      };
    }
    return { error: friendlyDbError(error) };
  }
  if (!data?.length) return { error: "Only the event's host can publish it." };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

export async function setVolunteerSignupOpen(eventId: string, open: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ volunteer_signup_open: open })
    .eq("id", eventId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can open or close signups." };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
const stationSchema = z.object({
  name: text(80),
  location: optionalText(200),
  instructions: optionalText(2000),
});
/** A check-in station's kind (blank for a regular station). */
function checkpointKind(formData: FormData) {
  const kind = z.enum(["parking", "stop", "warm_up", "gate"]).safeParse(formData.get("checkpointKind"));
  return kind.success ? kind.data : null;
}

/** Parking and check-in points: minutes before warm-up a band is due (blank: no deadline). */
function dueMinutes(formData: FormData, kind: string | null) {
  if (kind !== "parking" && kind !== "stop") return null;
  const raw = String(formData.get("dueMinutes") ?? "").trim();
  return /^\d{1,3}$/.test(raw) ? Math.min(Number(raw), 600) : null;
}

/** School fairs: the station's zone, only when the form has the Zone field. */
function zoneOf(formData: FormData) {
  if (!formData.has("zone")) return {};
  const zone = String(formData.get("zone") ?? "").trim().slice(0, 60);
  return { zone: zone || null };
}

/** The next place in the event's check-in order. */
async function nextCheckpointOrder(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string) {
  const { data } = await supabase
    .from("stations")
    .select("checkpoint_order")
    .eq("event_id", eventId)
    .not("checkpoint_order", "is", null)
    .order("checkpoint_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.checkpoint_order ?? 0) + 1;
}

/**
 * Step 1 of Stations & shifts: a new station, with its name and leads. Its
 * other details are filled in later, in "1. Station details".
 */
export async function createStation(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  // Step 1 asks only for the name and leads: the rest starts blank.
  const parsed = stationSchema.safeParse({ location: "", instructions: "", ...Object.fromEntries(formData) });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const kind = checkpointKind(formData);
  const leadIds = z.array(z.string().uuid()).max(20).safeParse(formData.getAll("leadIds"));
  if (!leadIds.success) return { error: "Something went wrong with the Section Leads. Please try again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stations")
    .insert({
      event_id: eventId,
      name: v.name,
      station_type: kind ? "active_checkpoint" : "passive",
      checkpoint_kind: kind,
      checkpoint_order: kind ? await nextCheckpointOrder(supabase, eventId) : null,
      due_minutes_before_warm_up: dueMinutes(formData, kind),
      location: v.location,
      instructions: v.instructions,
      adults_only: formData.get("adultsOnly") === "on",
      ...zoneOf(formData),
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };
  for (const userId of leadIds.data) {
    const { error: addError } = await supabase.from("station_leads").insert({ station_id: data.id, user_id: userId, event_id: eventId });
    if (addError) return { error: friendlyDbError(addError) };
  }

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: `Added “${v.name}”. Set it up in step 2.` };
}

export async function updateStation(
  eventId: string,
  stationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = stationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const leadIds = z.array(z.string().uuid()).max(20).safeParse(formData.getAll("leadIds"));
  if (!leadIds.success) return { error: "Something went wrong with the Section Leads. Please try again." };

  const supabase = await createClient();
  // A station that becomes a check-in station goes to the end of the order; one that stops being one leaves it.
  const kind = checkpointKind(formData);
  const { data: current } = await supabase.from("stations").select("checkpoint_order").eq("id", stationId).maybeSingle();
  const order = kind ? (current?.checkpoint_order ?? (await nextCheckpointOrder(supabase, eventId))) : null;
  const { error } = await supabase
    .from("stations")
    .update({
      name: v.name,
      station_type: kind ? "active_checkpoint" : "passive",
      checkpoint_kind: kind,
      checkpoint_order: order,
      due_minutes_before_warm_up: dueMinutes(formData, kind),
      location: v.location,
      instructions: v.instructions,
      adults_only: formData.get("adultsOnly") === "on",
      ...zoneOf(formData),
      // Marks "1. Station details" done.
      details_saved_at: new Date().toISOString(),
    })
    .eq("id", stationId);
  if (error) return { error: friendlyDbError(error) };

  if (formData.has("leadsField")) {
    const leadError = await syncStationLeads(supabase, eventId, stationId, leadIds.data);
    if (leadError) return { error: leadError };
  }

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: "Station saved." };
}

/** A station's leads become exactly these: the newly ticked are added (in the order shown), the unticked removed. */
async function syncStationLeads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  stationId: string,
  leadIds: string[],
): Promise<string | null> {
  const { data: current } = await supabase.from("station_leads").select("user_id").eq("station_id", stationId);
  const had = new Set((current ?? []).map((r) => r.user_id));
  const want = new Set(leadIds);
  const removed = [...had].filter((id) => !want.has(id));
  if (removed.length) {
    const { error } = await supabase.from("station_leads").delete().eq("station_id", stationId).in("user_id", removed);
    if (error) return friendlyDbError(error);
  }
  for (const userId of leadIds.filter((id) => !had.has(id))) {
    const { error } = await supabase.from("station_leads").insert({ station_id: stationId, user_id: userId, event_id: eventId });
    if (error) return friendlyDbError(error);
  }
  return null;
}

/** Step 1, on a station's row: who leads it. */
export async function setStationLeads(eventId: string, stationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const leadIds = z.array(z.string().uuid()).max(20).safeParse(formData.getAll("leadIds"));
  if (!leadIds.success) return { error: "Something went wrong with the leads. Please try again." };
  const supabase = await createClient();
  const leadError = await syncStationLeads(supabase, eventId, stationId, leadIds.data);
  if (leadError) return { error: leadError };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: leadIds.data.length ? "Leads saved." : "Leads removed." };
}

/** Step 1, on a station's row: its name. */
export async function renameStation(eventId: string, stationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const name = text(80).safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: "Please enter the station's name." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("stations").update({ name: name.data }).eq("id", stationId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to do that." };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: `Renamed to “${name.data}”.` };
}

/** Moves a check-in station one place earlier or later in the band's path. */
export async function moveCheckpoint(eventId: string, stationId: string, direction: "up" | "down"): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("stations")
    .select("id, checkpoint_order")
    .eq("event_id", eventId)
    .not("checkpoint_order", "is", null)
    .order("checkpoint_order");
  const list = data ?? [];
  const i = list.findIndex((s) => s.id === stationId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  // Renumber 1…n with the two swapped, so the order stays tidy.
  [list[i], list[j]] = [list[j], list[i]];
  for (const [n, s] of list.entries()) {
    if (s.checkpoint_order === n + 1) continue;
    const { error } = await supabase.from("stations").update({ checkpoint_order: n + 1 }).eq("id", s.id);
    if (error) return { error: friendlyDbError(error) };
  }
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

export async function deleteStation(eventId: string, stationId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("shifts")
    .select("id", { count: "exact", head: true })
    .eq("station_id", stationId)
    .gt("registered_count", 0);
  if (count) return { error: "Volunteers have signed up for this station's shifts, so it can't be deleted." };

  const { error } = await supabase.from("stations").delete().eq("id", stationId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------
type EventTiming = { timezone: string; starts_on: string; ends_on: string; window_start: string; window_end: string };

async function loadEventTiming(eventId: string): Promise<EventTiming | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("timezone, starts_on, ends_on, window_start, window_end")
    .eq("id", eventId)
    .maybeSingle();
  return data;
}

const shiftSchema = z
  .object({
    // Optional when creating: a new shift is named from its start time ("Morning shift").
    title: optionalText(120),
    day: date,
    startTime: time,
    endTime: time,
    capacity: z.coerce.number().int().min(1, "At least 1").max(500),
    description: optionalText(2000),
  })
  .refine((v) => v.endTime > v.startTime, { message: "End time must be after the start time", path: ["endTime"] });

export async function createShift(
  eventId: string,
  stationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  // Title and duties are optional (the create form leaves them out).
  const parsed = shiftSchema.safeParse({ title: "", description: "", ...Object.fromEntries(formData) });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const event = await loadEventTiming(eventId);
  if (!event) return { error: "Event not found." };

  const supabase = await createClient();
  const startsAt = zonedToUtc(v.day, v.startTime, event.timezone);
  const title = v.title ?? shiftTitle(startsAt, event.timezone);
  const { error } = await supabase.from("shifts").insert({
    station_id: stationId,
    title,
    description: v.description,
    starts_at: zonedToUtc(v.day, v.startTime, event.timezone).toISOString(),
    ends_at: zonedToUtc(v.day, v.endTime, event.timezone).toISOString(),
    max_capacity: v.capacity,
  });
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: `Added “${title}”.` };
}

const generateSchema = z.object({
  blockHours: z.coerce.number().int().min(1).max(12),
  capacity: z.coerce.number().int().min(1, "At least 1").max(500),
});

/**
 * PRD §4.1: split the event's daily window (e.g. 7 AM–10 PM) into equal blocks
 * (e.g. 3 hours) for one station, replacing its shifts (only while nobody has
 * signed up for any of them).
 */
export async function generateShifts(
  eventId: string,
  stationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = generateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { blockHours, capacity } = parsed.data;

  const event = await loadEventTiming(eventId);
  if (!event) return { error: "Event not found." };

  const supabase = await createClient();
  // Auto create replaces the station's shifts, as long as nobody has signed up for any of them yet.
  const { data: existing } = await supabase.from("shifts").select("id, registered_count").eq("station_id", stationId);
  if ((existing ?? []).some((s) => s.registered_count > 0)) {
    return {
      error: "Volunteers have signed up for this station's shifts, so auto create can't replace them. Edit them one at a time below, or create a single shift.",
    };
  }

  const dayStart = utcToZonedTime(event.window_start, event.timezone);
  const dayEnd = utcToZonedTime(event.window_end, event.timezone);
  const days = eachDate(event.starts_on, event.ends_on);
  const blockMs = blockHours * 60 * 60 * 1000;

  const rows: { station_id: string; title: string; starts_at: string; ends_at: string; max_capacity: number }[] = [];
  for (const day of days) {
    const start = zonedToUtc(day, dayStart, event.timezone).getTime();
    const end = zonedToUtc(day, dayEnd, event.timezone).getTime();
    for (let t = start; t < end; t += blockMs) {
      const blockEnd = Math.min(t + blockMs, end);
      rows.push({
        station_id: stationId,
        title: shiftTitle(new Date(t), event.timezone),
        starts_at: new Date(t).toISOString(),
        ends_at: new Date(blockEnd).toISOString(),
        max_capacity: capacity,
      });
    }
  }

  if (rows.length === 0) return { error: "The event's times leave no room for shifts. Check its start and end times." };
  const replaced = existing?.length ?? 0;
  if (replaced) {
    const { error: deleteError } = await supabase.from("shifts").delete().eq("station_id", stationId).eq("registered_count", 0);
    if (deleteError) return { error: friendlyDbError(deleteError) };
  }
  const { error } = await supabase.from("shifts").insert(rows);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  const made = `${rows.length} shift${rows.length === 1 ? "" : "s"}`;
  return { ok: true, message: replaced ? `Replaced this station's shifts with ${made}.` : `Added ${made}.` };
}

function shiftTitle(start: Date, tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(start));
  return hour < 12 ? "Morning shift" : hour < 17 ? "Afternoon shift" : "Evening shift";
}

export async function updateShift(
  eventId: string,
  shiftId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  // Title and duties are optional (the create form leaves them out).
  const parsed = shiftSchema.safeParse({ title: "", description: "", ...Object.fromEntries(formData) });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const event = await loadEventTiming(eventId);
  if (!event) return { error: "Event not found." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("shifts")
    .select("title, starts_at, ends_at")
    .eq("id", shiftId)
    .maybeSingle();
  const startsAt = zonedToUtc(v.day, v.startTime, event.timezone).toISOString();
  const endsAt = zonedToUtc(v.day, v.endTime, event.timezone).toISOString();
  const { error } = await supabase
    .from("shifts")
    .update({
      ...(v.title ? { title: v.title } : {}),
      description: v.description,
      starts_at: startsAt,
      ends_at: endsAt,
      max_capacity: v.capacity,
    })
    .eq("id", shiftId);
  if (error) return { error: friendlyDbError(error) };

  const moved =
    before &&
    (new Date(before.starts_at).getTime() !== new Date(startsAt).getTime() ||
      new Date(before.ends_at).getTime() !== new Date(endsAt).getTime() ||
      (v.title !== null && before.title !== v.title));
  if (moved) await notifyVolunteersOfChanges([shiftId]);

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: "Shift saved." };
}

export async function deleteShift(eventId: string, shiftId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: shift } = await supabase.from("shifts").select("registered_count").eq("id", shiftId).maybeSingle();
  if (shift && shift.registered_count > 0) {
    return { error: "Volunteers have signed up for this shift, so it can't be deleted." };
  }
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

/** Change the kind of event (the database checks no bands, or parents, have registered). */
export async function setEventType(eventId: string, type: string): Promise<ActionState> {
  await requireUser();
  if (!isEventType(type)) return { error: "Pick a kind of event." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update({ event_type: type }).eq("id", eventId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can change this." };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: `Done: this is now a ${eventTypeLabel(type).toLowerCase()}.` };
}
