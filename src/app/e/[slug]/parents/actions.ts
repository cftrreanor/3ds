"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getOrigin } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { GRADES } from "@/lib/grades";
import { normalizePhone } from "@/lib/phone";
import { adultNames, parentEmail, parentLink, type Child } from "@/lib/parents";
import { createAdminClient } from "@/lib/supabase/server";

const EVENT_FIELDS = "name, starts_on, ends_on, window_start, window_end, timezone, venue_name, venue_address";

export type ParentState = ActionState & {
  confirmed?: { email: string; emailSent: boolean; children: Child[] };
  values?: { parentName: string; email: string; phone: string; otherAdults: string[]; children: Child[] };
};

const childSchema = z.object({
  name: z.string().trim().min(2, "Please enter each child's first and last name.").max(120),
  teacher: z.string().trim().min(1, "Please enter each child's teacher's last name.").max(80),
  grade: z.enum(GRADES, { message: "Please pick each child's grade." }),
});

const schema = z.object({
  parentName: z.string().trim().min(2, "Please enter your first and last name.").max(200),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  phone: z.string().trim().max(30),
  otherAdults: z
    .array(z.string().trim().min(2, "Please enter each adult's first and last name.").max(120))
    .max(5, "Up to 5 other adults can come on one registration."),
  children: z.array(childSchema).min(1, "Add at least one child.").max(8, "You can register up to 8 children."),
  idAgreed: z.literal(true, { message: "Please confirm you'll bring a government-issued photo ID." }),
});

/**
 * Public parent registration. Runs with the server's key because the parent
 * isn't signed in; register_parents() checks the event is open.
 */
export async function registerParents(eventId: string, slug: string, _prev: ParentState, formData: FormData): Promise<ParentState> {
  let children: Child[] = [];
  let otherAdults: string[] = [];
  try {
    children = JSON.parse(String(formData.get("children") ?? "[]"));
    otherAdults = JSON.parse(String(formData.get("otherAdults") ?? "[]"));
  } catch {
    // Reported below.
  }
  const values = {
    parentName: String(formData.get("parentName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    otherAdults,
    children,
  };
  const parsed = schema.safeParse({ ...values, idAgreed: formData.get("idAgreed") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const v = parsed.data;
  const phone = v.phone ? normalizePhone(v.phone) : null;
  if (v.phone && !phone) return { error: "Please enter a 10-digit phone number, or leave it blank.", values };

  const admin = createAdminClient();
  const { data: token, error } = await admin.rpc("register_parents", {
    p_event: eventId,
    p_name: v.parentName,
    p_email: v.email,
    p_phone: phone,
    p_children: v.children,
    p_other_adults: v.otherAdults,
  });
  if (error || !token) {
    if (error?.code === "P0001") return { error: error.message, values };
    console.error("register_parents failed", error);
    return { error: "Something went wrong. Please try again.", values };
  }

  const [{ data: event }, { data: reg }] = await Promise.all([
    admin.from("events").select(EVENT_FIELDS).eq("id", eventId).single(),
    admin.from("parent_registrations").select("id, calendar_sequence").eq("access_token", token as string).single(),
  ]);
  let emailSent = false;
  if (event && reg) {
    const message = parentEmail(
      "confirmation",
      { ...reg, parent_name: v.parentName, email: v.email, children: v.children, other_adults: v.otherAdults },
      event,
      parentLink(await getOrigin(), slug, token as string),
    );
    emailSent = await sendEmail({ to: v.email, ...message });
  }
  return { ok: true, confirmed: { email: v.email, emailSent, children: v.children } };
}

/** From the parent's own link. Also removes the calendar invite. */
export async function cancelParents(token: string, slug: string): Promise<ActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "This link isn't valid." };
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("parent_registrations")
    .select("id, event_id, parent_name, email, children, other_adults, calendar_sequence")
    .eq("access_token", token)
    .maybeSingle();
  const { error } = await admin.rpc("cancel_parent_registration", { p_token: token });
  if (error) {
    console.error("cancel_parent_registration failed", error);
    return { error: "Something went wrong. Please try again." };
  }
  if (reg) {
    const { data: event } = await admin.from("events").select(EVENT_FIELDS).eq("id", reg.event_id).single();
    if (event) {
      const message = parentEmail("canceled", { ...reg, children: reg.children as Child[], other_adults: adultNames(reg.other_adults) }, event, `${await getOrigin()}/e/${slug}/parents`);
      await sendEmail({ to: reg.email, ...message });
    }
  }
  redirect(`/e/${slug}/parents?canceled=1`);
}
