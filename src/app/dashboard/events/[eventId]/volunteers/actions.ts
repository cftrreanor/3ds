"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function setCheckedIn(eventId: string, assignmentId: string, checkedIn: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in_volunteer", { p_assignment_id: assignmentId, p_checked_in: checkedIn });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

/** Someone showed up to help: add them to a shift, checked in. */
export async function addWalkUp(
  eventId: string,
  shiftId: string,
  overCapacity: boolean,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const name = String(formData.get("fullName") ?? "").trim();
  if (name.length < 2) return { error: "Please enter their name." };
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Please enter a 10-digit phone number." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_walk_up", {
    p_shift_id: shiftId,
    p_full_name: name,
    p_phone: phone,
    p_over_capacity: overCapacity,
  });
  if (error) {
    if (error.code === "P0004") return { error: "This shift just filled up. Tap Add again to add them anyway." };
    return { error: friendlyDbError(error) };
  }
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: `${name} is added and checked in.` };
}

/** A no-show: take them off the shift so a walk-up can have the spot. */
export async function releaseSpot(eventId: string, assignmentId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_assignment", { p_assignment_id: assignmentId });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}
