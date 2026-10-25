"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorState, friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, emailLogoUrl, sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-format";
import { invitePackageLabel, inviteStatusLabel, isInvitePackage, isInviteStatus } from "@/lib/invitation-plan";
import { fillTemplate, firstName, siteLinks } from "@/lib/merge-fields";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { myName } from "../data";

/**
 * The "Invite a host" panel: who they are, the package and free period they'll
 * start on, and the welcome email. admin_send_host_invitation() saves them on a
 * pilot request card (the one the panel was opened from, their open card, or a
 * new one under Invited) and invites them; then the welcome email goes out.
 * "Save without sending" (an invitation already waiting) skips the email.
 * Platform admins only (the database checks too).
 */
export async function sendHostInvitation(pilotRequestId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const email = get("email").toLowerCase();
  const name = get("name");
  const organization = get("organization");
  const phoneInput = get("phone");
  const pkg = get("package");
  const status = get("status");
  const freeUntil = get("freeUntil");
  const templateId = get("template");
  const sendNow = formData.get("intent") !== "save";

  const fieldErrors: Record<string, string> = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "Enter their email address.";
  if (name.length < 2) fieldErrors.name = "Enter the host's name.";
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && !phone) fieldErrors.phone = "Enter a 10-digit phone number, or leave it blank.";
  if (!isInvitePackage(pkg)) fieldErrors.package = "Pick a package.";
  if (!isInviteStatus(status)) fieldErrors.status = "Pick a free pilot or a trial.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(freeUntil)) fieldErrors.freeUntil = "Pick the last day of the free period.";
  if (Object.keys(fieldErrors).length) return fieldErrorState(fieldErrors);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_send_host_invitation", {
    p_email: email,
    p_name: name,
    p_organization: organization || null,
    p_phone: phone,
    p_package: pkg,
    p_plan_status: status,
    p_free_until: freeUntil,
    p_request: pilotRequestId,
  });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : friendlyDbError(error) };
  revalidatePath("/admin", "layout");

  const plan = `${invitePackageLabel(pkg)}, ${inviteStatusLabel(status).toLowerCase()} through ${formatDate(freeUntil, { weekday: undefined })}`;
  if (!sendNow) return { ok: true, message: `Saved: ${plan}. No email was sent.` };

  const origin = await getOrigin();
  let message: { subject: string; html: string; text: string; body?: string };
  if (templateId) {
    const { data: template } = await createAdminClient().from("email_templates").select("subject, body").eq("id", templateId).maybeSingle();
    if (!template) return { error: "That email template wasn't found. They're invited, but no email was sent. Pick another template and send again." };
    const vars = {
      name,
      first_name: firstName(name),
      organization,
      plan: `${invitePackageLabel(pkg)} (${inviteStatusLabel(status).toLowerCase()})`,
      free_until: formatDate(freeUntil, { weekday: undefined }),
      my_name: await myName(user.id),
      ...siteLinks(origin, email),
    };
    const body = fillTemplate(template.body, vars).text;
    message = { subject: fillTemplate(template.subject, vars).text, body, ...renderEmail(body, { logoUrl: emailLogoUrl(origin) }) };
  } else {
    const url = `${origin}/login?${new URLSearchParams({ next: "/dashboard", email })}`;
    message = {
      subject: `Your ${brand.name} host invitation`,
      ...emailLayout({
        heading: `You're invited to host on ${brand.name}`,
        paragraphs: [
          `Hi ${firstName(name)}. Your pilot spot is ready. Sign in with this email address (${email}) to set up your organization and create your first event.`,
          "There's no password to remember: we'll email you a sign-in link. The invitation works for 30 days.",
        ],
        button: { label: "Set up my organization", url },
        footer: `Questions? Reply to this email or write to ${brand.supportEmail}.`,
      }),
    };
  }
  const sent = await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: brand.supportEmail,
    author: message.body ? { userId: user.id, body: message.body } : undefined,
  });
  return {
    ok: true,
    message: sent
      ? `Invited ${email} on ${plan}. They'll get the email now.`
      : `Invited ${email} on ${plan}, but the email couldn't be sent. Tell them to sign in with that address.`,
  };
}
