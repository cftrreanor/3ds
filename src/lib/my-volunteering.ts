import { createAdminClient, createClient } from "@/lib/supabase/server";
import { utcToZonedDate } from "@/lib/time";
import { hasPass, readPass } from "@/lib/volunteer-pass";

/**
 * Does this visitor have volunteering still to come: a shift that hasn't
 * ended, or something to bring to an event that hasn't happened yet? Checks
 * their account's email when signed in, and this device's pass either way
 * (the same two sources as the My volunteering page). Shows "My volunteering".
 */
export async function hasUpcomingVolunteering(signedIn: boolean): Promise<boolean> {
  const pass = await readPass();
  const withPass = hasPass(pass);
  if (!signedIn && !withPass) return false;
  const none = Promise.resolve({ data: [] });
  const supabase = signedIn ? await createClient() : null;
  const admin = withPass ? createAdminClient() : null;
  const [mine, myItems, passed, passedItems] = await Promise.all([
    supabase ? supabase.rpc("my_agenda") : none,
    supabase ? supabase.rpc("my_items") : none,
    admin ? admin.rpc("pass_agenda", { p_volunteer_tokens: pass.v, p_assignment_tokens: pass.a }) : none,
    admin ? admin.rpc("pass_items", { p_volunteer_tokens: pass.v, p_item_tokens: pass.a }) : none,
  ]);
  const now = new Date();
  const shifts = [...((mine.data ?? []) as { ends_at: string }[]), ...((passed.data ?? []) as { ends_at: string }[])];
  const items = [
    ...((myItems.data ?? []) as { starts_on: string; timezone: string }[]),
    ...((passedItems.data ?? []) as { starts_on: string; timezone: string }[]),
  ];
  return (
    shifts.some((s) => new Date(s.ends_at) >= now) ||
    items.some((i) => i.starts_on >= utcToZonedDate(now.toISOString(), i.timezone))
  );
}
