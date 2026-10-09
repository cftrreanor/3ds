"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

/** At the door, after looking at one adult's photo ID (or undo). adult 0 is the parent who registered. */
export async function setParentCheckedIn(eventId: string, registrationId: string, adult: number, checkedIn: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_parent_checked_in", { p_id: registrationId, p_in: checkedIn, p_adult: adult });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

/** Hosts open or close parent registration. */
export async function setParentRegistrationOpen(eventId: string, open: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update({ parent_registration_open: open }).eq("id", eventId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can open or close registration." };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

/** Hosts pick when parent registration closes on its own (in the event's time zone), or clear it. */
export async function setParentRegistrationClosesAt(
  eventId: string,
  timezone: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const clear = formData.get("clear") === "1";
  let closesAt: string | null = null;
  if (!clear) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and a time." };
    const at = zonedToUtc(date, time, timezone);
    if (Number.isNaN(at.getTime())) return { error: "Pick a date and a time." };
    if (at <= new Date()) return { error: "Pick a time that hasn't passed yet." };
    closesAt = at.toISOString();
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ parent_registration_closes_at: closesAt })
    .eq("id", eventId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's host can change this." };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: closesAt ? "Saved. Registration will close on its own then." : "Removed. Registration stays open until you close it." };
}
