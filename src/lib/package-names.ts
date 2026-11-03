// Packages and passes as stored (plan_tiers): names, what each includes, and prices. The
// Packages admin page changes them, so pages read names from here instead of fixed text.
// Server only.

import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";

export type Tier = {
  code: string;
  kind: "package" | "pass";
  name: string;
  event_types: string[];
  one_at_a_time: string[];
  max_team: number | null;
  event_staff: boolean;
  volunteer_history: boolean;
  price_cents: number | null;
  sort: number;
  // Added by 20270114000000_package_admin.sql (missing before it runs).
  price_month_cents?: number | null;
  price_year_cents?: number | null;
  teacher_month_cents?: number | null;
  teacher_year_cents?: number | null;
  teacher_rate?: boolean;
};

/** Every package and pass, smallest first (once per request). Empty if it can't be read. */
export const loadTiers = cache(async (): Promise<Tier[]> => {
  const { data, error } = await createAdminClient().from("plan_tiers").select("*").order("sort");
  if (error) {
    console.error("plan_tiers failed", error.message);
    return [];
  }
  return (data ?? []) as Tier[];
});

/** Package and pass names by code, as named on the Packages page. */
export async function tierNames(): Promise<Record<string, string>> {
  return Object.fromEntries((await loadTiers()).map((t) => [t.code, t.name]));
}
