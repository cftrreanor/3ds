"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { invitationEmail, type InvitationDetails } from "@/lib/invitation-email";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  role: z.enum(["volunteer_director", "section_lead", "host"]),
  stationId: z.string().uuid().or(z.literal("")).optional(),
});

export async function inviteMember(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return invite(eventId, parsed.data.email, parsed.data.role, parsed.data.stationId || null);
}

/** Invite someone back to the role they were removed from. */
export async function reinviteMember(eventId: string, removalId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: removal } = await supabase.from("team_removals").select("email, role").eq("id", removalId).maybeSingle();
  if (!removal) return { error: "You don't have permission to do that." };
  return invite(eventId, removal.email, removal.role === "co_host" ? "host" : removal.role, null);
}

async function invite(
  eventId: string,
  email: string,
  role: "volunteer_director" | "section_lead" | "host",
  stationId: string | null,
): Promise<ActionState> {
  const user = await requireUser();
  email = email.trim().toLowerCase();
  if (email === user.email.toLowerCase()) {
    return { error: "That's your own email. As the host you already have full access." };
  }

  const supabase = await createClient();
  const asHost = role === "host";
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      event_id: eventId,
      email,
      role: asHost ? null : role,
      as_host: asHost,
      station_id: role === "section_lead" ? stationId : null,
      invited_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `${email} already has an invitation waiting. Use Resend under Pending.` };
    return { error: friendlyDbError(error) };
  }

  const sent = await sendInvitation(data.id);
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return sent === true
    ? { ok: true, message: `Invitation sent to ${email}.` }
    : { ok: true, message: `Invitation saved, but the email didn't go out. Copy the link under Pending and send it to ${email} yourself.` };
}

export async function resendInvitation(eventId: string, invitationId: string): Promise<ActionState> {
  await requireUser();
  const sent = await sendInvitation(invitationId);
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  if (typeof sent === "string") return { error: sent };
  return sent ? { ok: true, message: "Sent again." } : { error: "The email didn't go out. Copy the link and send it yourself." };
}

/** Emails an invitation with its one-tap link. Returns false if the email failed, or an error message. */
async function sendInvitation(invitationId: string): Promise<boolean | string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_invitation_email", { p_id: invitationId }).single();
  if (error) return friendlyDbError(error);
  const details = data as InvitationDetails;
  // The secret key is only readable with the server's private key.
  const { data: key } = await createAdminClient().from("invitations").select("email_token").eq("id", invitationId).single();
  if (!key) return false;
  const url = `${await getOrigin()}/invite/${details.token}?k=${key.email_token}`;
  const { subject, html, text } = invitationEmail(details, url);
  return sendEmail({ to: details.email, subject, html, text });
}

export async function cancelInvitation(eventId: string, invitationId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

export async function removeMember(eventId: string, userId: string, role: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_staff")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", role);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

/** Removes a co-host from the event's organization (the owner can't be removed). */
export async function removeCoHost(eventId: string, userId: string): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("organization_id").eq("id", eventId).maybeSingle();
  if (!event) return { error: "Event not found." };
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", event.organization_id)
    .eq("user_id", userId)
    .eq("role", "admin")
    .select("user_id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only a host can remove a co-host." };
  revalidatePath("/dashboard", "layout");
  // Leaving yourself: this event is no longer yours to see.
  if (userId === user.id) redirect("/dashboard");
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: eventId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${eventId}`);
}

const joinSchema = z.object({ fullName: z.string().trim().max(200).optional() });

/**
 * One tap from the invitation email. The secret key in the link proves they
 * own the invited email (it's only ever sent there), so we sign them in as
 * that email (creating the account if needed) and accept the invitation.
 */
export async function joinFromEmail(token: string, key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = joinSchema.safeParse({ fullName: formData.get("fullName") ?? undefined });
  if (!parsed.success) return { error: "Please enter your name." };
  const fullName = parsed.data.fullName ?? "";
  if (formData.has("fullName") && fullName.length < 2) return { error: "Please enter your first and last name." };
  if (!/^[0-9a-f-]{36}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(key)) return { error: "This link isn't valid." };

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("email, expires_at, accepted_at")
    .eq("token", token)
    .eq("email_token", key)
    .maybeSingle();
  if (!inv) return { error: "This link has been replaced by a newer email, or the invitation was cancelled. Use the newest email, or ask for a new invitation." };
  if (inv.accepted_at) return { error: "This invitation has already been accepted. Sign in to continue." };
  if (new Date(inv.expires_at) < new Date()) return { error: "This invitation has expired. Ask for a new one." };

  // Sign in as the invited email: an existing account, or a new one.
  let link = await admin.auth.admin.generateLink({ type: "magiclink", email: inv.email });
  let type: "email" | "invite" = "email";
  if (link.error) {
    link = await admin.auth.admin.generateLink({ type: "invite", email: inv.email, options: { data: { full_name: fullName } } });
    type = "invite";
  }
  if (link.error) {
    console.error("Invitation sign-in link failed", link.error);
    return { error: "We couldn't sign you in. Please try again." };
  }
  const supabase = await createClient();
  const { data: session, error: signInError } = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type });
  if (signInError || !session.user) {
    console.error("Invitation sign-in failed", signInError);
    return { error: "We couldn't sign you in. Please try again." };
  }
  if (fullName) {
    await admin.from("profiles").update({ full_name: fullName }).eq("id", session.user.id).eq("full_name", "");
  }

  const { data: eventId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/events/${eventId}`);
}
