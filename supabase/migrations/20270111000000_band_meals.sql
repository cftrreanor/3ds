-- =============================================================================
-- Meals for visiting bands.
--   * events.meals_offered: the host provides meals bands can order.
--   * events.meal_price_cents: what one meal costs (optional).
--   * events.meal_details: what's served and how it works (when, how to pay).
--   * events.meal_options: what bands can order, in order ("Regular",
--     "Vegetarian", "Halal", "Gluten free"). Up to 10.
--   * bands.meal_counts: how many of each option the band needs, like
--     {"Regular": 110, "Vegetarian": 6}. Whole numbers, 0 to 2,000 each.
--   * bands.meal_note: anything else about the band's meals (optional).
-- Directors can change their counts while registration is open, like the rest of
-- their registration (column grants, below). Hosts already update their events.
-- =============================================================================

alter table public.events
  add column meals_offered boolean not null default false,
  add column meal_price_cents int check (meal_price_cents between 0 and 100000),
  add column meal_details text check (length(meal_details) <= 1000),
  add column meal_options text[] not null default '{}'
    check (cardinality(meal_options) <= 10);

-- Whole numbers from 0 to 2,000 for each option, in a plain object.
create function public.valid_meal_counts(j jsonb)
returns boolean
language sql immutable set search_path = public
as $$
  select jsonb_typeof(j) = 'object'
     and coalesce((select bool_and(jsonb_typeof(v) = 'number'
                                   and (v #>> '{}')::numeric between 0 and 2000
                                   and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
                                   and length(k) between 1 and 40)
                     from jsonb_each(j) as e(k, v)), true)
     and (select count(*) from jsonb_object_keys(j)) <= 20;
$$;

alter table public.bands
  add column meal_counts jsonb not null default '{}' check (public.valid_meal_counts(meal_counts)),
  add column meal_note text check (length(meal_note) <= 300);
grant insert (meal_counts, meal_note), update (meal_counts, meal_note) on public.bands to authenticated;
