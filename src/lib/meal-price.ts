/** What the host offers to eat, when they do: the price of one meal (cents) and the options. */
export type MealOffer = { priceCents: number | null; details: string | null };

/** 850 → "$8.50", 800 → "$8". */
export const mealPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
