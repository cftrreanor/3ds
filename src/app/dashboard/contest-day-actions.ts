"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ACTIONS = [
  "buses_here",
  "equipment_here",
  "away",
  "back",
  "left",
  "here",
  "performed",
  "scratched",
  "unscratched",
  // Tapping a done step again takes just that step back.
  "clear_buses",
  "clear_equipment",
  "clear_left",
  "clear_here",
  "clear_performed",
] as const;
export type BandActionName = (typeof ACTIONS)[number];

const refresh = (eventId: string) => revalidatePath(`/dashboard/events/${eventId}`, "layout");

/** One tap at a check-in station. The database checks the tapper leads that station. */
export async function bandAction(
  eventId: string,
  bandId: string,
  action: BandActionName,
  stationId: string | null,
  round: "prelims" | "finals" | null,
): Promise<ActionState> {
  await requireUser();
  if (!ACTIONS.includes(action)) return { error: "Unknown action." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("band_action", { p_band_id: bandId, p_action: action, p_station_id: stationId, p_round: round });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true };
}

export async function undoBandAction(eventId: string, bandId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_band_action", { p_band_id: bandId });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true };
}

const noteSchema = z.object({ body: z.string().trim().min(1, "Write a note first.").max(500, "Keep notes under 500 characters.") });

export async function addBandNote(eventId: string, bandId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("band_notes").insert({ band_id: bandId, body: parsed.data.body });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true };
}

export async function deleteBandNote(eventId: string, noteId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("band_notes").delete().eq("id", noteId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the person who wrote a note, or a host or Volunteer Lead, can delete it." };
  refresh(eventId);
  return { ok: true };
}

const spotsSchema = z.object({
  equipmentSpots: z
    .string()
    .trim()
    .regex(/^\d*$/, "Enter a number.")
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v >= 1 && v <= 500), "Enter a number from 1 to 500, or leave it blank."),
});

/** How many equipment spots the lot has (hosts). Blank means "don't track". */
export async function setEquipmentSpots(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = spotsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ equipment_spots: parsed.data.equipmentSpots })
    .eq("id", eventId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only a host can change the lot size." };
  refresh(eventId);
  return { ok: true, message: "Saved." };
}
