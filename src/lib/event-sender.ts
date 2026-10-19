import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSchemaError } from "@/lib/schema-check";

/**
 * Who an event's emails are from, as people see it: the organizer's name
 * ("Lone Star Band Boosters via Field Command Events"), and where a reply goes.
 * The address itself is always ours (supabase/migrations/20261212000000_event_email_settings.sql).
 */
export type EventSender = { name: string; replyTo: string | null };

/** What the Replies setting looks like, before falling back to the defaults. */
export type ReplySetting = { replies: boolean; replyTo: string | null };

const cache = new Map<string, { at: number; sender: EventSender | null }>();
const CACHE_MS = 60_000;

/**
 * The sender for an event's emails (cached for a minute, since reminders and
 * bulk emails send many at once). Null if the event can't be read.
 */
export async function eventSender(eventId: string): Promise<EventSender | null> {
  const hit = cache.get(eventId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sender;
  const sender = await loadSender(eventId).catch((err) => {
    console.error("Loading the event's sender failed", err);
    return null;
  });
  cache.set(eventId, { at: Date.now(), sender });
  return sender;
}

/** After the Replies setting changes, so the next email uses it. */
export function forgetEventSender(eventId: string) {
  cache.delete(eventId);
}

async function loadSender(eventId: string): Promise<EventSender | null> {
  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("event_type, organizations(name), creator:profiles!events_created_by_fkey(full_name, email)")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) console.error("Loading the event's sender failed", eventError.message);
  if (!event) return null;
  const org = event.organizations as unknown as { name: string } | null;
  const creator = event.creator as unknown as { full_name: string; email: string } | null;
  const type = String(event.event_type);
  // A conference is the teacher's own; everything else is the organization's.
  const name = (type === "conference" ? creator?.full_name?.trim() : org?.name?.trim()) || org?.name?.trim() || "";

  // No setting yet (or before the database update): replies go to the event's creator.
  const { data: row, error } = await admin.from("event_email_settings").select("replies, reply_to").eq("event_id", eventId).maybeSingle();
  if (error && !isSchemaError(error)) console.error("Loading the event's reply setting failed", error.message);
  const replies = row ? row.replies : true;
  return { name, replyTo: replies ? row?.reply_to || creator?.email || null : null };
}
