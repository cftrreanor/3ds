-- Behavioural tests for the core schema: capacity locking, time-gated contact
-- details and role permissions. Run with: npm run test:db
-- Every check raises an exception on failure, so the script stops at the first
-- broken rule.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'host@example.com',     '{"full_name":"Hana Host"}'),
  ('00000000-0000-0000-0000-000000000002', 'director@example.com', '{"full_name":"Dee Director"}'),
  ('00000000-0000-0000-0000-000000000003', 'lead@example.com',     '{"full_name":"Lee Lead","phone":"+15125550103"}'),
  ('00000000-0000-0000-0000-000000000004', 'vol1@example.com',     '{"full_name":"Val One"}'),
  ('00000000-0000-0000-0000-000000000005', 'band@example.com',     '{"full_name":"Bo Band"}'),
  ('00000000-0000-0000-0000-000000000006', 'stranger@example.com', '{"full_name":"Sam Stranger"}');

do $$ begin
  assert (select count(*) from public.profiles) = 6, 'profiles are created from auth.users';
end $$;

-- Organization without a plan, created through the RPC as the host.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select id from public.create_organization('Pflugerville Band Boosters', 'pf-boosters') \gset org_

do $$ begin
  -- Drafts are free...
  insert into public.events (organization_id, name, slug, starts_on, ends_on, window_start, window_end, venue_address)
  values ((select id from public.organizations limit 1), 'X', 'xx', current_date, current_date, now(), now() + interval '1 hour', 'addr');
  -- ...but publishing needs a plan, whether on insert or by update.
  begin
    insert into public.events (organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
    values ((select id from public.organizations limit 1), 'Y', 'yy', 'published', current_date, current_date, now(), now() + interval '1 hour', 'addr');
    raise exception 'FAIL: published an event without an active plan';
  exception when insufficient_privilege then null; -- RLS rejection
  end;
  begin
    update public.events set status = 'published' where slug = 'xx';
    raise exception 'FAIL: published a draft without an active plan';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set email = 'hijack@example.com' where id = auth.uid();
    raise exception 'FAIL: user changed their own login email in profiles';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set full_name = 'Hana Host', phone = '+15125550101' where id = auth.uid();
  begin
    update public.organizations set subscription_status = 'active';
    raise exception 'FAIL: host changed their own billing status';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

delete from public.events where slug = 'xx';
update public.organizations set subscription_status = 'comped';

-- Two events: one 10 days out (contacts locked) and one today (unlocked).
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end,
                           venue_address, volunteer_signup_open, band_registration_open)
values
  ('10000000-0000-0000-0000-00000000000a', :'org_id', 'Future Classic', 'future', 'published',
   current_date + 10, current_date + 10, now() + interval '10 days', now() + interval '10 days 15 hours',
   '1 Stadium Rd', true, true),
  ('10000000-0000-0000-0000-00000000000b', :'org_id', 'Today Invitational', 'today', 'published',
   (now() at time zone 'America/Chicago')::date, (now() at time zone 'America/Chicago')::date,
   now() - interval '1 hour', now() + interval '10 hours', '2 Stadium Rd', true, true),
  ('10000000-0000-0000-0000-00000000000c', :'org_id', 'Secret Draft', 'draft', 'draft',
   current_date + 30, current_date + 30, now() + interval '30 days', now() + interval '30 days 5 hours',
   '3 Stadium Rd', false, false);

insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'volunteer_director'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', 'section_lead'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000003', 'section_lead');

insert into public.stations (id, event_id, name, station_type, lead_user_id) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Parking', 'passive',
   '00000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Warm-Up A', 'active_checkpoint',
   '00000000-0000-0000-0000-000000000003');

insert into public.shifts (id, station_id, title, starts_at, ends_at, max_capacity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', 'Morning Parking',
   now() + interval '10 days', now() + interval '10 days 3 hours', 1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', 'Overlapping Parking',
   now() + interval '10 days 1 hour', now() + interval '10 days 4 hours', 5),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000b', 'Warm-Up Crew',
   now(), now() + interval '3 hours', 5);

do $$ begin
  assert (select event_id from public.shifts where id = '30000000-0000-0000-0000-000000000003')
         = '10000000-0000-0000-0000-00000000000b', 'shift.event_id is derived from its station';
  begin
    update public.shifts set registered_count = 0;
    raise exception 'FAIL: user wrote registered_count';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Volunteer signup: capacity, overlap, all-or-nothing
-- ---------------------------------------------------------------------------
set role service_role;
select public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Val One', 'Vol1@Example.com', '+15125550104',
       array['30000000-0000-0000-0000-000000000001']::uuid[]);
select public.register_volunteer('10000000-0000-0000-0000-00000000000b', 'Val One', 'vol1@example.com', '+15125550104',
       array['30000000-0000-0000-0000-000000000003']::uuid[]);

do $$ begin
  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Late Larry', 'larry@example.com', '+15125550199',
            array['30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001']::uuid[]);
    raise exception 'FAIL: overbooked a full shift';
  exception when sqlstate 'P0002' then null;
  end;
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-000000000002') = 0,
         'failed signup must not book any of the requested shifts';
  assert not exists (select 1 from public.volunteers where email = 'larry@example.com'),
         'failed signup must not leave a volunteer record behind';

  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Val One', 'vol1@example.com', '+15125550104',
            array['30000000-0000-0000-0000-000000000002']::uuid[]);
    raise exception 'FAIL: allowed overlapping shifts';
  exception when sqlstate 'P0003' then null;
  end;

  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000c', 'Val One', 'vol1@example.com', '+15125550104',
            array[]::uuid[]);
    raise exception 'FAIL: signed up for an unpublished event';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
reset role;

do $$ begin
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-000000000001') = 1,
         'registered_count incremented';
end $$;

-- The browser (anon) cannot call signup directly.
set role anon;
do $$ begin
  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'X', 'x@example.com', '1',
            array['30000000-0000-0000-0000-000000000002']::uuid[]);
    raise exception 'FAIL: anon called register_volunteer';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Time-gated contact details for Section Leads (PRD §6.2)
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ declare r record; begin
  select * into r from public.station_roster('20000000-0000-0000-0000-00000000000a');
  assert r.volunteer_name = 'Val One', 'lead sees names before event day';
  assert r.email is null and r.phone is null and r.contact_locked, 'lead must NOT see contacts before event day';

  select * into r from public.station_roster('20000000-0000-0000-0000-00000000000b');
  assert r.phone = '+15125550104' and not r.contact_locked, 'lead sees contacts on event day';

  assert (select count(*) from public.volunteers) = 0, 'lead has no direct access to the volunteers table';
end $$;

-- Volunteer Director always sees contacts.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ declare r record; begin
  select * into r from public.station_roster('20000000-0000-0000-0000-00000000000a');
  assert r.phone is not null, 'director sees contacts before event day';
  assert (select count(*) from public.volunteers) = 1, 'director sees their event''s volunteers only';
end $$;

-- A stranger is refused.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.station_roster('20000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: stranger read a roster';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.volunteers) = 0, 'stranger sees no volunteers';
  assert (select count(*) from public.my_agenda()) = 0, 'stranger has no agenda';
end $$;

-- ---------------------------------------------------------------------------
-- Volunteer dashboard
-- ---------------------------------------------------------------------------
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"vol1@example.com"}';
do $$ declare n int; begin
  select count(*) into n from public.my_agenda();
  assert n = 2, format('volunteer sees one agenda across events (got %s)', n);
  assert (select lead_phone from public.my_agenda() limit 1) = '+15125550103', 'volunteer sees their lead''s phone';
  assert (select count(*) from public.volunteers) = 2, 'volunteer reads only their own records';
end $$;

-- Volunteer cancels their own shift; the slot is released.
select public.cancel_assignment(va.id)
  from public.volunteer_assignments va where va.shift_id = '30000000-0000-0000-0000-000000000001';
reset role;
do $$ begin
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-000000000001') = 0,
         'cancel releases the slot';
end $$;

-- ---------------------------------------------------------------------------
-- Bands
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  begin
    insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                              contact_email, head_director_name, head_director_email, head_director_phone,
                              student_count, chaperone_count)
    values ('10000000-0000-0000-0000-00000000000a', auth.uid(), 'Central HS', 'Mighty Marching', '5A', 'addr',
            'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 120, 26);
    raise exception 'FAIL: allowed 26 chaperones';
  exception when check_violation then null;
  end;
end $$;

insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count, bus_count)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-000000000005', 'Central HS', 'Mighty Marching', '5A', 'addr',
        'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 120, 25, 3);

do $$ begin
  begin
    update public.bands set status = 'performed';
    raise exception 'FAIL: director changed their checkpoint status';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_band_status('40000000-0000-0000-0000-000000000001', 'checked_in');
    raise exception 'FAIL: director used set_band_status';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Host drafts the performance order privately.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.performance_slots (band_id, event_id, performance_order)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 1);

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.performance_slots) = 0, 'order hidden until published';
end $$;

-- Checkpoint lead (of an active checkpoint) moves the band along.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    perform public.set_band_status('40000000-0000-0000-0000-000000000001', 'checked_in');
    raise exception 'FAIL: lead of a passive station at event A changed band status';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set performance_order_published = true where id = '10000000-0000-0000-0000-00000000000a';
select public.set_band_status('40000000-0000-0000-0000-000000000001', 'checked_in');

-- ---------------------------------------------------------------------------
-- Announcements and the public view
-- ---------------------------------------------------------------------------
insert into public.announcements (event_id, sender_id, audiences, priority, body) values
  ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{public}', 'emergency', 'Lightning — take shelter'),
  ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{volunteers}', 'routine', 'Lunch is ready');

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  begin
    insert into public.announcements (event_id, sender_id, audiences, body)
    values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{public}', 'Hi everyone');
    raise exception 'FAIL: volunteer director sent a global broadcast';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role anon;
set request.jwt.claims = '';
do $$ begin
  assert (select count(*) from public.events) = 2, 'public sees published events only';
  assert (select count(*) from public.announcements) = 1, 'public sees public announcements only';
  assert (select count(*) from public.performance_slots) = 1, 'public sees the published order';
  assert (select count(*) from public.volunteers) = 0, 'public sees no volunteers';
  assert (select count(*) from public.bands) = 0, 'public sees no band registration details';
end $$;
reset role;

\echo 'All database security tests passed.'
