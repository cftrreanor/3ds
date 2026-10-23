"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { demoAccount } from "@/lib/demo-accounts";
import { QA_COOKIE, isQa, reviewerEmail, reviewerFromCookie } from "@/lib/qa";
import { SCENARIOS } from "@/lib/qa-scenarios";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The reviewer using the control center (by their QA cookie, whoever this
 * browser is signed in as) and their QA account's organization.
 */
async function reviewer(admin: Admin): Promise<{ id: string; orgId: string | null; tz: string } | { error: string }> {
  if (!isQa()) return { error: "This isn't the QA site." };
  const name = reviewerFromCookie((await cookies()).get(QA_COOKIE)?.value);
  if (!name) return { error: "Open the QA site with your passcode first." };
  const { data: profile } = await admin.from("profiles").select("id").eq("email", reviewerEmail(name)).maybeSingle();
  if (!profile) return { error: "Your QA account isn't set up yet. Switch reviewer and enter your passcode again." };
  const { data: member } = await admin
    .from("organization_members")
    .select("organization_id, organizations(default_timezone)")
    .eq("user_id", profile.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const org = member?.organizations as unknown as { default_timezone: string } | null;
  return { id: profile.id, orgId: member?.organization_id ?? null, tz: org?.default_timezone ?? "America/Chicago" };
}

/** A date some days from today, in a time zone ("2026-11-03"). */
function dayFromToday(days: number, tz: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Make a ready-made event (src/lib/qa-scenarios.ts) in the reviewer's own
 * organization, published and filled with sample people, and open it.
 */
export async function createScenario(scenarioId: string): Promise<ActionState> {
  const admin = createAdminClient();
  const who = await reviewer(admin);
  if ("error" in who) return who;
  if (!who.orgId) return { error: "Start your organization first: on Your events, fill in your organization's name, then try again." };
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) return { error: "Pick one of the ready-made events." };

  const day = dayFromToday(s.inDays, who.tz);
  const { data: event, error } = await admin
    .from("events")
    .insert({
      event_type: s.type,
      organization_id: who.orgId,
      name: s.name,
      slug: slugify(s.name),
      timezone: who.tz,
      starts_on: day,
      ends_on: day,
      window_start: zonedToUtc(day, s.start, who.tz).toISOString(),
      window_end: zonedToUtc(day, s.end, who.tz).toISOString(),
      venue_name: s.venueName,
      venue_address: s.venueAddress,
      volunteer_signup_open: Boolean(s.open?.volunteers),
      band_registration_open: Boolean(s.open?.bands),
      performance_order_published: Boolean(s.open?.order),
      ...(s.open?.parents ? { parent_registration_open: true } : {}),
      status: "published",
      created_by: who.id,
    })
    .select("id")
    .single();
  if (error || !event) {
    console.error("Making the QA scenario failed", error);
    return { error: `We couldn't make that event. (Details: ${error?.message ?? "unknown"})` };
  }

  // Sample people, the way demo mode adds them (supabase/migrations/20261114000000_demo_sample_data.sql).
  const { error: demoError } = await admin.from("demo_events").upsert({ owner_id: who.id, event_id: event.id, last_used_at: new Date().toISOString() });
  if (demoError) console.error("Turning on demo mode for the QA scenario failed", demoError);
  const director = await demoAccount(admin, who.id, "director");
  const { error: seedError } = await admin.rpc("demo_seed", { p_owner: who.id, p_event: event.id, p_director: director?.id ?? null });
  if (seedError) console.error("Adding sample people to the QA scenario failed", seedError);

  redirect(`/dashboard/events/${event.id}`);
}

/** Delete every event in the reviewer's own organization, for a clean start. */
export async function resetMyEvents(): Promise<ActionState> {
  const admin = createAdminClient();
  const who = await reviewer(admin);
  if ("error" in who) return who;
  if (who.orgId) {
    const { error } = await admin.from("events").delete().eq("organization_id", who.orgId);
    if (error) {
      console.error("Resetting QA events failed", error);
      return { error: `We couldn't delete your events. (Details: ${error.message})` };
    }
  }
  redirect("/dashboard");
}
