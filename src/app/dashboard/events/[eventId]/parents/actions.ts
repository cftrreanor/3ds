"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
