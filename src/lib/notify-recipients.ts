import "server-only";
import type { NotifyKind } from "@/lib/notify-kinds";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";

export type NotifyRecipients = { memberIds: string[]; extraEmails: string[] };

/** Each kind's saved choice of who gets it (kinds with no row aren't in the map; empty before the 20261230000000 update). */
export async function loadNotifyRecipients(eventId: string): Promise<Map<NotifyKind, NotifyRecipients>> {
  const { data, error } = await createAdminClient()
    .from("event_notification_recipients")
    .select("kind, member_ids, extra_emails")
    .eq("event_id", eventId);
  if (error && !isSchemaError(error)) console.error("Loading notification recipients failed", error);
  return new Map((data ?? []).map((r) => [r.kind as NotifyKind, { memberIds: r.member_ids ?? [], extraEmails: r.extra_emails ?? [] }]));
}

/**
 * Who gets one kind of email about an event (bookings, registrations,
 * withdrawals, the volunteer summary): the people its hosts picked, or
 * `fallback` when they haven't picked anyone for that kind. People who have
 * left the account or the event's team are skipped.
 */
export async function notificationEmails(
  eventId: string,
  kind: NotifyKind,
  fallback: () => Promise<string[]> | string[] = () => [],
): Promise<string[]> {
  const saved = (await loadNotifyRecipients(eventId)).get(kind);
  if (!saved) return dedupe(await fallback());
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("organization_id").eq("id", eventId).maybeSingle();
  const ids = saved.memberIds;
  const [{ data: hosts }, { data: leads }] =
    event && ids.length
      ? await Promise.all([
          admin.from("organization_members").select("profiles(email)").eq("organization_id", event.organization_id).in("user_id", ids),
          admin.from("event_staff").select("profiles(email)").eq("event_id", eventId).eq("role", "volunteer_director").in("user_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
  const team = [...(hosts ?? []), ...(leads ?? [])].map((m) => (m as unknown as { profiles: { email: string | null } | null }).profiles?.email);
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
