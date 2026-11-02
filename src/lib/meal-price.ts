/** What the host offers to eat: the price of one meal (cents), what's served, and the options bands order. */
export type MealOffer = { priceCents: number | null; details: string | null; options: string[] };

/** A band's order: how many of each option, and anything else. */
export type MealOrder = { counts: Record<string, number>; note: string | null };

/** With no options set, bands order plain meals. */
export const mealOptionsOrDefault = (options: string[]) => (options.length ? options : ["Meals"]);

/** 850 → "$8.50", 800 → "$8", 100300 → "$1,003". */
export const mealPrice = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** How many meals in an order. */
export const mealTotal = (counts: Record<string, number>) => Object.values(counts).reduce((n, c) => n + c, 0);

/** "72 Regular, 6 Vegetarian" (the options with a count, in the host's order). */
export function mealSummary(counts: Record<string, number>, options: string[]) {
  const keys = [...options, ...Object.keys(counts).filter((k) => !options.includes(k))];
  return keys
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${counts[k]} ${k}`)
    .join(", ");
}
