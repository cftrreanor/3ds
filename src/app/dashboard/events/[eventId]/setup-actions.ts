"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { loadSetupFacts } from "@/lib/setup-facts";
import { SHARED_LINKS, setupChecklist, type SetupChecklist, type SharedLink } from "@/lib/setup-checklist";
import { createClient } from "@/lib/supabase/server";

/** The setup checklist as it stands now (hosts only; null for anyone else). */
export async function currentChecklist(eventId: string): Promise<SetupChecklist | null> {
  const facts = await loadSetupFacts(eventId);
  return facts ? setupChecklist(facts) : null;
}

/**
 * A link was shared (copied, its QR code downloaded, or marked done by hand):
 * tick its Next steps step. The first time counts; later copies change nothing.
 */
export async function markLinkShared(eventId: string, link: SharedLink): Promise<ActionState> {
  if (!SHARED_LINKS.includes(link)) return { error: "That isn't one of this event's links." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_shared_links")
    .upsert({ event_id: eventId, link }, { onConflict: "event_id,link", ignoreDuplicates: true })
    .select("link");
  if (error) return { error: friendlyDbError(error) };
  // Only a first share changes the checklist (and redraws the page).
  if (data?.length) revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}
