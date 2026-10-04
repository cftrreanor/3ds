-- Fix: creating an event failed with "You don't have permission to do that".
-- The app inserts an event and reads it back in the same statement
-- (INSERT ... RETURNING). The read-back is checked against the SELECT
-- policies, and "events: staff read" looks the event up by id, which the
-- brand-new row isn't visible to yet. Checking the row's own organization
-- works for new and existing rows alike.
create policy "events: hosts read" on public.events
  for select to authenticated
  using (public.is_org_admin(organization_id));

-- Venue picked from Google Maps search: keep the place id and coordinates so
-- we can show maps and directions to volunteers and visiting bands later.
alter table public.events
  add column venue_place_id text,
  add column venue_lat double precision check (venue_lat between -90 and 90),
  add column venue_lng double precision check (venue_lng between -180 and 180);
