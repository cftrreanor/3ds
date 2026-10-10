"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Group events: mark a group arrived (roomId null) or done in a room, or take the tap back. */
export async function tapGroup(eventId: string, bandId: string, roomId: string | null, done: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("group_checkin", { p_band: bandId, p_room: roomId, p_done: done });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  revalidatePath(`/dashboard/bands/${bandId}`);
  return { ok: true };
}
