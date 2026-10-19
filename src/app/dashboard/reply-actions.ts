"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { forgetEventSender } from "@/lib/event-sender";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.from("event_email_settings").upsert({
    event_id: eventId,
    replies,
    // Kept when replies are off, so turning them back on remembers it.
    reply_to: replyTo || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: friendlyDbError(error) };
  forgetEventSender(eventId);
  revalidatePath(`/dashboard/events/${eventId}/edit`);
  return { ok: true, message: replies ? `Saved. Replies go to ${replyTo}.` : "Saved. Emails won't take replies." };
}
