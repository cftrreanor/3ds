"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/**
 * Band registration settings, saved one field at a time as the host types (Registration, step 2
 * of a band contest's setup). One field per save means two people editing at once never undo each
 * other's changes, and a failed save names the field it was.
 */

export type RegistrationField = "deadline" | "directorInfo" | "paymentLink" | "chaperoneLimit" | "contactName" | "contactPhone" | "contactEmail";

const FIELDS: Record<RegistrationField, z.ZodType<string | number | null>> = {
  deadline: z.union([z.literal("").transform(() => null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")]),
  directorInfo: z
    .string()
    .trim()
    .max(3000, "This is too long (3,000 characters max).")
    .transform((v) => v || null),
  paymentLink: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || (/^https:\/\/\S+$/.test(v) && v.length <= 500), "Use a full https:// link, like https://yourschool.org/pay."),
  chaperoneLimit: z.coerce.number().int("Use a whole number.").min(0).max(500, "Use a number up to 500."),
  contactName: z.string().trim().max(150, "This name is too long."),
  contactPhone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return "";
      const p = normalizePhone(v);
      if (!p) ctx.addIssue({ code: "custom", message: "Enter a 10-digit phone number." });
      return p ?? "";
    }),
  contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a full email address.")]),
};

const EVENT_COLUMN: Partial<Record<RegistrationField, string>> = {
  deadline: "band_registration_deadline",
  directorInfo: "director_info",
  paymentLink: "payment_link",
  chaperoneLimit: "chaperone_limit",
};
const CONTACT_COLUMN: Partial<Record<RegistrationField, "name" | "phone" | "email">> = {
  contactName: "name",
  contactPhone: "phone",
  contactEmail: "email",
};

function refresh(eventId: string) {
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
}

/** Saves one field. The director contact starts from the host's profile, so the first save keeps the rest of it. */
export async function saveRegistrationField(eventId: string, field: RegistrationField, value: string): Promise<ActionState> {
  const user = await requireUser();
  const schema = FIELDS[field];
  if (!schema) return { error: "That can't be saved here." };
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();

  const column = EVENT_COLUMN[field];
  if (column) {
    const { data, error } = await supabase
      .from("events")
      .update({ [column]: parsed.data })
      .eq("id", eventId)
      .select("id");
    if (error) return { error: friendlyDbError(error) };
    if (!data?.length) return { error: "Only the event's host can change this." };
    refresh(eventId);
    return { ok: true };
  }

  const contactColumn = CONTACT_COLUMN[field]!;
  const { data: existing } = await supabase.from("event_director_contacts").select("event_id").eq("event_id", eventId).maybeSingle();
  // No contact saved yet: save the suggestion from the host's profile along with this change.
  const start = existing ? {} : await suggestedContact(user.id, user.email ?? "");
  const { error } = await supabase
    .from("event_director_contacts")
    .upsert({ event_id: eventId, ...start, [contactColumn]: parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true };
}

async function suggestedContact(userId: string, email: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
  return { name: profile?.full_name ?? "", phone: profile?.phone ?? "", email };
}

/** Saves the suggested director contact if none is saved yet (before publishing, so directors always have someone to call). */
export async function ensureDirectorContact(eventId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("event_director_contacts").select("event_id").eq("event_id", eventId).maybeSingle();
  if (existing) return;
  await supabase.from("event_director_contacts").insert({ event_id: eventId, ...(await suggestedContact(user.id, user.email ?? "")) });
}

/** Adds classifications one at a time, so a co-host's additions are kept. Returns the list as it now stands. */
export async function addClassifications(eventId: string, names: string[]): Promise<ActionState & { classifications?: string[] }> {
  await requireUser();
  const supabase = await createClient();
  let list: string[] | undefined;
  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    const { data, error } = await supabase.rpc("add_event_classification", { p_event: eventId, p_name: name });
    if (error) return { error: friendlyDbError(error), classifications: list };
    list = data as string[];
  }
  refresh(eventId);
  return { ok: true, classifications: list };
}

/** Removes one classification. The database refuses one that bands are registered in. */
export async function removeClassification(eventId: string, name: string): Promise<ActionState & { classifications?: string[] }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_event_classification", { p_event: eventId, p_name: name });
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true, classifications: data as string[] };
}
