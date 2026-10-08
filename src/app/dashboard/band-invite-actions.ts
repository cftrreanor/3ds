"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getUser, requireUser } from "@/lib/auth";
import { findBandInvite } from "@/lib/band-invites";
import { registrationIsOpen } from "@/lib/bands";
import { getOrigin } from "@/lib/data";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange } from "@/lib/time";

const emailsSchema = z.array(z.string().trim().toLowerCase().email()).min(1, "Pick at least one director to invite.").max(500);

/**
 * Email directors from the organization's earlier events an invitation to
 * register for this one. Each gets a fresh one-time sign-in link.
 */
export async function sendBandInvites(eventId: string, emails: string[]): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailsSchema.safeParse(emails);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const [{ data: event }, { data: past }] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, status, timezone, starts_on, ends_on, venue_name, band_registration_open, band_registration_deadline")
      .eq("id", eventId)
      .maybeSingle(),
    // Only hosts get rows back, and only directors from their own earlier events.
    supabase.rpc("past_band_directors", { p_event: eventId }),
  ]);
  if (!event || !past?.length) return { error: "Only the event's hosts can send invitations." };
  if (!registrationIsOpen(event)) return { error: "Open band registration first, so invited directors can register." };

  const allowed = new Map((past as { email: string; full_name: string }[]).map((p) => [p.email.toLowerCase(), p]));
  const to = [...new Set(parsed.data)].filter((e) => allowed.has(e));
  if (to.length === 0) return { error: "Pick at least one director to invite." };

  // A fresh link each time: resending replaces an older (or used) one.
  const rows = to.map((email) => ({
    event_id: eventId,
    email,
    token: crypto.randomUUID(),
    invited_by: user.id,
    sent_at: new Date().toISOString(),
    used_at: null,
  }));
  const admin = createAdminClient();
  const { error } = await admin.from("band_invitations").upsert(rows, { onConflict: "event_id,email" });
  if (error) {
    console.error("Saving band invitations failed", error);
    return { error: "We couldn't send the invitations. Please try again." };
  }

  const origin = await getOrigin();
  const { data: host } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  after(async () => {
    for (const row of rows) {
      const name = allowed.get(row.email)?.full_name;
      const { html, text } = emailLayout({
        heading: `You're invited: ${event.name}`,
        paragraphs: [
          `${name ? `Hi ${name.split(" ")[0]}! ` : ""}${host?.full_name ?? "The host"} would love to have your band at ${event.name}, ${formatDateRange(event.starts_on, event.ends_on)}${event.venue_name ? ` at ${event.venue_name}` : ""}.`,
          "Your band's details from last time are saved. Check them and register in one tap, or change anything first.",
          ...(event.band_registration_deadline ? [`Registration closes at the end of ${formatDate(event.band_registration_deadline)}.`] : []),
        ],
        button: { label: "Review and register", url: `${origin}/e/${event.slug}/bands/invite/${row.token}` },
        footer: `This button signs you in as ${row.email} while registration is open, so please don't forward this email.`,
      });
      await sendEmail({ to: row.email, subject: `You're invited: ${event.name}`, html, text });
      await pause();
    }
  });

  revalidatePath(`/dashboard/events/${eventId}/bands`);
  return { ok: true, message: `Sending ${to.length} invitation${to.length === 1 ? "" : "s"} now.` };
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
  // Note when it was last used (it keeps working while registration is open).
  await admin.from("band_invitations").update({ used_at: new Date().toISOString() }).eq("token", token);

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
