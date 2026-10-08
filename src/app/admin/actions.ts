"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { isFreePlan, PLANS, planLabel, requirePlatformAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";

/** Change an organization's plan. The database checks it's an admin and logs it. */
export async function setPlan(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const status = String(formData.get("status") ?? "");
  if (!PLANS.some((p) => p.value === status)) return { error: "Pick a plan." };
  const freeUntil = String(formData.get("freeUntil") ?? "");
  const free = isFreePlan(status);
  if (free && !/^\d{4}-\d{2}-\d{2}$/.test(freeUntil)) return { error: "Pick the last day of the free period." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan", {
    p_org: orgId,
    p_status: status,
    p_free_until: free ? freeUntil : null,
    p_note: note || null,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Saved: ${planLabel(status)}${free ? ` through ${formatDate(freeUntil)}` : ""}.` };
}
