"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** A host removes someone from the account's volunteer history (they asked to be forgotten). */
export async function removeFromVolunteerHistory(eventId: string, email: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("organization_id").eq("id", eventId).maybeSingle();
  if (!event) return { error: "That event isn't available." };
  const { error } = await supabase.rpc("remove_volunteer_history", { p_org: event.organization_id, p_email: email });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}/volunteering/history`);
  return { ok: true, message: "Removed from your volunteer history." };
}
