"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

/**
 * Invite someone to host: they can then sign in with this email and set up
 * their organization (nobody else can). From a pilot request, or any email.
 * Platform admins only (admin_invite_host() checks).
 */
export async function inviteHost(pilotRequestId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_invite_host", { p_email: email, p_pilot_request: pilotRequestId });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : friendlyDbError(error) };

  const url = `${await getOrigin()}/login?${new URLSearchParams({ next: "/dashboard", email })}`;
  const { html, text } = emailLayout({
    heading: `You're invited to host on ${brand.name}`,
    paragraphs: [
      `${name ? `Hi ${name.split(" ")[0]}! ` : ""}Your pilot spot is ready. Sign in with this email address (${email}) to set up your organization and create your first event.`,
      "There's no password to remember: we'll email you a sign-in link. The invitation works for 30 days.",
    ],
    button: { label: "Set up my organization", url },
    footer: `Questions? Reply to this email or write to ${brand.supportEmail}.`,
  });
  const sent = await sendEmail({ to: email, subject: `Your ${brand.name} host invitation`, html, text });
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: sent ? `Invited ${email}. They'll get an email now.` : `Invited ${email}, but the email couldn't be sent. Tell them to sign in with that address.`,
  };
}
