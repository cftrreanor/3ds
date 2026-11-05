"use server";

import { revalidatePath } from "next/cache";
import { EMAIL_LINK_DAYS, emailLinkCutoff } from "@/lib/email-link-age";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { leftEventEmail, removedEmail } from "@/lib/team-emails";
import { invitationEmail, invitationEmailKey, type InvitationDetails } from "@/lib/invitation-email";
import { loadSystemEmail } from "@/lib/system-email-overrides";
import { hasBands, leadWords } from "@/lib/event-types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { utcToZonedDate } from "@/lib/time";

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

/** Volunteer Setup's Coordinators window: invite someone to lead this one sign-up. */
export async function inviteCoordinator(eventId: string, stationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = inviteSchema.shape.email.safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  return invite(eventId, email.data, "section_lead", stationId);
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
    return { error: "That's your own email. You're already on the team." };
  }

  const supabase = await createClient();
  const asHost = role === "host";
  // A co-host joins the whole account, not one event.
  if (asHost) {
    const { data: event } = await supabase.from("events").select("organization_id").eq("id", eventId).maybeSingle();
    if (!event) return { error: "Event not found." };
    const result = await inviteToAccount(event.organization_id, email);
    revalidatePath(`/dashboard/events/${eventId}`, "layout");
    return result;
  }
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      event_id: eventId,
      email,
      role,
      as_host: false,
      station_id: role === "section_lead" ? stationId : null,
      invited_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `${email} already has an invitation waiting. Use Resend on their invitation.` };
    return { error: friendlyDbError(error) };
  }

  const sent = await sendInvitation(data.id);
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  revalidatePath("/dashboard/team");
  return sent === true
    ? { ok: true, message: `Invitation sent to ${email}.` }
    : { ok: true, message: `Invitation saved, but the email didn't go out. Use Copy link on their invitation and send it to ${email} yourself.` };
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
  const { data: key } = await createAdminClient()
    .from("invitations")
    .select("email_token, events(event_type)")
    .eq("id", invitationId)
    .single();
  if (!key) return false;
  const url = `${await getOrigin()}/invite/${details.token}?k=${key.email_token}`;
  const eventType = (key.events as unknown as { event_type: string } | null)?.event_type;
  const saved = await loadSystemEmail(invitationEmailKey(details));
  const { subject, html, text } = invitationEmail(details, url, hasBands(eventType), leadWords(eventType).one, saved);
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
  if (!data?.length) return { error: "Only the Account Host can remove a co-host." };
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
  // An account (co-host) invitation has no event: go to the dashboard.
  redirect(eventId ? `/dashboard/events/${eventId}` : "/dashboard");
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
    .select("email, expires_at, accepted_at, sent_at")
    .eq("token", token)
    .eq("email_token", key)
    .maybeSingle();
  if (!inv) return { error: "This link has been replaced by a newer email, or the invitation was canceled. Use the newest email, or ask for a new invitation." };
  if (inv.accepted_at) return { error: "This invitation has already been accepted. Sign in to continue." };
  if (new Date(inv.expires_at) < new Date()) return { error: "This invitation has expired. Ask for a new one." };
  // The one-tap sign-in works for a week after the email; after that, sign in normally.
  if (!inv.sent_at || inv.sent_at < emailLinkCutoff()) {
    return { error: `For your security, this email's join button only works for ${EMAIL_LINK_DAYS} days. Sign in with ${inv.email} to accept instead.` };
  }

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
  redirect(eventId ? `/dashboard/events/${eventId}` : "/dashboard");
}

// -----------------------------------------------------------------------------
// My team (/dashboard/team). The database enforces who may do each of these
// (20270113000000_my_team.sql); a refused change comes back as nothing changed.
// -----------------------------------------------------------------------------

const STAFF_ROLES = ["volunteer_director", "section_lead"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];
const UUID = /^[0-9a-f-]{36}$/i;

/** Invite a co-host to the whole account (the Account Host only). */
export async function inviteCoHost(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = inviteSchema.shape.email.safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0].message, fieldErrors: { email: email.error.issues[0].message } };
  return inviteToAccount(orgId, email.data);
}

async function inviteToAccount(orgId: string, email: string): Promise<ActionState> {
  const user = await requireUser();
  if (email === user.email.toLowerCase()) return { error: "That's your own email. You're already on the team." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ organization_id: orgId, event_id: null, email, role: null, as_host: true, invited_by: user.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `${email} already has an invitation waiting. Use Resend on their invitation.` };
    return { error: friendlyDbError(error) };
  }
  const sent = await sendInvitation(data.id);
  revalidatePath("/dashboard", "layout");
  return sent === true
    ? { ok: true, message: `Invitation sent to ${email}.` }
    : { ok: true, message: `Invitation saved, but the email didn't go out. Use Copy link on their invitation and send it to ${email} yourself.` };
}

/**
 * Invite someone back: a co-host to the account, or a Volunteer Lead or Coordinator to the event,
 * role, and (for a Coordinator) job picked in the window. `role` is their last role, used when the
 * window offers no choice.
 */
export async function inviteAgain(orgId: string, email: string, role: "co_host" | StaffRole, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (role === "co_host") return inviteToAccount(orgId, email.toLowerCase());
  const eventId = String(formData.get("eventId") ?? "");
  if (!UUID.test(eventId)) return { error: "Choose the event to invite them to.", fieldErrors: { eventId: "Choose the event to invite them to." } };
  const picked = String(formData.get("role") ?? role);
  const newRole: StaffRole = STAFF_ROLES.includes(picked as StaffRole) ? (picked as StaffRole) : role;
  const job = String(formData.get("stationId") ?? "");
  const result = await invite(eventId, email, newRole, newRole === "section_lead" && UUID.test(job) ? job : null);
  revalidatePath("/dashboard/team");
  return result;
}

export async function resendTeamInvitation(invitationId: string): Promise<ActionState> {
  await requireUser();
  const sent = await sendInvitation(invitationId);
  revalidatePath("/dashboard", "layout");
  if (typeof sent === "string") return { error: sent };
  return sent ? { ok: true, message: "Sent again." } : { error: "The email didn't go out. Use Copy link and send it yourself." };
}

export async function cancelTeamInvitation(invitationId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("invitations").delete().eq("id", invitationId).select("email");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "That invitation was already accepted or cancelled, or isn't yours to cancel." };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Invitation for ${data[0].email} cancelled. Their team spot is free.` };
}

/**
 * Remove a Volunteer Lead or Coordinator from the roles picked in the window ("eventId:role" each).
 * Roles on events that are over are kept: they're the person's history (Past events, Invite again).
 */
export async function removeFromEvents(userId: string, name: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const pairs = formData
    .getAll("pick")
    .map((p) => String(p).split(":"))
    .filter(([eventId, role]) => UUID.test(eventId ?? "") && STAFF_ROLES.includes(role as StaffRole));
  if (!pairs.length) return { error: "Choose what to remove them from." };
  const { data: events } = await supabase
    .from("events")
    .select("id, name, ends_on, timezone, organization_id")
    .in("id", [...new Set(pairs.map(([eventId]) => eventId))]);
  const upcoming = new Set(
    (events ?? []).filter((e) => e.ends_on >= utcToZonedDate(new Date().toISOString(), e.timezone || "America/Chicago")).map((e) => e.id),
  );
  const current = pairs.filter(([eventId]) => upcoming.has(eventId));
  if (!current.length) return { error: `Those events are over, so ${name}'s roles stay in their history.` };
  const { data, error } = await supabase
    .from("event_staff")
    .delete()
    .eq("user_id", userId)
    .or(current.map(([eventId, role]) => `and(event_id.eq.${eventId},role.eq.${role})`).join(","))
    .select("event_id, role");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: `${name} wasn't removed. They may have been removed already, or it isn't yours to do.` };
  const label = { volunteer_director: "Volunteer Lead", section_lead: "Coordinator" } as const;
  // The email names what was actually removed (not what was asked for).
  const roleNames = data.map((d) => `${label[d.role as StaffRole]} of ${(events ?? []).find((e) => e.id === d.event_id)?.name ?? "an event"}`);
  await tellRemoved(formData, userId, (events ?? [])[0]?.organization_id ?? null, roleNames);
  revalidatePath("/dashboard", "layout");
  const removed = new Set(data.map((d) => d.event_id)).size;
  return { ok: true, message: `Removed ${name} from ${removed === 1 ? "1 event" : `${removed} events`}.` };
}

/** Remove a co-host from the account (the Account Host), or stop being one (the co-host). */
export async function removeAccountCoHost(orgId: string, userId: string, name: string, _prev?: ActionState, formData?: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("role", "admin")
    .select("user_id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) {
    revalidatePath("/dashboard", "layout");
    return { error: userId === user.id ? "You're no longer a co-host here. The page has been refreshed." : `${name} isn't a co-host anymore. The page has been refreshed.` };
  }
  if (userId !== user.id && formData) await tellRemoved(formData, userId, orgId, ["co-host"]);
  revalidatePath("/dashboard", "layout");
  // Leaving yourself: the account's events are no longer yours to see.
  if (userId === user.id) redirect("/dashboard");
  return { ok: true, message: `Removed ${name} as co-host.` };
}

/**
 * A Volunteer Lead or Coordinator leaves one event. The Account Host and the event's other
 * Volunteer Leads are emailed, naming the jobs and roles left without anyone.
 */
export async function leaveEvent(eventId: string, role: StaffRole, eventName: string): Promise<ActionState> {
  const user = await requireUser();
  if (!STAFF_ROLES.includes(role)) return { error: "You don't have permission to do that." };
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("ends_on, timezone").eq("id", eventId).maybeSingle();
  if (ev && ev.ends_on < utcToZonedDate(new Date().toISOString(), ev.timezone || "America/Chicago")) {
    return { error: "That event is over, so there's nothing to leave. It stays in your history." };
  }
  // Before leaving: the jobs they lead (leaving takes them off those).
  const [{ data: led }, { data: me }] = await Promise.all([
    supabase.from("station_leads").select("stations(name)").eq("event_id", eventId).eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const { data, error } = await supabase
    .from("event_staff")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .eq("role", role)
    .select("event_id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You've already left that event." };
  const jobs = role === "section_lead" ? ((led ?? []) as unknown as { stations: { name: string } | null }[]).map((l) => l.stations?.name).filter((n): n is string => !!n) : [];
  const told = await tellHostsSomeoneLeft(eventId, user.id, me?.full_name || user.email, role, jobs);
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: told ? `You've left ${eventName}. We've let ${told} know.` : `You've left ${eventName}. Let the Account Host know yourself: our email didn't go out.`,
  };
}

/**
 * Email the event's Account Host and Volunteer Leads that someone left (server side: the leaver
 * can't read them). Returns who was told, in words, or null when no email went out.
 */
async function tellHostsSomeoneLeft(eventId: string, leaverId: string, who: string, role: StaffRole, jobs: string[]): Promise<string | null> {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, name, starts_on, ends_on, organization_id").eq("id", eventId).maybeSingle();
  if (!event) return null;
  const [{ data: owner }, { data: leads }] = await Promise.all([
    admin.from("organization_members").select("profiles(email)").eq("organization_id", event.organization_id).eq("role", "owner").maybeSingle(),
    admin.from("event_staff").select("user_id, profiles(email)").eq("event_id", eventId).eq("role", "volunteer_director"),
  ]);
  const leadRows = (leads ?? []) as unknown as { user_id: string; profiles: { email: string } | null }[];
  const to = new Set(
    [(owner as unknown as { profiles: { email: string } | null } | null)?.profiles?.email, ...leadRows.filter((l) => l.user_id !== leaverId).map((l) => l.profiles?.email)]
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase()),
  );
  const { subject, html, text } = leftEventEmail({
    who,
    role,
    event,
    jobs,
    noLead: role === "volunteer_director" && leadRows.filter((l) => l.user_id !== leaverId).length === 0,
    setupUrl: `${await getOrigin()}/dashboard/events/${eventId}/edit?section=team`,
  });
  const sent = await Promise.all([...to].map((addr) => sendEmail({ to: addr, subject, html, text })));
  if (!sent.some(Boolean)) return null;
  const others = leadRows.filter((l) => l.user_id !== leaverId).length;
  return others ? "the Account Host and the event's Volunteer Lead" + (others > 1 ? "s" : "") : "the Account Host";
}

/** Email someone that they were removed, when the remover ticked "Let them know by email". */
async function tellRemoved(formData: FormData, removedId: string, orgId: string | null, roles: string[]) {
  if (formData.get("notify") !== "on") return;
  const user = await requireUser();
  const admin = createAdminClient();
  const [{ data: person }, { data: me }, { data: org }] = await Promise.all([
    admin.from("profiles").select("email").eq("id", removedId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    orgId ? admin.from("organizations").select("name").eq("id", orgId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!person?.email) return;
  // The roles they keep on this account's events that aren't over, so the email doesn't say they're off the team.
  const today = new Date().toISOString().slice(0, 10);
  const { data: kept } = orgId
    ? await admin
        .from("event_staff")
        .select("role, events!inner(name, organization_id, ends_on)")
        .eq("user_id", removedId)
        .eq("events.organization_id", orgId)
        .gte("events.ends_on", today)
    : { data: [] };
  const label = { volunteer_director: "Volunteer Lead", section_lead: "Coordinator" } as const;
  const keeps = ((kept ?? []) as unknown as { role: StaffRole; events: { name: string } }[]).map((k) => `${label[k.role]} of ${k.events.name}`);
  const { subject, html, text } = removedEmail({
    remover: me?.full_name || user.email,
    organization: org?.name ?? null,
    roles,
    keeps,
    contact: user.email,
  });
  await sendEmail({ to: person.email, subject, html, text, replyTo: user.email });
}
