-- =============================================================================
-- Remove the test data that add-test-data.sql added to one event.
--
-- HOW TO USE (Supabase -> SQL Editor -> + New query):
--   1. Paste this whole file.
--   2. On the line below, replace my-test-event with your event's link name.
--   3. Click Run.
--
-- Only removes fake records (emails ending in @resend.dev) and stations whose
-- name ends in "(test)". Real volunteers and bands are left alone.
-- =============================================================================
select set_config('test_data.event_slug', 'my-test-event', false);

do $$
declare
  ev public.events;
begin
  select * into ev from public.events where slug = current_setting('test_data.event_slug');
  if ev.id is null then
    raise exception 'No event has the link name "%". Check step 2 at the top of this file.',
      current_setting('test_data.event_slug');
  end if;

  -- Give the spots back on the shifts the test volunteers were signed up for.
  update public.shifts s
     set registered_count = s.registered_count - x.n
    from (select a.shift_id, count(*)::int as n
            from public.volunteer_assignments a
            join public.volunteers v on v.id = a.volunteer_id
           where v.event_id = ev.id and v.email like '%@resend.dev'
           group by a.shift_id) x
   where s.id = x.shift_id;

  delete from public.volunteers where event_id = ev.id and email like '%@resend.dev';
  delete from public.bands where event_id = ev.id and contact_email like '%@resend.dev';
  delete from public.stations where event_id = ev.id and name like '%(test)';
end $$;

select 'Test data removed.' as result;
