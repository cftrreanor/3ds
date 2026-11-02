-- =============================================================================
-- Meals for visiting bands.
--   * events.meals_offered: the host provides meals bands can order.
--   * events.meal_price_cents: what one meal costs (optional; blank says nothing).
--   * events.meal_details: what's offered and how it works (vegetarian, halal,
--     gluten free, when it's served, how to pay).
--   * bands.meals_requested: the director says how many meals the band needs,
--     and which of the offered options (optional; only asked when meals are offered).
-- Hosts already update their events; directors get the new band column the same
-- way as the rest of their registration (column grants, below).
-- =============================================================================

alter table public.events
  add column meals_offered boolean not null default false,
  add column meal_price_cents int check (meal_price_cents between 0 and 100000),
  add column meal_details text check (length(meal_details) <= 1000);

alter table public.bands
  add column meals_requested text check (length(meals_requested) <= 500);
grant insert (meals_requested), update (meals_requested) on public.bands to authenticated;
