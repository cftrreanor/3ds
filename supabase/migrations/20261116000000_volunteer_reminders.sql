-- =============================================================================
-- Volunteer reminders: the daily job emails each volunteer the day before
-- their shifts (station, time, where to report, their lead). reminded_at keeps
-- a shift from being reminded twice. Only the server reads or sets it.
-- =============================================================================

alter table public.volunteer_assignments add column reminded_at timestamptz;
create index volunteer_assignments_unreminded_idx on public.volunteer_assignments (shift_id) where reminded_at is null;
