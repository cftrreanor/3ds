"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { QA_COOKIE, QA_DAYS, isQa, reviewerEmail, reviewerFor, signReviewer } from "@/lib/qa";
import { safeNext } from "@/lib/safe-next";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * A reviewer opens the QA site with their passcode: this browser remembers who
 * they are, and signs in to their own QA account (made the first time). That
 * account is a platform admin, so demo mode's "view as" works, and can create
 * its own organization and events.
 */
export async function openQa(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isQa()) return { error: "This isn't the QA site." };
  const name = reviewerFor(String(formData.get("passcode") ?? ""));
  if (!name) return { error: "That passcode didn't match. Check it and try again." };

  (await cookies()).set(QA_COOKIE, signReviewer(name), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: QA_DAYS * 86400,
  });

  const admin = createAdminClient();
  const email = reviewerEmail(name);
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  let id = created.data.user?.id;
  if (!id) {
    // Made on an earlier visit.
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    id = profile?.id;
  }
  if (id) {
    const { error: adminError } = await admin.from("platform_admins").upsert({ user_id: id });
    if (adminError) console.error("Making the QA reviewer an admin failed", adminError);
    // Lets them start their own organization, the way an invited organizer would.
    const { error: inviteError } = await admin.from("host_invitations").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
    if (inviteError) console.error("Inviting the QA reviewer failed", inviteError);

    // Sign this browser in as the reviewer's account (no email is sent).
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (!link.error) {
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "email" });
      if (error) console.error("QA sign-in failed", error);
    } else console.error("QA sign-in link failed", link.error);
  } else console.error("Creating the QA reviewer's account failed", created.error);

  redirect(safeNext(formData.get("next")) ?? "/dashboard");
}
