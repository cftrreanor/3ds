"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getUser, requireUser } from "@/lib/auth";
import { findBandInvite } from "@/lib/band-invites";
import { registrationIsOpen } from "@/lib/bands";
import { groupWords } from "@/lib/event-types";
import { getOrigin } from "@/lib/data";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { customWords, loadSystemEmail } from "@/lib/system-email-overrides";
import { formatDateRange } from "@/lib/time";
import { bandInviteEmail } from "@/lib/band-invite-email";

const emailsSchema = z.array(z.string().trim().toLowerCase().email()).min(1, "Pick at least one director to invite.").max(500);

/**
 * Email directors from the organization's earlier events, or whose details the host imported from
 * a spreadsheet, an invitation to register for this one (or, with `reminder`, a reminder to those
 * invited who haven't registered). Sending again keeps a director's earlier link working: the same
 * link, good for another week. Only a link that was already used is replaced.
 */
export async function sendBandInvites(eventId: string, emails: string[], reminder = false): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailsSchema.safeParse(emails);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const [{ data: event }, { data: past }, { data: prefills }, { data: existing }] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, status, event_type, timezone, starts_on, ends_on, venue_name, band_registration_open, band_registration_deadline, band_registration_opens_on")
      .eq("id", eventId)
      .maybeSingle(),
    // Only hosts get rows back: directors from their own earlier events, and
    // directors whose details they imported from a spreadsheet.
    supabase.rpc("past_band_directors", { p_event: eventId }),
    supabase.from("band_prefills").select("email, head_director_name").eq("event_id", eventId),
    supabase.from("band_invitations").select("email, used_at").eq("event_id", eventId),
  ]);
  if (!event || (!past?.length && !prefills?.length)) return { error: "Only the event's hosts can send invitations." };
  const w = groupWords(event.event_type);
  if (!registrationIsOpen(event)) return { error: `Open ${w.one} registration first, so invited directors can register.` };

  const filledIn = new Set((prefills ?? []).map((p) => p.email.toLowerCase()));
  const allowed = new Map<string, { full_name: string | null; registered?: boolean }>([
    ...(prefills ?? []).map((p) => [p.email.toLowerCase(), { full_name: p.head_director_name }] as const),
    ...((past ?? []) as { email: string; full_name: string; registered: boolean }[]).map((p) => [p.email.toLowerCase(), p] as const),
  ]);
  const before = new Map(((existing ?? []) as { email: string; used_at: string | null }[]).map((i) => [i.email.toLowerCase(), i]));
  // A reminder goes only to directors already invited who haven't registered.
  const to = [...new Set(parsed.data)].filter((e) => allowed.has(e) && !allowed.get(e)?.registered && (!reminder || before.has(e)));
  if (to.length === 0) return { error: reminder ? "Everyone invited has registered." : "Pick at least one director to invite." };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  // New invitations get a link; an earlier, unused link is kept (and works for another week).
  const fresh = to.filter((e) => !before.has(e) || before.get(e)!.used_at);
  const kept = to.filter((e) => before.has(e) && !before.get(e)!.used_at);
  const { error } = await admin.from("band_invitations").upsert(
    fresh.map((email) => ({ event_id: eventId, email, token: crypto.randomUUID(), invited_by: user.id, sent_at: now, used_at: null, failed_at: null })),
    { onConflict: "event_id,email" },
  );
  const keptUpdate = kept.length
    ? await admin.from("band_invitations").update({ sent_at: now, failed_at: null }).eq("event_id", eventId).in("email", kept)
    : { error: null };
  // The database holds back invitations from a "try it" event (its type isn't in the plan).
  if (error?.code === "42501") return { error: `Your plan doesn't include this kind of event, so it can't send invitations. You can keep setting it up and previewing it.` };
  if (error || keptUpdate.error) {
    console.error("Saving band invitations failed", error ?? keptUpdate.error);
    return { error: "We couldn't send the invitations. Check your connection, then try again." };
  }
  const { data: rows } = await admin.from("band_invitations").select("email, token").eq("event_id", eventId).in("email", to);

  const origin = await getOrigin();
  const { data: host } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  after(async () => {
    const saved = reminder ? null : await loadSystemEmail("director_invite");
    for (const row of (rows ?? []) as { email: string; token: string }[]) {
      const name = allowed.get(row.email)?.full_name;
      const custom = customWords("director_invite", saved, {
        first_name: name ? name.split(" ")[0] : "",
        host: host?.full_name ?? "The host",
        group: w.one,
        event_name: event.name,
        event_dates: formatDateRange(event.starts_on, event.ends_on),
        at_venue: event.venue_name ? `at ${event.venue_name}` : "",
      });
      const words = bandInviteEmail({
        firstName: name ? name.split(" ")[0] : null,
        host: host?.full_name ?? "The host",
        one: w.one,
        event,
        fromSpreadsheet: filledIn.has(row.email),
        reminder,
        email: row.email,
        custom,
      });
      const { html, text } = emailLayout({
        heading: words.heading,
        paragraphs: words.paragraphs,
        button: { label: words.button, url: `${origin}/e/${event.slug}/bands/invite/${row.token}` },
        footer: words.footer,
      });
      const sent = await sendEmail({ to: row.email, subject: words.subject, html, text, eventId });
      // Shown on the list as "Couldn't send", so the host can check the address.
      if (!sent) await admin.from("band_invitations").update({ failed_at: new Date().toISOString() }).eq("event_id", eventId).eq("email", row.email);
      await pause();
    }
  });

  revalidatePath(`/dashboard/events/${eventId}/bands`);
  const n = to.length;
  return {
    ok: true,
    message: reminder
      ? `Sending ${n} ${n === 1 ? "reminder" : "reminders"} now.`
      : `Sending ${n} ${n === 1 ? "invitation" : "invitations"} now. Each director shows as Invited below; one that can't be delivered says so.`,
  };
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
