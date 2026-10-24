"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** A host removes someone from the account's volunteer tracking (they asked to be forgotten). The database checks they're a host. */
export async function removeFromVolunteerHistory(orgId: string, email: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_volunteer_history", { p_org: orgId, p_email: email });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/dashboard/volunteer-tracking");
  return { ok: true, message: "Removed from your volunteer tracking." };
}
