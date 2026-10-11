-- =============================================================================
-- Pilot requests: which kinds of event the person wants to plan and host
-- (picked on the home page form). The "hardest part" answer goes in notes.
-- Readable by platform admins only, like the rest of the table.
-- =============================================================================

alter table public.pilot_requests
  add column event_types text[] not null default '{}'
    check (event_types <@ array['band_contest', 'group_event', 'fair', 'volunteer', 'school_visit', 'other']::text[]
           and cardinality(event_types) <= 6);
