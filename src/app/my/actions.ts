"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** A volunteer cancels one of their own shifts; the spot opens back up. */
export async function cancelMyShift(assignmentId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_assignment", { p_assignment_id: assignmentId });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/my");
  return { ok: true };
}
