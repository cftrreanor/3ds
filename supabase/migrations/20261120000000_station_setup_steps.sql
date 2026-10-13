-- =============================================================================
-- Stations & shifts, step by step: a station's "1. Station details" step is
-- done once the host has saved its details (details_saved_at). Its "2. Build
-- shifts" step is done once it has a shift.
-- =============================================================================

alter table public.stations add column details_saved_at timestamptz;
grant update (details_saved_at) on public.stations to authenticated;

-- Stations set up before this counted as done when they already have details.
update public.stations s set details_saved_at = s.created_at
 where s.location is not null or s.instructions is not null
    or exists (select 1 from public.station_leads l where l.station_id = s.id);
