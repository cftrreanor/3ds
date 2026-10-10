"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { isStage } from "@/lib/admin-crm";
import { createClient } from "@/lib/supabase/server";

export type NoteTarget = { organizationId?: string; profileId?: string; pilotRequestId?: string };

/** A private note (and optional follow-up date) on an account, person or pilot request. */
export async function addNote(target: NoteTarget, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a note first." };
  if (body.length > 5000) return { error: "Keep notes under 5,000 characters." };
  const followUp = String(formData.get("followUpOn") ?? "");
  if (followUp && !/^\d{4}-\d{2}-\d{2}$/.test(followUp)) return { error: "Pick a follow-up date." };
  const { error } = await (await createClient()).from("admin_notes").insert({
    organization_id: target.organizationId ?? null,
    profile_id: target.profileId ?? null,
    pilot_request_id: target.pilotRequestId ?? null,
    body,
    follow_up_on: followUp || null,
    author_id: user.id,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: followUp ? "Saved. It's on your follow-ups list." : "Note saved." };
}

/** Mark a follow-up done, or open it again. */
export async function setNoteDone(noteId: string, done: boolean) {
  const user = await requirePlatformAdmin();
  const { error } = await (await createClient())
    .from("admin_notes")
    .update({ done_at: done ? new Date().toISOString() : null, done_by: done ? user.id : null })
    .eq("id", noteId);
  if (error) console.error("setNoteDone failed", error.message);
  revalidatePath("/admin", "layout");
}

export async function deleteNote(noteId: string) {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).from("admin_notes").delete().eq("id", noteId);
  if (error) console.error("deleteNote failed", error.message);
  revalidatePath("/admin", "layout");
}

/** Move a pilot request to another pipeline stage. */
export async function moveStage(requestId: string, stage: string): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!isStage(stage)) return { error: "Pick a stage." };
  const { data, error } = await (await createClient()).from("pilot_requests").update({ status: stage }).eq("id", requestId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to do that." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
