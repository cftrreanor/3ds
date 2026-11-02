import type { createClient } from "@/lib/supabase/server";
import type { MealOffer } from "@/lib/meal-price";

/**
 * Meals for visiting bands (the 20270111000000 update). Read on their own, so a page still works
 * before that update is run: no update means no meals offered and no requests.
 */
export async function loadMealOffer(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string): Promise<MealOffer | null> {
  const { data, error } = await supabase.from("events").select("meals_offered, meal_price_cents, meal_details").eq("id", eventId).maybeSingle();
  if (error || !data?.meals_offered) return null;
  return { priceCents: data.meal_price_cents ?? null, details: data.meal_details ?? null };
}

/** The host's meal settings for the Registration step (all off before the update). */
export async function loadMealSettings(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string) {
  const { data, error } = await supabase.from("events").select("meals_offered, meal_price_cents, meal_details").eq("id", eventId).maybeSingle();
  return {
    ready: !error,
    offered: Boolean(data?.meals_offered),
    priceCents: (data?.meal_price_cents as number | null) ?? null,
    details: (data?.meal_details as string | null) ?? "",
  };
}

/** Each band's meal request, by band id. */
export async function loadMealRequests(supabase: Awaited<ReturnType<typeof createClient>>, bandIds: string[]): Promise<Record<string, string>> {
  if (!bandIds.length) return {};
  const { data, error } = await supabase.from("bands").select("id, meals_requested").in("id", bandIds);
  if (error) return {};
  return Object.fromEntries(((data ?? []) as { id: string; meals_requested: string | null }[]).filter((b) => b.meals_requested).map((b) => [b.id, b.meals_requested!]));
}
