import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** How long a band invitation's sign-in link works. */
export const INVITE_DAYS = 30;

/** Look up a band invitation by its secret token. */
export async function findBandInvite(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await createAdminClient()
    .from("band_invitations")
    .select("email, sent_at, used_at, events(slug, name)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const expired = new Date(data.sent_at).getTime() + INVITE_DAYS * 864e5 < Date.now();
  return {
    email: data.email as string,
    usable: !data.used_at && !expired,
    event: data.events as unknown as { slug: string; name: string } | null,
  };
}
