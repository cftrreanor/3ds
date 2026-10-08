import "server-only";
import { registrationIsOpen } from "@/lib/bands";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Look up a band invitation by its secret token. Its sign-in link works for as
 * long as the event's band registration is open (sending a new invitation
 * replaces it).
 */
export async function findBandInvite(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await createAdminClient()
    .from("band_invitations")
    .select("email, events(slug, name, status, timezone, band_registration_open, band_registration_deadline)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const event = data.events as unknown as {
    slug: string;
    name: string;
    status: string;
    timezone: string;
    band_registration_open: boolean;
    band_registration_deadline: string | null;
  } | null;
  return { email: data.email as string, usable: Boolean(event && registrationIsOpen(event)), event };
}
