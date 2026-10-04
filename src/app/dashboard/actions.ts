"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { eachDate, isValidTimezone, utcToZonedTime, zonedToUtc } from "@/lib/time";

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
    venueName: optionalText(120),
    venueAddress: text(300),
    venuePlaceId: optionalText(300).optional(),
    venueLat: coordinate(90),
    venueLng: coordinate(180),
  })
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      organization_id: v.organizationId,
      name: v.name,
      slug: slugify(v.name),
      timezone: v.timezone,
      starts_on: v.startsOn,
      ends_on: v.endsOn,
      window_start: zonedToUtc(v.startsOn, v.startTime, v.timezone).toISOString(),
      window_end: zonedToUtc(v.endsOn, v.endTime, v.timezone).toISOString(),
      venue_name: v.venueName,
      venue_address: v.venueAddress,
      venue_place_id: v.venuePlaceId ?? null,
      venue_lat: v.venuePlaceId ? (v.venueLat ?? null) : null,
      venue_lng: v.venuePlaceId ? (v.venueLng ?? null) : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${data.id}`);
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
const stationSchema = z.object({
  name: text(80),
  stationType: z.enum(["passive", "active_checkpoint"]),
  location: optionalText(200),
  instructions: optionalText(2000),
});

export async function createStation(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = stationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("stations").insert({
    event_id: eventId,
    name: v.name,
    station_type: v.stationType,
    location: v.location,
    instructions: v.instructions,
  });
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true, message: `Added “${v.name}”.` };
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
  revalidatePath(`/dashboard/events/${eventId}`);
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
    title: text(120),
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
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;

  const event = await loadEventTiming(eventId);
  if (!event) return { error: "Event not found." };

  const supabase = await createClient();
  const { error } = await supabase.from("shifts").insert({
    station_id: stationId,
    title: v.title,
    description: v.description,
    starts_at: zonedToUtc(v.day, v.startTime, event.timezone).toISOString(),
    ends_at: zonedToUtc(v.day, v.endTime, event.timezone).toISOString(),
    max_capacity: v.capacity,
  });
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true, message: `Added “${v.title}”.` };
}

const generateSchema = z.object({
  blockHours: z.coerce.number().int().min(1).max(12),
  capacity: z.coerce.number().int().min(1, "At least 1").max(500),
});

/**
 * PRD §4.1: split the event's daily window (e.g. 7 AM–10 PM) into equal blocks
 * (e.g. 3 hours) for one station. Skips blocks that already exist.
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
  const { data: existing } = await supabase.from("shifts").select("starts_at").eq("station_id", stationId);
  const taken = new Set((existing ?? []).map((s) => new Date(s.starts_at).getTime()));

  const dayStart = utcToZonedTime(event.window_start, event.timezone);
  const dayEnd = utcToZonedTime(event.window_end, event.timezone);
  const days = eachDate(event.starts_on, event.ends_on);
  const blockMs = blockHours * 60 * 60 * 1000;

  const rows: { station_id: string; title: string; starts_at: string; ends_at: string; max_capacity: number }[] = [];
  for (const day of days) {
    const start = zonedToUtc(day, dayStart, event.timezone).getTime();
    const end = zonedToUtc(day, dayEnd, event.timezone).getTime();
    for (let t = start; t < end; t += blockMs) {
      if (taken.has(t)) continue;
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

  if (rows.length === 0) return { ok: true, message: "These shifts already exist, so nothing new was added." };
  const { error } = await supabase.from("shifts").insert(rows);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true, message: `Added ${rows.length} shift${rows.length === 1 ? "" : "s"}.` };
}

function shiftTitle(start: Date, tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(start));
  return hour < 12 ? "Morning shift" : hour < 17 ? "Afternoon shift" : "Evening shift";
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
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
