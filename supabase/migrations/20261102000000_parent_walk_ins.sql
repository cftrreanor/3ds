-- =============================================================================
-- School visitor events: can parents who didn't register still come?
-- When yes, the registration page says so once registration has closed
-- (bring a government-issued photo ID during the event). Off by default.
-- =============================================================================

alter table public.events add column parent_walk_ins_allowed boolean not null default false;
