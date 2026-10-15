import "server-only";
import { brand } from "@/lib/brand";
import { pause, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Who hears about new pilot requests and teacher sign-ups: the support inbox
 * and every platform admin's sign-in email.
 */
async function adminEmails() {
  const to = new Set([brand.supportEmail.toLowerCase()]);
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin.from("platform_admins").select("user_id");
    const ids = (admins ?? []).map((a) => a.user_id as string);
    if (ids.length) {
      const { data: people } = await admin.from("profiles").select("email").in("id", ids);
      for (const p of people ?? []) if (p.email) to.add(String(p.email).toLowerCase());
    }
  } catch (err) {
    // The support inbox still hears about it.
    console.error("Looking up admin emails failed", err);
  }
  return [...to];
}

/** Emails the team about something new (one email each). Never throws. */
export async function notifyAdmins(message: { subject: string; html: string; text: string; replyTo?: string }) {
  for (const [i, to] of (await adminEmails()).entries()) {
    if (i) await pause();
    await sendEmail({ to, ...message });
  }
}
