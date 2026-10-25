"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { checkSystemText, sampleVars, systemEmail, systemEmailWords, type SystemEmailText } from "@/lib/system-emails";
import { createClient } from "@/lib/supabase/server";

/**
 * The system email editor's form: "Save" (admin_save_system_email, which
 * checks the admin and logs the change) or "Send me a test" (the words as
 * they are in the editor, with sample details, to the admin's own address).
 */
export async function saveSystemEmail(key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  const email = systemEmail(key);
  if (!email) return { error: "That email wasn't found." };
  const get = (k: string) => String(formData.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  const t: SystemEmailText = { subject: get("subject"), heading: get("heading"), body: get("body"), button_label: get("button") || null };
  const problem = checkSystemText(email, t);
  if (problem) return { error: problem };

  if (formData.get("intent") === "test") {
    if (!user.email) return { error: "Your account has no email address to send the test to." };
    const words = systemEmailWords(email, t, sampleVars(email, brand.name));
    const { html, text } = emailLayout({
      heading: words.heading,
      paragraphs: [...words.paragraphs, ...email.locked],
      button: words.button || email.starting.button_label ? { label: words.button || email.starting.button_label!, url: await getOrigin() } : undefined,
      footer: `A test of the “${email.name}” email, filled in with sample details. The real one has the right links, times, and footer.`,
    });
    const ok = await sendEmail({ to: user.email, subject: `[Test] ${words.subject}`, html, text });
    return ok ? { ok: true, message: `Sent a test to ${user.email}. It isn't saved yet.` } : { error: "The test couldn't be sent. Try again in a minute." };
  }

  const { error } = await (await createClient()).rpc("admin_save_system_email", {
    p_key: key,
    p_subject: t.subject,
    p_heading: t.heading,
    p_body: t.body,
    p_button_label: t.button_label,
  });
  if (error) return { error: error.code === "42501" ? error.message : friendlyDbError(error) };
  revalidatePath("/admin/emails", "layout");
  return { ok: true, message: `Saved. The next “${email.name}” email uses this wording.` };
}

/** Back to the built-in wording. */
export async function resetSystemEmail(key: string) {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).rpc("admin_reset_system_email", { p_key: key });
  if (error) console.error("resetSystemEmail failed", error.message);
  revalidatePath("/admin/emails", "layout");
}
