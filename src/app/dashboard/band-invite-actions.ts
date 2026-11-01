"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getUser, requireUser } from "@/lib/auth";
import { findBandInvite } from "@/lib/band-invites";
import { opensLater, registrationIsOpen } from "@/lib/bands";
import { deliverBandInvites } from "@/lib/band-invite-send";
import { groupWords } from "@/lib/event-types";
import { getOrigin } from "@/lib/data";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";

const emailsSchema = z.array(z.string().trim().toLowerCase().email()).min(1, "Pick at least one director to invite.").max(500);

/**
 * Email directors from the organization's earlier events, or whose details the host imported from
 * a spreadsheet, an invitation to register for this one (or, with `reminder`, a reminder to those
 * invited who haven't registered). Before registration's opening day, invitations wait and the
 * daily job sends them that morning. Sending again keeps a director's earlier link working (the
 * same link, good for another week); only a link that was already used is replaced. Directors who
 * have registered are never emailed, whatever the page sent.
 */
export async function sendBandInvites(eventId: string, emails: string[], reminder = false): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailsSchema.safeParse(emails);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const [{ data: event }, { data: past }, { data: prefills }, { data: existing }, { data: bands }] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, status, event_type, timezone, starts_on, ends_on, venue_name, band_registration_open, band_registration_deadline, band_registration_opens_on")
      .eq("id", eventId)
      .maybeSingle(),
    // Only hosts get rows back: directors from their own earlier events, and
    // directors whose details they imported from a spreadsheet.
    supabase.rpc("past_band_directors", { p_event: eventId }),
    supabase.from("band_prefills").select("email, head_director_name").eq("event_id", eventId),
    supabase.from("band_invitations").select("email, used_at, sent_at, replaced_by").eq("event_id", eventId),
    supabase.from("bands").select("head_director_email").eq("event_id", eventId),
  ]);
  if (!event || (!past?.length && !prefills?.length)) return { error: "Only the event's hosts can send invitations." };
  const w = groupWords(event.event_type);
  // Before the opening day, they wait for it; otherwise registration has to be open.
  const waitFor = event.status === "published" && event.band_registration_open && opensLater(event) ? event.band_registration_opens_on : null;
  if (!waitFor && !registrationIsOpen(event)) return { error: `Open ${w.one} registration first, so invited directors can register.` };
  if (waitFor && reminder) return { error: "Reminders can go out once registration opens." };

  const registered = new Set([
    ...((bands ?? []) as { head_director_email: string }[]).map((b) => b.head_director_email.toLowerCase()),
    ...((past ?? []) as { email: string; registered: boolean }[]).filter((p) => p.registered).map((p) => p.email.toLowerCase()),
  ]);
  const allowed = new Set([
    ...(prefills ?? []).map((p) => p.email.toLowerCase()),
    ...((past ?? []) as { email: string }[]).map((p) => p.email.toLowerCase()),
  ]);
  const before = new Map(
    ((existing ?? []) as { email: string; used_at: string | null; sent_at: string | null; replaced_by: string | null }[]).map((i) => [i.email.toLowerCase(), i]),
  );
  // A reminder goes only to directors already emailed; moved addresses are never emailed again.
  const to = [...new Set(parsed.data)].filter(
    (e) => allowed.has(e) && !registered.has(e) && !before.get(e)?.replaced_by && (!reminder || before.get(e)?.sent_at),
  );
  if (to.length === 0) return { error: reminder ? "Everyone invited has registered." : "Pick at least one director to invite." };

  const admin = createAdminClient();
  // New invitations get a link; an earlier, unused link is kept (and works for another week).
  const fresh = to.filter((e) => !before.has(e) || before.get(e)!.used_at);
  const kept = to.filter((e) => before.has(e) && !before.get(e)!.used_at);
  const { error } = await admin.from("band_invitations").upsert(
    fresh.map((email) => ({
      event_id: eventId,
      email,
      token: crypto.randomUUID(),
      invited_by: user.id,
      sent_at: null,
      scheduled_for: waitFor,
      used_at: null,
      failed_at: null,
      failed_reason: null,
    })),
    { onConflict: "event_id,email" },
  );
  const keptUpdate = kept.length
    ? await admin
        .from("band_invitations")
        // Waiting for the opening day: not sent yet, whatever went before (the daily job sends rows with no sent_at).
        .update(waitFor ? { scheduled_for: waitFor, sent_at: null, failed_at: null, failed_reason: null } : { scheduled_for: null, failed_at: null, failed_reason: null })
        .eq("event_id", eventId)
        .in("email", kept)
    : { error: null };
  // The database holds back invitations from a "try it" event (its type isn't in the plan).
  if (error?.code === "42501") return { error: `Your plan doesn't include this kind of event, so it can't send invitations. You can keep setting it up and previewing it.` };
  if (error || keptUpdate.error) {
    console.error("Saving band invitations failed", error ?? keptUpdate.error);
    return { error: "We couldn't save the invitations. Check your connection, then try again." };
  }
  revalidatePath(`/dashboard/events/${eventId}/bands`);
  const n = to.length;
  if (waitFor) {
    return {
      ok: true,
      message: `${n} ${n === 1 ? "invitation is" : "invitations are"} set to go out on ${formatDate(waitFor)}, when registration opens.`,
    };
  }

  const origin = await getOrigin();
  const { data: host } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const stopAt = Date.now() + 270_000;
  after(() => deliverBandInvites({ event, emails: to, reminder, host: host?.full_name ?? "The organizer", origin, stopAt }).then(() => undefined));
  return {
    ok: true,
    message: reminder
      ? `Sending ${n} ${n === 1 ? "reminder" : "reminders"} now.`
      : `Sending ${n} ${n === 1 ? "invitation" : "invitations"} now. Each one shows as Invited below once it's sent, or says if it couldn't be sent.`,
  };
}

/**
 * An invitation that couldn't be sent, moved to a corrected address: the director's band details
 * are saved under the new address (from the spreadsheet row, or their last contest), the old
 * address is marked as moved, and the new one is invited (now, or on the opening day).
 */
export async function fixInviteAddress(eventId: string, oldEmail: string, newEmail: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ from: z.string().trim().toLowerCase().email(), to: z.string().trim().toLowerCase().email("Enter a full email address.") }).safeParse({ from: oldEmail, to: newEmail });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { from, to } = parsed.data;
  if (from === to) return { error: "That's the same address. Type the corrected one." };
  const supabase = await createClient();
  const [{ data: prefill }, { data: past }] = await Promise.all([
    supabase.from("band_prefills").select("*").eq("event_id", eventId).eq("email", from),
    supabase.rpc("past_band_directors", { p_event: eventId }),
  ]);
  const pastRow = ((past ?? []) as { email: string; full_name: string; bands: string[] }[]).find((d) => d.email.toLowerCase() === from);
  if (!prefill?.length && !pastRow) return { error: "Only the event's hosts can change this." };
  // Only when an invitation can go out (now, or on the opening day): otherwise nothing changes.
  const { data: event } = await supabase
    .from("events")
    .select("status, timezone, band_registration_open, band_registration_deadline, band_registration_opens_on")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || (!registrationIsOpen(event) && !(event.status === "published" && event.band_registration_open && opensLater(event))))
    return { error: "Registration is closed. Reopen it to send invitations." };
  // Saved under the new address; the host's own update rights decide (band_prefills RLS).
  const rows = prefill?.length
    ? prefill.map((p) => {
        const row: Record<string, unknown> = { ...p, email: to, created_by: user.id };
        delete row.id;
        delete row.created_at;
        return row;
      })
    : pastRow!.bands.map((b) => {
        const m = b.match(/^(.*) \((.*)\)$/);
        return { event_id: eventId, email: to, band_name: m ? m[1] : b, school_name: m ? m[2] : null, head_director_name: pastRow!.full_name, created_by: user.id };
      });
  const { error } = await supabase.from("band_prefills").upsert(rows, { onConflict: "event_id,email,band_name" });
  if (error) return { error: "We couldn't save the new address. Check your connection, then try again." };
  const sent = await sendBandInvites(eventId, [to]);
  if (sent.error) return sent;
  // Marked as moved only once the new address's invitation is on its way (or scheduled).
  await createAdminClient().from("band_invitations").update({ replaced_by: to }).eq("event_id", eventId).eq("email", from);
  return { ok: true, message: `Moved to ${to}. ${sent.message ?? ""}`.trim() };
}

/** A scheduled invitation the host no longer wants: removed before it goes out. */
export async function cancelScheduledInvite(eventId: string, email: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  // Hosts can read their event's invitations (RLS): that's the check that this is theirs.
  const { data: mine } = await supabase.from("band_invitations").select("email").eq("event_id", eventId).eq("email", email.toLowerCase()).is("sent_at", null);
  if (!mine?.length) return { error: "That invitation has already gone out, or isn't yours to change." };
  await createAdminClient().from("band_invitations").delete().eq("event_id", eventId).eq("email", email.toLowerCase()).is("sent_at", null);
  revalidatePath(`/dashboard/events/${eventId}/bands`);
  return { ok: true, message: "It won't be sent." };
}

/** The invitation's button: sign in as the invited director, then on to registration. */
export async function acceptBandInvite(token: string): Promise<ActionState> {
  const invite = await findBandInvite(token);
  if (!invite?.event) return { error: "This invitation link isn't valid." };
  const next = `/e/${invite.event.slug}/bands`;
  const current = await getUser();
  if (current?.email.toLowerCase() === invite.email.toLowerCase()) redirect(next);
  if (!invite.usable) redirect(`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`);

  const admin = createAdminClient();
  // One use: claim the link before signing in (two taps can't both get through).
  const { data: claimed } = await admin
    .from("band_invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .select("id");
  if (!claimed?.length) redirect(`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`);

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: invite.email });
  if (link.error) {
    console.error("Band invitation sign-in link failed", link.error);
    redirect(`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`);
  }
  const supabase = await createClient();
  if (current) await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "email" });
  if (error) {
    console.error("Band invitation sign-in failed", error);
    redirect(`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`);
  }
  revalidatePath("/", "layout");
  redirect(next);
}
