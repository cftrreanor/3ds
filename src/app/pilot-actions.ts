"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";
import { PILOT_EVENT_TYPES, pilotEventTypeLabels } from "@/lib/pilot";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(200),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  phone: z.string().trim().min(1, "Please enter your phone number.").max(30),
  organization: z.string().trim().min(2, "Please enter your school or organization.").max(200),
  notes: z.string().trim().max(2000, "Please keep your answer under 2,000 characters."),
});

const THANKS = "Thanks! We got your request and will be in touch within a few days.";

/**
 * "Join the pilot" from the home page. Visitors aren't signed in, so this
 * saves with the server's private key; the table itself can't be written
 * from a browser. Then it emails the request to us (reply goes to them).
 */
export async function requestPilot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Simple bot traps: a hidden field people never fill in, and a minimum time on the page.
  const startedAt = Number(formData.get("startedAt"));
  if (String(formData.get("website") ?? "") || !startedAt || Date.now() - startedAt < 2500) {
    return { error: "Something went wrong. Please try again." };
  }

  const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: "Please enter a 10-digit phone number." };
  const known = new Set(PILOT_EVENT_TYPES.map((t) => t.value));
  const eventTypes = [...new Set(formData.getAll("eventTypes").map(String))].filter((v) => known.has(v));
  if (!eventTypes.length) return { error: "Please pick at least one kind of event." };

  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: mine }, { count: everyone }] = await Promise.all([
    admin.from("pilot_requests").select("id", { count: "exact", head: true }).eq("email", d.email).gte("created_at", hourAgo),
    admin.from("pilot_requests").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
  ]);
  // Sent twice (double tap, back button): we already have it.
  if (mine) return { ok: true, message: THANKS };
  if ((everyone ?? 0) >= 30) {
    return { error: `We're getting a lot of requests right now. Please email us at ${brand.supportEmail} instead.` };
  }

  const base = { name: d.name, email: d.email, phone, organization: d.organization };
  let { error } = await admin.from("pilot_requests").insert({ ...base, event_types: eventTypes, notes: d.notes || null });
  if (error && isSchemaError(error)) {
    // Before 20261115000000_pilot_event_types.sql: keep the event types in the notes.
    const typesLine = `Event types: ${pilotEventTypeLabels(eventTypes).join(", ")}`;
    ({ error } = await admin.from("pilot_requests").insert({ ...base, notes: [typesLine, d.notes].filter(Boolean).join("\n\n") }));
  }
  if (error) {
    console.error("Saving pilot request failed", error);
    return { error: `We couldn't send that. Please try again, or email us at ${brand.supportEmail}.` };
  }

  const origin = await getOrigin();
  const rows = [
    { title: "Name", detail: d.name },
    { title: "Email", detail: d.email },
    { title: "Phone", detail: phone },
    { title: "Organization", detail: d.organization },
    { title: "Event types", detail: pilotEventTypeLabels(eventTypes).join(", ") },
    ...(d.notes ? [{ title: "Hardest part today", detail: d.notes }] : []),
  ];
  const { html, text } = emailLayout({
    heading: `Pilot request: ${d.organization}`,
    paragraphs: [`${d.name} asked to join the pilot. Reply to this email to reach them.`],
    rows,
    button: { label: "Open the pilot pipeline", url: `${origin}/admin/pipeline` },
  });
  await sendEmail({ to: brand.supportEmail, subject: `Pilot request: ${d.organization}`, html, text, replyTo: d.email });

  return { ok: true, message: THANKS };
}
