import type { createClient } from "@/lib/supabase/server";
import type { MealOffer, MealOrder } from "@/lib/meal-price";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Meals for visiting bands (the 20270111000000 update). Read on their own, so a page still works
 * before that update is run: no update means no meals offered and no orders.
 */
export async function loadMealOffer(supabase: Client, eventId: string): Promise<MealOffer | null> {
  const s = await loadMealSettings(supabase, eventId);
  return s.offered ? { priceCents: s.priceCents, details: s.details || null, options: s.options } : null;
}

/** The host's meal settings for the Registration step (all off before the update). */
export async function loadMealSettings(supabase: Client, eventId: string) {
  const { data, error } = await supabase.from("events").select("meals_offered, meal_price_cents, meal_details, meal_options").eq("id", eventId).maybeSingle();
  return {
    ready: !error,
    offered: Boolean(data?.meals_offered),
    priceCents: (data?.meal_price_cents as number | null) ?? null,
    details: (data?.meal_details as string | null) ?? "",
    options: ((data?.meal_options as string[] | null) ?? []).filter(Boolean),
  };
}

/** Each band's meal order, by band id (only bands that ordered something or left a note). */
export async function loadMealOrders(supabase: Client, bandIds: string[]): Promise<Record<string, MealOrder>> {
  if (!bandIds.length) return {};
  const { data, error } = await supabase.from("bands").select("id, meal_counts, meal_note").in("id", bandIds);
  if (error) return {};
  const out: Record<string, MealOrder> = {};
  for (const b of (data ?? []) as { id: string; meal_counts: Record<string, number> | null; meal_note: string | null }[]) {
    const counts = Object.fromEntries(Object.entries(b.meal_counts ?? {}).filter(([, n]) => Number(n) > 0)) as Record<string, number>;
    if (Object.keys(counts).length || b.meal_note) out[b.id] = { counts, note: b.meal_note };
  }
  return out;
}
