import "server-only";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";

/** The most other addresses an event's notifications can go to (the database checks too). */
export const MAX_EXTRA_EMAILS = 5;

export type NotifyRecipients = { memberIds: string[]; extraEmails: string[] };

/** The event's saved choice of who gets notifications, or null when there isn't one (or before the 20261230000000 update). */
export async function loadNotifyRecipients(eventId: string): Promise<NotifyRecipients | null> {
  const { data, error } = await createAdminClient()
    .from("event_notification_recipients")
    .select("member_ids, extra_emails")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error && !isSchemaError(error)) console.error("Loading notification recipients failed", error);
  return data ? { memberIds: data.member_ids ?? [], extraEmails: data.extra_emails ?? [] } : null;
}

/**
 * Who hears about something on an event (bookings, withdrawals): the people
 * its hosts picked, or `fallback` when they haven't picked anyone. People who
 * have left the account are skipped.
 */
export async function notificationEmails(eventId: string, fallback: () => Promise<string[]> | string[]): Promise<string[]> {
  const saved = await loadNotifyRecipients(eventId);
  if (!saved || (!saved.memberIds.length && !saved.extraEmails.length)) return dedupe(await fallback());
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("organization_id").eq("id", eventId).maybeSingle();
  const { data: members } =
    event && saved.memberIds.length
      ? await admin
          .from("organization_members")
          .select("profiles(email)")
          .eq("organization_id", event.organization_id)
          .in("user_id", saved.memberIds)
      : { data: [] };
  const team = ((members ?? []) as unknown as { profiles: { email: string | null } | null }[]).map((m) => m.profiles?.email);
  return dedupe([...team, ...saved.extraEmails]);
}

function dedupe(emails: (string | null | undefined)[]) {
  const seen = new Set<string>();
  return emails.filter((e): e is string => {
    const key = e?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
