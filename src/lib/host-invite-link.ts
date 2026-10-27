import { createAdminClient } from "@/lib/supabase/server";

/** Where a host invitation's one-tap button can land after signing them in. */
export const WELCOME_NEXT = ["/dashboard/setup", "/dashboard/events/new", "/dashboard/account"] as const;

export function welcomeNext(next: unknown) {
  return WELCOME_NEXT.find((p) => p === next) ?? WELCOME_NEXT[0];
}

/**
 * A fresh one-tap sign-in link for a host invitation email (the old one stops
 * working). Null before the 20261229000000 update, so the email falls back to
 * the normal sign-in page.
 */
export async function hostWelcomeLink(origin: string, email: string) {
  const key = crypto.randomUUID();
  const { data, error } = await createAdminClient()
    .from("host_invitations")
    .update({ email_token: key, sent_at: new Date().toISOString() })
    .eq("email", email)
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return (next: (typeof WELCOME_NEXT)[number] = WELCOME_NEXT[0]) =>
    `${origin}/welcome/${data.id}?${new URLSearchParams({ k: key, ...(next === WELCOME_NEXT[0] ? {} : { next }) })}`;
}
