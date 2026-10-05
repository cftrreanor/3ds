-- The add/remove test-data scripts work, are idempotent-safe, and clean up fully.
-- Runs after security_test.sql, as the database owner (like the SQL Editor).
\set QUIET on
insert into public.events (organization_id, name, slug, starts_on, ends_on, window_start, window_end, venue_address)
values ((select id from public.organizations order by created_at limit 1), 'Test shell', 'my-test-event',
        current_date + 20, current_date + 20, now() + interval '20 days', now() + interval '20 days 15 hours', 'addr');

\ir ../test-data/add-test-data.sql

do $$ declare ev uuid := (select id from public.events where slug = 'my-test-event'); begin
  assert (select count(*) from public.bands where event_id = ev) = 12, 'adds 12 bands';
  assert (select count(*) from public.volunteers where event_id = ev) = 40, 'adds 40 volunteers';
  assert (select count(*) from public.shifts where event_id = ev) = 9, 'adds sample shifts';
  assert not exists (select 1 from public.shifts s where event_id = ev and s.registered_count
                     <> (select count(*) from public.volunteer_assignments a where a.shift_id = s.id)),
         'signup counts match the signups';
  assert exists (select 1 from public.shifts where event_id = ev and registered_count = max_capacity), 'one shift is full';
  assert exists (select 1 from public.shifts where event_id = ev and registered_count < max_capacity), 'others have room';
end $$;

-- Running it twice is refused rather than duplicating.
\set ON_ERROR_STOP off
\ir ../test-data/add-test-data.sql
\set ON_ERROR_STOP on
do $$ begin
  assert (select count(*) from public.bands b join public.events e on e.id = b.event_id where e.slug = 'my-test-event') = 12,
         'a second run adds nothing';
end $$;

-- Real volunteers are left alone.
insert into public.volunteers (event_id, full_name, email, phone)
select id, 'Real Person', 'real@example.com', '+15125550999' from public.events where slug = 'my-test-event';

\ir ../test-data/remove-test-data.sql

do $$ declare ev uuid := (select id from public.events where slug = 'my-test-event'); begin
  assert (select count(*) from public.bands where event_id = ev) = 0, 'removes test bands';
  assert (select count(*) from public.volunteers where event_id = ev) = 1, 'keeps real volunteers';
  assert (select count(*) from public.stations where event_id = ev) = 0, 'removes test stations';
end $$;
\echo 'Test-data scripts passed.'
