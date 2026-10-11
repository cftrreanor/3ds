"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, key: string, max: number) => {
  const v = String(formData.get(key) ?? "").trim().slice(0, max);
  return v || null;
};

const refresh = (eventId: string, slug?: string | null) => {
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  if (slug) revalidatePath(`/e/${slug}`);
};

/**
 * Add a booth (boothId null) or save one. The database checks the person
 * runs the event (host or Volunteer Lead) and that the event is a fair.
 */
export async function saveBooth(eventId: string, boothId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const title = text(formData, "title", 120);
  if (!title) return { error: "Say what it is, e.g. Dunk Tank or Face Painting." };
  const email = text(formData, "contactEmail", 254);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That contact email doesn't look right." };
  const rawPhone = text(formData, "contactPhone", 30);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "That phone number doesn't look right." };

  const row = {
    title,
    host_name: text(formData, "hostName", 120),
    zone: text(formData, "zone", 60),
    location: text(formData, "location", 120),
    description: text(formData, "description", 500),
    contact_name: text(formData, "contactName", 120),
    contact_email: email?.toLowerCase() ?? null,
    contact_phone: phone,
    show_publicly: formData.get("showPublicly") === "on",
  };
  const supabase = await createClient();
  const { error } = boothId
    ? await supabase.from("fair_booths").update(row).eq("id", boothId).eq("event_id", eventId)
    : await supabase.from("fair_booths").insert({ ...row, event_id: eventId });
  if (error) return { error: friendlyDbError(error) };
  const { data: event } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  refresh(eventId, event?.slug);
  return { ok: true, message: boothId ? "Saved." : `Added ${title}.` };
}

export async function deleteBooth(eventId: string, boothId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("fair_booths").delete().eq("id", boothId).eq("event_id", eventId);
  if (error) return { error: friendlyDbError(error) };
  const { data: event } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  refresh(eventId, event?.slug);
  return { ok: true };
}

/** Fair day: tap a partner in as arrived (or take it back). Anyone on the event team. */
export async function checkInBooth(eventId: string, boothId: string, arrived: boolean): Promise<ActionState> {
  await requireUser();
  const { error } = await (await createClient()).rpc("fair_booth_checkin", { p_booth: boothId, p_arrived: arrived });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}
