import "server-only";
import { bandInviteEmail } from "@/lib/band-invite-email";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { groupWords } from "@/lib/event-types";
import { createAdminClient } from "@/lib/supabase/server";
import { customWords, loadSystemEmail } from "@/lib/system-email-overrides";
import { formatDateRange } from "@/lib/time";

export type InviteEvent = {
  id: string;
  slug: string;
  name: string;
  event_type: string;
  starts_on: string;
  ends_on: string;
  venue_name: string | null;
  band_registration_deadline: string | null;
};

/**
 * Emails band invitations (or reminders) that are already saved, one at a time, and records each
 * one as it goes: sent (with the time), or couldn't be sent. Used when a host sends now, and by the
 * daily job on registration's opening day for invitations that were waiting for it.
 */
export async function deliverBandInvites(o: {
  event: InviteEvent;
  emails: string[];
  reminder: boolean;
  host: string;
  origin: string;
}) {
  const admin = createAdminClient();
  const w = groupWords(o.event.event_type);
  const [{ data: rows }, { data: prefills }] = await Promise.all([
    admin.from("band_invitations").select("email, token").eq("event_id", o.event.id).in("email", o.emails),
    admin.from("band_prefills").select("email, head_director_name").eq("event_id", o.event.id).in("email", o.emails),
  ]);
  const { data: profiles } = await admin.from("profiles").select("email, full_name").in("email", o.emails);
  const names = new Map<string, string | null>([
    ...((profiles ?? []) as { email: string; full_name: string | null }[]).map((p) => [p.email.toLowerCase(), p.full_name] as const),
    ...((prefills ?? []) as { email: string; head_director_name: string | null }[]).map((p) => [p.email.toLowerCase(), p.head_director_name] as const),
  ]);
  const filledIn = new Set(((prefills ?? []) as { email: string }[]).map((p) => p.email.toLowerCase()));
  const saved = o.reminder ? null : await loadSystemEmail("director_invite");
  let sent = 0;
  for (const row of (rows ?? []) as { email: string; token: string }[]) {
    const name = names.get(row.email.toLowerCase()) ?? null;
    const first = name ? name.split(" ")[0] : null;
    const custom = customWords("director_invite", saved, {
      first_name: first ?? "",
      host: o.host,
      group: w.one,
      event_name: o.event.name,
      event_dates: formatDateRange(o.event.starts_on, o.event.ends_on),
      at_venue: o.event.venue_name ? `at ${o.event.venue_name}` : "",
    });
    const words = bandInviteEmail({
      firstName: first,
      host: o.host,
      one: w.one,
      event: o.event,
      fromSpreadsheet: filledIn.has(row.email.toLowerCase()),
      reminder: o.reminder,
      email: row.email,
      custom,
    });
    const { html, text } = emailLayout({
      heading: words.heading,
      paragraphs: words.paragraphs,
      button: { label: words.button, url: `${o.origin}/e/${o.event.slug}/bands/invite/${row.token}` },
      footer: words.footer,
    });
    const ok = await sendEmail({ to: row.email, subject: words.subject, html, text, eventId: o.event.id });
    // Recorded per email as it goes, so a send cut short leaves the rest unsent, not "Invited".
    await admin
      .from("band_invitations")
      .update(ok ? { sent_at: new Date().toISOString(), scheduled_for: null, failed_at: null, failed_reason: null } : { failed_at: new Date().toISOString(), failed_reason: "service" })
      .eq("event_id", o.event.id)
      .eq("email", row.email);
    if (ok) sent++;
    await pause();
  }
  return sent;
}
