import "server-only";
import { registrationIsOpen } from "@/lib/bands";
import { emailLinkCutoff } from "@/lib/email-link-age";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Look up a band invitation by its secret token. Its sign-in button works
 * once, within a week of the email, while the event's band registration is
 * open (sending a new invitation replaces it). `blocked` says why it won't
 * sign someone in: "closed" (registration), "used" or "expired".
 */
export async function findBandInvite(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await createAdminClient()
    .from("band_invitations")
    .select("email, sent_at, used_at, events(slug, name, status, timezone, band_registration_open, band_registration_deadline)")
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
  const blocked: "closed" | "used" | "expired" | null = !(event && registrationIsOpen(event))
    ? "closed"
    : data.used_at
      ? "used"
      : (data.sent_at as string) < emailLinkCutoff()
        ? "expired"
        : null;
  return { email: data.email as string, usable: !blocked, blocked, event };
}
