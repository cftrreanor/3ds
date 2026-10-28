"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { forgetEventSender } from "@/lib/event-sender";
import { saveRow } from "@/lib/save-row";
import { createClient } from "@/lib/supabase/server";
import { saveNotifyRecipients } from "./notify-actions";

const EMAIL = /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/i;

/** Edit details → Email replies: whether replies to this event's emails go somewhere, and where. */
export async function saveReplies(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const replies = formData.get("replies") === "on";
  const replyTo = String(formData.get("replyTo") ?? "").trim().toLowerCase();
  if (replies && !replyTo) return { error: "Enter the email replies should go to.", fieldErrors: { replyTo: "Enter an email" } };
  if (replies && (!EMAIL.test(replyTo) || replyTo.length > 254)) {
    return { error: "That email doesn't look right.", fieldErrors: { replyTo: "Check the email" } };
  }
  const supabase = await createClient();
  const { saved, error } = await saveRow(
    supabase,
    "event_email_settings",
    { event_id: eventId },
    {
      replies,
      // Kept when replies are off, so turning them back on remembers it.
      reply_to: replyTo || null,
      updated_at: new Date().toISOString(),
    },
  );
  if (error) return { error: friendlyDbError(error) };
  if (!saved) return { error: "Only the event's hosts can change this." };
  forgetEventSender(eventId);
  revalidatePath(`/dashboard/events/${eventId}/edit`);
  return { ok: true, message: replies ? `Saved. Replies go to ${replyTo}.` : "Saved. Emails won't take replies." };
}

/** A new event's guided setup, Email settings: replies and notifications saved by one Continue, then the `next` step. */
export async function saveEmailSetup(eventId: string, next: string, prev: ActionState, formData: FormData): Promise<ActionState> {
  if (formData.has("replies")) {
    const replies = await saveReplies(eventId, prev, formData);
    if (replies.error) return replies;
  }
  if (formData.has("notifyForm")) {
    const notify = await saveNotifyRecipients(eventId, prev, formData);
    if (notify.error) return notify;
  }
  // Back or Save and finish later, pressed with changes: there instead of the next step.
  const asked = String(formData.get("next") ?? "");
  redirect(asked === `/dashboard/events/${eventId}` || asked.startsWith(`/dashboard/events/${eventId}/edit?`) ? asked : next);
}
