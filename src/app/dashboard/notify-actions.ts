"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { MAX_EXTRA_EMAILS } from "@/lib/notify-recipients";
import { isSchemaError } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";

const EMAIL = /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/i;

/** Edit details → Notifications: who on the account, and which other addresses, hear about this event. */
export async function saveNotifyRecipients(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const memberIds = formData.getAll("member").map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const extras = [
    ...new Set(
      String(formData.get("extraEmails") ?? "")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const bad = extras.find((e) => !EMAIL.test(e) || e.length > 254);
  if (bad) return { error: `"${bad}" doesn't look like an email address.`, fieldErrors: { extraEmails: "Check the addresses" } };
  if (extras.length > MAX_EXTRA_EMAILS) {
    return { error: `Add up to ${MAX_EXTRA_EMAILS} other addresses.`, fieldErrors: { extraEmails: `Up to ${MAX_EXTRA_EMAILS}` } };
  }
  if (!memberIds.length && !extras.length) return { error: "Pick at least one person to get notifications." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_notification_recipients")
    .upsert({ event_id: eventId, member_ids: memberIds, extra_emails: extras, updated_at: new Date().toISOString() })
    .select("event_id");
  if (isSchemaError(error)) return { error: "This needs a database update first. Please write to us." };
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's hosts can change this." };
  revalidatePath(`/dashboard/events/${eventId}/edit`);
  const count = memberIds.length + extras.length;
  return { ok: true, message: `Saved. Notifications go to ${count} ${count === 1 ? "person" : "people"}.` };
}
