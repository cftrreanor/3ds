"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { EMAIL_LINK_DAYS, emailLinkCutoff } from "@/lib/email-link-age";
import { welcomeNext } from "@/lib/host-invite-link";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * The "Set up my account" button in a host invitation email: the secret key
 * proves they own the invited email, so one tap signs them in (no second
 * sign-in email) and takes them to account setup.
 */
export async function signInFromHostInvite(id: string, key: string, next: string): Promise<ActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(key)) return { error: "This link isn't valid." };
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("host_invitations")
    .select("email, expires_at, used_at, sent_at")
    .eq("id", id)
    .eq("email_token", key)
    .maybeSingle();
  if (!inv) return { error: "This link has been replaced by a newer email. Use the newest one, or sign in with your email address." };
  if (inv.used_at) return { error: "Your account is already set up. Sign in to continue." };
  if (new Date(inv.expires_at) < new Date()) return { error: "This invitation has expired. Reply to the invitation email for a new one." };
  if (!inv.sent_at || inv.sent_at < emailLinkCutoff()) {
    return { error: `For your security, this button only works for ${EMAIL_LINK_DAYS} days. Sign in with ${inv.email} instead.` };
  }

  // Sign in as the invited email: an existing account, or a new one.
  let link = await admin.auth.admin.generateLink({ type: "magiclink", email: inv.email });
  let type: "email" | "invite" = "email";
  if (link.error) {
    link = await admin.auth.admin.generateLink({ type: "invite", email: inv.email });
    type = "invite";
  }
  if (link.error) {
    console.error("Host invitation sign-in link failed", link.error);
    return { error: "We couldn't sign you in. Please try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type });
  if (error) {
    console.error("Host invitation sign-in failed", error);
    return { error: "We couldn't sign you in. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  redirect(welcomeNext(next));
}
