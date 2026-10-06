"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["new", "contacted", "accepted", "declined"] as const;

/** Platform admins only (the database enforces it). */
export async function setPilotStatus(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return { error: "Pick a status." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pilot_requests").update({ status }).eq("id", id).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to do that." };
  revalidatePath("/dashboard/pilot-requests");
  return { ok: true, message: "Saved." };
}
