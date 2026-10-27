import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** The name and organization we invited them with (from their pilot request card), to fill in their setup. */
export async function invitedAs(email: string | undefined): Promise<{ name?: string; organization?: string }> {
  if (!email) return {};
  const admin = createAdminClient();
  const { data: inv } = await admin.from("host_invitations").select("pilot_request_id").eq("email", email).maybeSingle();
  if (!inv?.pilot_request_id) return {};
  const { data: card } = await admin.from("pilot_requests").select("name, organization").eq("id", inv.pilot_request_id).maybeSingle();
  if (!card) return {};
  // A card with only a name shows the name as its organization: that isn't a group to fill in.
  return { name: card.name ?? undefined, organization: card.organization && card.organization !== card.name ? card.organization : undefined };
}
