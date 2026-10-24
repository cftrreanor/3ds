-- =============================================================================
-- Each event chooses whether its public pages show the account's logo and
-- color (Edit event details). The logo and color stay one per account; this
-- only switches them off for one event, conferences included. On by default,
-- as before.
-- =============================================================================

alter table public.events add column show_brand boolean not null default true;
