"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLogoUrl, pause, sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-format";
import { fillTemplate } from "@/lib/merge-fields";
import { createClient } from "@/lib/supabase/server";
import { emailRecipients, myName, type EmailTarget } from "./data";

/**
 * Email one or more people from a record page (an account's hosts, a person,
 * or a pilot request). Merge fields are filled in for each recipient, replies
 * go to the support address, and each email lands on the timeline.
 */
export async function sendAdminEmail(target: EmailTarget, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (!subject) return { error: "Add a subject." };
  if (!body) return { error: "Write the email first." };
  if (subject.length > 300 || body.length > 10000) return { error: "That email is too long." };

  // Only people who belong to this record can be emailed from it.
  const chosen = new Set(formData.getAll("to").map((v) => String(v).toLowerCase()));
  const recipients = (await emailRecipients(target)).filter((r) => chosen.has(r.email.toLowerCase()));
  if (recipients.length === 0) return { error: "Pick who to send it to." };

  const me = await myName(user.id);
  const logoUrl = emailLogoUrl(await getOrigin());
  const sent: string[] = [];
  const failed: string[] = [];
  for (const [i, r] of recipients.entries()) {
    if (i > 0) await pause();
    const vars = { ...r.vars, my_name: me };
    const s = fillTemplate(subject, vars).text;
    const b = fillTemplate(body, vars).text;
    const { html, text } = renderEmail(b, { logoUrl });
    const ok = await sendEmail({ to: r.email, subject: s, html, text, replyTo: brand.supportEmail, author: { userId: user.id, body: b } });
    (ok ? sent : failed).push(r.email);
  }
  revalidatePath("/admin", "layout");
  if (failed.length && !sent.length) return { error: `The email couldn't be sent to ${failed.join(", ")}. It's noted on the timeline.` };
  return {
    ok: true,
    message: `Sent to ${sent.join(", ")}.${failed.length ? ` Couldn't send to ${failed.join(", ")}.` : ""} Replies go to ${brand.supportEmail}.`,
  };
}

/** Save a new template, or update one (when the form has an id). */
export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (!name) return { error: "Give the template a name." };
  if (!subject || !body) return { error: "A template needs a subject and a message." };
  if (name.length > 120 || subject.length > 300 || body.length > 10000) return { error: "That template is too long." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("email_templates").update({ name, subject, body, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("email_templates").insert({ name, subject, body, created_by: user.id });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: id ? `Saved “${name}”.` : `Saved “${name}” as a template.` };
}

export async function deleteTemplate(id: string) {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).from("email_templates").delete().eq("id", id);
  if (error) console.error("deleteTemplate failed", error.message);
  revalidatePath("/admin", "layout");
}
