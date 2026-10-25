"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { invitePackageLabel, inviteStatusLabel, isInvitePackage, isInviteStatus } from "@/lib/invitation-plan";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";

/**
 * Invite someone to host: they can then sign in with this email and set up
 * their organization (nobody else can). From a pilot request, or any email.
 * Platform admins only (admin_invite_host() checks).
 */
export async function inviteHost(pilotRequestId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  // The package and pilot length they'll start on, from a pilot request's Host invitation box.
  // Email-only invites send none, and inviting again keeps any earlier choices.
  let plan: { p_package: string; p_plan_status: string; p_free_until: string } | null = null;
  if (formData.has("package")) {
    const pkg = String(formData.get("package") ?? "");
    const status = String(formData.get("status") ?? "");
    const freeUntil = String(formData.get("freeUntil") ?? "");
    if (!isInvitePackage(pkg)) return { error: "Pick a package." };
    if (!isInviteStatus(status)) return { error: "Pick a free pilot or a trial." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(freeUntil)) return { error: "Pick the last day of the free period." };
    plan = { p_package: pkg, p_plan_status: status, p_free_until: freeUntil };
  }
  const supabase = await createClient();
  if (plan && formData.get("intent") === "save") {
    const { error } = await supabase.rpc("admin_set_invitation_plan", { p_email: email, ...plan });
    if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : friendlyDbError(error) };
    revalidatePath("/admin", "layout");
    return { ok: true, message: `Saved: ${invitePackageLabel(plan.p_package)}, ${inviteStatusLabel(plan.p_plan_status).toLowerCase()} through ${formatDate(plan.p_free_until)}.` };
  }
  const { error } = await supabase.rpc("admin_invite_host", { p_email: email, p_pilot_request: pilotRequestId, ...(plan ?? {}) });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : friendlyDbError(error) };

  const url = `${await getOrigin()}/login?${new URLSearchParams({ next: "/dashboard", email })}`;
  const { html, text } = emailLayout({
    heading: `You're invited to host on ${brand.name}`,
    paragraphs: [
      `${name ? `Hi ${name.split(" ")[0]}. ` : ""}Your pilot spot is ready. Sign in with this email address (${email}) to set up your organization and create your first event.`,
      "There's no password to remember: we'll email you a sign-in link. The invitation works for 30 days.",
    ],
    button: { label: "Set up my organization", url },
    footer: `Questions? Reply to this email or write to ${brand.supportEmail}.`,
  });
  const sent = await sendEmail({ to: email, subject: `Your ${brand.name} host invitation`, html, text });
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `${sent ? `Invited ${email}. They'll get an email now.` : `Invited ${email}, but the email couldn't be sent. Tell them to sign in with that address.`}${
      plan ? ` They'll start on ${invitePackageLabel(plan.p_package)}, ${inviteStatusLabel(plan.p_plan_status).toLowerCase()} through ${formatDate(plan.p_free_until)}.` : ""
    }`,
  };
}
