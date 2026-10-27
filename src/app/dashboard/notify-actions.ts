"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { MAX_EXTRA_EMAILS, notifyKinds } from "@/lib/notify-kinds";
import { isSchemaError } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";

const EMAIL = /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/i;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Edit details → Email settings: for each kind of email this event sends its
 * organizers, who on the team gets it and which other addresses. Each person
 * row sends `<kind>` = their id; other addresses send `extra` and, for row i,
 * `extraKinds-<i>`.
 */
export async function saveNotifyRecipients(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("event_type").eq("id", eventId).maybeSingle();
  if (!event) return { error: "Only the event's hosts can change this." };
  const kinds = notifyKinds(event.event_type);

  const extras = formData.getAll("extra").map((e, i) => ({
    email: String(e).trim().toLowerCase(),
    kinds: formData.getAll(`extraKinds-${i}`).map(String),
  }));
  const typed = extras.filter((x) => x.email);
  const bad = typed.find((x) => !EMAIL.test(x.email) || x.email.length > 254);
  if (bad) return { error: `"${bad.email}" doesn't look like an email address.` };
  if (new Set(typed.map((x) => x.email)).size > MAX_EXTRA_EMAILS) return { error: `Add up to ${MAX_EXTRA_EMAILS} other addresses.` };
  const unpicked = typed.find((x) => !x.kinds.some((k) => kinds.some((n) => n.kind === k)));
  if (unpicked) return { error: `Tick at least one kind of email for ${unpicked.email}, or remove it.` };

  const rows = kinds.map(({ kind }) => ({
    event_id: eventId,
    kind,
    member_ids: [...new Set(formData.getAll(kind).map(String).filter((id) => UUID.test(id)))],
    extra_emails: [...new Set(typed.filter((x) => x.kinds.includes(kind)).map((x) => x.email))],
    updated_at: new Date().toISOString(),
  }));
  // Bookings carry the calendar invites: someone has to get them.
  const bookings = rows.find((r) => r.kind === "bookings");
  if (bookings && !bookings.member_ids.length && !bookings.extra_emails.length) {
    return { error: "Pick at least one person to get bookings and their calendar invites." };
  }

  const { data, error } = await supabase.from("event_notification_recipients").upsert(rows).select("event_id");
  if (isSchemaError(error)) return { error: "This needs a database update first. Please write to us." };
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only the event's hosts can change this." };
  revalidatePath(`/dashboard/events/${eventId}/edit`);
  return { ok: true, message: "Saved. Each kind of email goes to the people you picked." };
}
