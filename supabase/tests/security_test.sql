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
  ('00000000-0000-0000-0000-000000000006', 'stranger@example.com', '{"full_name":"Sam Stranger"}'),
  ('00000000-0000-0000-0000-000000000007', 'newlead@example.com',  '{"full_name":"Nia Newlead"}');

do $$ begin
  assert (select count(*) from public.profiles) = 7, 'profiles are created from auth.users';
end $$;

-- Organization without a plan, created through the RPC as the host.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select id from public.create_organization('Pflugerville Band Boosters', 'pf-boosters') \gset org_

do $$ declare new_event_id uuid; begin
  -- Drafts are free, and the host can read the new row back (the app uses
  -- INSERT ... RETURNING, which also has to pass the SELECT policies).
  insert into public.events (organization_id, name, slug, starts_on, ends_on, window_start, window_end, venue_address)
  values ((select id from public.organizations limit 1), 'X', 'xx', current_date, current_date, now(), now() + interval '1 hour', 'addr')
  returning id into new_event_id;
  assert new_event_id is not null, 'host reads back the event they created';
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

insert into public.stations (id, event_id, name, station_type) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Parking', 'passive'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Warm-Up A', 'active_checkpoint');

insert into public.station_leads (station_id, user_id, event_id) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000b');

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
    update public.bands set buses_at = now();
    raise exception 'FAIL: director changed their contest-day status';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000001', 'scratched');
    raise exception 'FAIL: director scratched their own band';
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
    perform public.band_action('40000000-0000-0000-0000-000000000001', 'here', '20000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: a band was tapped in at a regular (non-check-in) station';
  exception when raise_exception then null;
  end;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set performance_order_published = true where id = '10000000-0000-0000-0000-00000000000a';

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
  assert (select count(*) from public.bands) = 0, 'public sees no band registration details';
  begin
    perform 1 from public.volunteers;
    raise exception 'FAIL: the public read the volunteers table';
  exception when insufficient_privilege then null; -- no access at all
  end;
end $$;
reset role;


-- ---------------------------------------------------------------------------
-- Team invitations
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.invitations (event_id, email, role, station_id, invited_by)
values ('10000000-0000-0000-0000-00000000000a', 'NewLead@example.com', 'section_lead',
        '20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001');
select token from public.invitations where email = 'newlead@example.com' \gset inv_

do $$ begin
  begin
    insert into public.invitations (event_id, email, role, station_id, invited_by)
    values ('10000000-0000-0000-0000-00000000000a', 'x@example.com', 'section_lead',
            '20000000-0000-0000-0000-00000000000b', auth.uid());
    raise exception 'FAIL: invited a lead to another event''s station';
  exception when check_violation then null;
  end;
  begin
    insert into public.station_leads (station_id, user_id, event_id)
    values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: made a non-team member a station lead';
  exception when check_violation then null;
  end;
end $$;

-- A Volunteer Director can invite leads but not other directors.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  insert into public.invitations (event_id, email, role, invited_by)
  values ('10000000-0000-0000-0000-00000000000a', 'lead2@example.com', 'section_lead', auth.uid());
  begin
    insert into public.invitations (event_id, email, role, invited_by)
    values ('10000000-0000-0000-0000-00000000000a', 'boss@example.com', 'volunteer_director', auth.uid());
    raise exception 'FAIL: director invited another director';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Strangers can't list invitations, but anyone with the link can read it.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.invitations) = 0, 'stranger cannot list invitations';
end $$;
reset role;
set role anon;
set request.jwt.claims = '';
select set_config('test.token', :'inv_token', false) \g /dev/null
do $$ declare r record; begin
  select * into r from public.get_invitation(current_setting('test.token')::uuid);
  assert r.station_name = 'Parking' and r.event_name = 'Future Classic', 'invite page shows the details';
end $$;
reset role;

-- The wrong person can't accept it; the right one can, and becomes the lead.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.accept_invitation(current_setting('test.token')::uuid);
    raise exception 'FAIL: accepted someone else''s invitation';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","email":"newlead@example.com"}';
select public.accept_invitation(current_setting('test.token')::uuid) \g /dev/null
do $$ begin
  assert exists (select 1 from public.event_staff where user_id = auth.uid() and role = 'section_lead'),
         'accepting adds the person to the team';
  assert exists (select 1 from public.station_leads where station_id = '20000000-0000-0000-0000-00000000000a' and user_id = auth.uid()),
         'accepting makes them a lead of the invited station';
  assert (select count(*) from public.station_leads where station_id = '20000000-0000-0000-0000-00000000000a') = 2,
         'a station can have more than one lead';
  assert (select lead_user_id from public.stations where id = '20000000-0000-0000-0000-00000000000a') = '00000000-0000-0000-0000-000000000003',
         'the first lead stays the volunteers'' contact';
  assert public.leads_station('20000000-0000-0000-0000-00000000000a'), 'a second lead gets lead access';
end $$;

-- The host sees the new lead's name; removing them clears their station.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000007') = 'Nia Newlead',
         'host can see their team''s names';
  delete from public.event_staff where user_id = '00000000-0000-0000-0000-000000000007';
  assert not exists (select 1 from public.station_leads where user_id = '00000000-0000-0000-0000-000000000007'),
         'removing a lead from the team takes them off their stations';
  -- Removing the first lead hands the volunteers' contact to the next one.
  delete from public.station_leads where station_id = '20000000-0000-0000-0000-00000000000a'
     and user_id = '00000000-0000-0000-0000-000000000003';
  assert (select lead_user_id from public.stations where id = '20000000-0000-0000-0000-00000000000a') is null,
         'with no leads left, the station has no contact';
  insert into public.station_leads (station_id, user_id, event_id)
  values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a');
  assert (select lead_user_id from public.stations where id = '20000000-0000-0000-0000-00000000000a') = '00000000-0000-0000-0000-000000000003',
         'adding a lead back makes them the contact';
end $$;

-- ---------------------------------------------------------------------------
-- Rescheduling moves shifts with the event
-- ---------------------------------------------------------------------------
do $$ declare before_start timestamptz; after_start timestamptz; begin
  select starts_at into before_start from public.shifts where id = '30000000-0000-0000-0000-000000000002';
  perform public.reschedule_event('10000000-0000-0000-0000-00000000000a',
    current_date + 12, current_date + 12, now() + interval '12 days', now() + interval '12 days 15 hours',
    'America/Chicago');
  select starts_at into after_start from public.shifts where id = '30000000-0000-0000-0000-000000000002';
  assert after_start - before_start between interval '47 hours' and interval '49 hours',
         format('shift moved two days with the event (%s -> %s)', before_start, after_start);
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    perform public.reschedule_event('10000000-0000-0000-0000-00000000000a',
      current_date, current_date, now(), now() + interval '1 hour', 'America/Chicago');
    raise exception 'FAIL: section lead rescheduled the event';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;


-- ---------------------------------------------------------------------------
-- Public links: event slugs are unique across organizations
-- ---------------------------------------------------------------------------
do $$ begin
  begin
    insert into public.organizations (name, slug, subscription_status) values ('Other Boosters', 'other-boosters', 'comped');
    insert into public.events (organization_id, name, slug, starts_on, ends_on, window_start, window_end, venue_address)
    values ((select id from public.organizations where slug = 'other-boosters'), 'Copy', 'future',
            current_date, current_date, now(), now() + interval '1 hour', 'addr');
    raise exception 'FAIL: two events share a public link';
  exception when unique_violation then null;
  end;
end $$;


-- ---------------------------------------------------------------------------
-- Volunteer passes (no login): a device sees only what it booked
-- ---------------------------------------------------------------------------
set role service_role;
-- Val signs up for another shift at today's event, from "Val's phone".
insert into public.shifts (id, station_id, title, starts_at, ends_at, max_capacity)
values ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-00000000000b', 'Late Crew',
        now() + interval '5 hours', now() + interval '8 hours', 5);
select public.register_volunteer('10000000-0000-0000-0000-00000000000b', 'Val One', 'vol1@example.com', '+15125550104',
       array['30000000-0000-0000-0000-000000000004']::uuid[]) \g /dev/null

do $$ declare
  device_token uuid;      -- what Val's phone keeps after booking "Late Crew"
  email_token uuid;       -- what's in Val's confirmation email
  other_assignment uuid;  -- Val's earlier "Warm-Up Crew" signup
begin
  select va.manage_token into device_token from public.volunteer_assignments va
   where va.shift_id = '30000000-0000-0000-0000-000000000004';
  select v.access_token into email_token from public.volunteers v
   where v.email = 'vol1@example.com' and v.event_id = '10000000-0000-0000-0000-00000000000b';
  select va.id into other_assignment from public.volunteer_assignments va
   where va.shift_id = '30000000-0000-0000-0000-000000000003';

  assert (select count(*) from public.pass_agenda('{}', array[device_token])) = 1,
         'a device pass shows only the shift that device booked';
  assert (select count(*) from public.pass_agenda(array[email_token], '{}')) = 2,
         'the emailed link shows all of that volunteer''s shifts at the event';
  assert (select count(*) from public.pass_agenda(array[gen_random_uuid()], array[gen_random_uuid()])) = 0,
         'made-up tokens show nothing';

  assert not public.cancel_with_pass(other_assignment, '{}', array[device_token]),
         'a device pass cannot cancel a shift it did not book';
  assert exists (select 1 from public.volunteer_assignments where id = other_assignment), 'shift still booked';
  assert public.cancel_with_pass(
           (select id from public.volunteer_assignments where manage_token = device_token), '{}', array[device_token]),
         'a device pass cancels the shift it booked';
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-000000000004') = 0,
         'cancelling with a pass frees the spot';

  assert (select calendar_sequence from public.calendar_entries(array[other_assignment], true)) = 1,
         'calendar updates bump the sequence';
end $$;

-- Someone typing Val's email on the public form can't change her phone number.
select public.register_volunteer('10000000-0000-0000-0000-00000000000b', 'Imposter', 'vol1@example.com', '+19995550000',
       array['30000000-0000-0000-0000-000000000004']::uuid[]) \g /dev/null
do $$ begin
  assert (select phone from public.volunteers where email = 'vol1@example.com'
           and event_id = '10000000-0000-0000-0000-00000000000b') = '+15125550104',
         'public signup does not overwrite an existing volunteer''s details';
end $$;
reset role;

-- Browsers can't read the tokens or call the pass functions.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform access_token from public.volunteers limit 1;
    raise exception 'FAIL: a signed-in user read volunteer access tokens';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pass_agenda(array[gen_random_uuid()], '{}');
    raise exception 'FAIL: a browser called pass_agenda';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.volunteers) >= 1, 'host still reads volunteer names and contacts';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"vol1@example.com"}';
do $$ begin
  assert (select count(*) from public.my_agenda()) >= 1, 'signed-in volunteers still see their agenda';
end $$;
reset role;


-- ---------------------------------------------------------------------------
-- Bands: registration window, running order, public schedule
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ declare n int; begin
  update public.bands set student_count = 118 where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'director edits their band while registration is open';
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set band_registration_open = false where id = '10000000-0000-0000-0000-00000000000a';

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ declare n int; begin
  update public.bands set student_count = 5 where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'director cannot edit after registration closes';
  begin
    perform public.save_performance_order('10000000-0000-0000-0000-00000000000a',
      '[{"band_id":"40000000-0000-0000-0000-000000000001"}]'::jsonb);
    raise exception 'FAIL: a band director set the performance order';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Host saves the order with times.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-000000000005', 'North HS', 'Northern Lights', '6A', 'addr',
        'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 200, 20);
select public.save_performance_order('10000000-0000-0000-0000-00000000000a', jsonb_build_array(
  jsonb_build_object('band_id', '40000000-0000-0000-0000-000000000002', 'perform_at', now() + interval '10 days 2 hours',
                     'warm_up_minutes', 45),
  jsonb_build_object('band_id', '40000000-0000-0000-0000-000000000001', 'perform_at', now() + interval '10 days 3 hours')
)) \g /dev/null
do $$ begin
  assert (select performance_order from public.performance_slots where band_id = '40000000-0000-0000-0000-000000000001') = 2,
         'order follows the list';
  assert (select warm_up_minutes from public.performance_slots where band_id = '40000000-0000-0000-0000-000000000002') = 45,
         'warm-up length is saved';
  begin
    perform public.save_performance_order('10000000-0000-0000-0000-00000000000a',
      '[{"band_id":"40000000-0000-0000-0000-000000000001","warm_up_minutes":20}]'::jsonb);
    raise exception 'FAIL: saved a warm-up length that is not in 15-minute steps';
  exception when check_violation then null;
  end;
  update public.events set ready_minutes_before = 10 where id = '10000000-0000-0000-0000-00000000000a';
  assert (select ready_minutes_before from public.events where id = '10000000-0000-0000-0000-00000000000a') = 10,
         'host sets the ready position';
  begin
    update public.events set ready_minutes_before = 90 where id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: saved a ready position over 60 minutes';
  exception when check_violation then null;
  end;
  begin
    perform public.save_performance_order('10000000-0000-0000-0000-00000000000b',
      '[{"band_id":"40000000-0000-0000-0000-000000000001"}]'::jsonb);
    raise exception 'FAIL: scheduled a band at an event it did not register for';
  exception when check_violation then null;
  end;
end $$;
reset role;

set role anon;
set request.jwt.claims = '';
do $$ declare r record; begin
  select * into r from public.public_schedule('future') limit 1;
  assert r.band_name = 'Northern Lights' and r.performance_order = 1, 'public sees the published running order';
  assert (select count(*) from public.public_schedule('draft')) = 0, 'unpublished events show no schedule';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Breaks and finals
-- ---------------------------------------------------------------------------
-- A band at another event, to try sneaking into these finals.
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000b',
        '00000000-0000-0000-0000-000000000005', 'South HS', 'Southern Sound', '6A', 'addr',
        'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 100, 10);

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, '[]', '[]', '[]');
  raise exception 'FAIL: a band director saved the schedule';
exception when insufficient_privilege then null;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set finals_published = false where id = '10000000-0000-0000-0000-00000000000a';
select public.save_schedule('10000000-0000-0000-0000-00000000000a', 7,
  jsonb_build_array(
    jsonb_build_object('band_id', '40000000-0000-0000-0000-000000000002', 'perform_at', now() + interval '10 days 2 hours'),
    jsonb_build_object('band_id', '40000000-0000-0000-0000-000000000001', 'perform_at', now() + interval '10 days 3 hours')),
  jsonb_build_array(jsonb_build_object('starts_at', now() + interval '10 days 4 hours', 'minutes', 45, 'label', 'Lunch')),
  jsonb_build_array(
    jsonb_build_object('band_id', '40000000-0000-0000-0000-000000000002', 'perform_at', now() + interval '10 days 8 hours',
                       'warm_up_minutes', 30),
    jsonb_build_object('band_id', null, 'perform_at', now() + interval '10 days 9 hours'),
    jsonb_build_object('perform_at', now() + interval '10 days 10 hours'))
) \g /dev/null
do $$ begin
  assert (select ready_minutes_before from public.events where id = '10000000-0000-0000-0000-00000000000a') = 7,
         'schedule save sets the ready position';
  assert (select count(*) from public.performance_slots where event_id = '10000000-0000-0000-0000-00000000000a') = 2,
         'schedule save keeps the running order';
  assert (select count(*) from public.schedule_breaks where event_id = '10000000-0000-0000-0000-00000000000a') = 1,
         'host adds a break';
  assert (select count(*) from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a' and band_id is null) = 2,
         'finals can hold placeholders';
  begin
    perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, '[]', '[]',
      '[{"band_id":"40000000-0000-0000-0000-000000000002"},{"band_id":"40000000-0000-0000-0000-000000000002"}]');
    raise exception 'FAIL: the same band took two finals slots';
  exception when unique_violation then null;
  end;
  begin
    perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, '[]', '[]',
      '[{"band_id":"40000000-0000-0000-0000-000000000003"}]');
    raise exception 'FAIL: a band from another event made the finals';
  exception when check_violation then null;
  end;
  begin
    perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, '[]',
      '[{"starts_at":"2030-01-01T12:00:00Z","minutes":1,"label":"Too short"}]', '[]');
    raise exception 'FAIL: saved a 1-minute break';
  exception when check_violation then null;
  end;
  assert (select count(*) from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a') = 3,
         'a rejected save changes nothing';
end $$;
reset role;

-- Spectators: breaks show with the published order; finals only once published.
set role anon;
set request.jwt.claims = '';
do $$ begin
  assert (select count(*) from public.public_breaks('future')) = 1, 'public sees breaks once the order is published';
  assert (select count(*) from public.public_finals('future')) = 0, 'unpublished finals are hidden';
  assert (select count(*) from public.finals_slots) = 0, 'unpublished finals slots are hidden';
  begin
    perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, '[]', '[]', '[]');
    raise exception 'FAIL: anon saved a schedule';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set finals_published = true where id = '10000000-0000-0000-0000-00000000000a';
reset role;

-- Stage 1/2: the finals schedule is public, but saved finalists stay private.
set role anon;
set request.jwt.claims = '';
do $$ declare r record; begin
  assert (select count(*) from public.public_finals('future')) = 3, 'published finals show every slot';
  select * into r from public.public_finals('future') where slot_number = 1;
  assert r.band_name is null and r.perform_at is not null, 'finalist names stay hidden until revealed';
  assert (select count(*) from public.finals_slots) = 0, 'raw finals rows stay hidden until revealed';
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.finals_slots where band_id = '40000000-0000-0000-0000-000000000002') = 0,
         'a director cannot see their band made the finals before the reveal';
end $$;

-- Stage 3: reveal.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set finalists_revealed = true where id = '10000000-0000-0000-0000-00000000000a';
do $$ begin
  update public.events set finals_published = false where id = '10000000-0000-0000-0000-00000000000a';
  raise exception 'FAIL: unpublished finals while finalists were revealed';
exception when check_violation then null;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.finals_slots where band_id = '40000000-0000-0000-0000-000000000002') = 1,
         'a finalist director sees their finals slot once revealed';
end $$;
reset role;

set role anon;
set request.jwt.claims = '';
do $$ declare r record; begin
  select * into r from public.public_finals('future') where slot_number = 1;
  assert r.band_name = 'Northern Lights', 'finalist names show once revealed';
  select * into r from public.public_finals('future') where slot_number = 2;
  assert r.band_name is null and r.perform_at is not null, 'placeholders show their time without a band';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Registration deadline and the directors' host contact
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set band_registration_open = true, band_registration_deadline = current_date - 2
 where id = '10000000-0000-0000-0000-00000000000a';
insert into public.event_director_contacts (event_id, name, phone, email)
values ('10000000-0000-0000-0000-00000000000a', 'Hana Host', '+15125550101', 'host@example.com');

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ declare n int; begin
  assert not public.band_registration_is_open('10000000-0000-0000-0000-00000000000a'), 'a past deadline closes registration';
  update public.bands set student_count = 7 where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'director cannot edit after the deadline';
  begin
    insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                              contact_email, head_director_name, head_director_email, head_director_phone,
                              student_count, chaperone_count)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000005', 'Late HS', 'Late Band', '6A',
            'addr', 'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 10, 1);
    raise exception 'FAIL: registered after the deadline';
  exception when insufficient_privilege then null;
  end;
  assert (select name from public.event_director_contacts
           where event_id = '10000000-0000-0000-0000-00000000000a') = 'Hana Host',
         'a director with a band at the event sees the host contact';
  begin
    insert into public.event_director_contacts (event_id, name) values ('10000000-0000-0000-0000-00000000000b', 'Me');
    raise exception 'FAIL: a director set the host contact';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set band_registration_deadline = current_date + 2 where id = '10000000-0000-0000-0000-00000000000a';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ declare n int; begin
  update public.bands set student_count = 7 where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'director can edit before the deadline';
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.event_director_contacts) = 0, 'strangers cannot see host contacts';
end $$;
reset role;

set role anon;
do $$ begin
  perform 1 from public.event_director_contacts;
  raise exception 'FAIL: anon read host contacts';
exception when insufficient_privilege then null;
end $$;
reset role;

-- The host's phone reaches directors only the day before and on contest day.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.event_director_contacts (event_id, name, phone, email)
values ('10000000-0000-0000-0000-00000000000b', 'Hana Host', '+15125550101', 'host@example.com');
do $$ begin
  assert public.director_contact_phone('10000000-0000-0000-0000-00000000000a') = '+15125550101',
         'the host always sees their own contact phone';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert public.director_contact_phone('10000000-0000-0000-0000-00000000000a') is null,
         'directors do not get the phone ten days out';
  assert (select has_phone from public.event_director_contacts where event_id = '10000000-0000-0000-0000-00000000000a'),
         'directors can tell a phone number exists';
  assert public.director_contact_phone('10000000-0000-0000-0000-00000000000b') = '+15125550101',
         'directors get the phone on contest day';
  begin
    perform phone from public.event_director_contacts;
    raise exception 'FAIL: a director read the phone column directly';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert public.director_contact_phone('10000000-0000-0000-0000-00000000000b') is null, 'strangers never get the phone';
end $$;
reset role;

-- Finals have their own ready position.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select public.save_schedule('10000000-0000-0000-0000-00000000000a', 6, 10,
  (select coalesce(jsonb_agg(jsonb_build_object('band_id', band_id, 'perform_at', perform_at) order by performance_order), '[]')
     from public.performance_slots where event_id = '10000000-0000-0000-0000-00000000000a'),
  '[]', '[]') \g /dev/null
do $$ begin
  assert (select ready_minutes_before = 6 and finals_ready_minutes_before = 10 from public.events
           where id = '10000000-0000-0000-0000-00000000000a'), 'preliminaries and finals ready positions save separately';
  begin
    perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, 90, '[]', '[]', '[]');
    raise exception 'FAIL: saved a finals ready position over 60 minutes';
  exception when check_violation then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  perform public.save_schedule('10000000-0000-0000-0000-00000000000a', 5, 5, '[]', '[]', '[]');
  raise exception 'FAIL: a band director saved the schedule';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Saving or publishing bumps the schedule version that open pages poll.
create temp table v as select public.schedule_version('future') as before;
grant select on v to authenticated, anon;
select pg_sleep(0.01);
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
-- (a new transaction, so now() moves on)
select public.save_schedule('10000000-0000-0000-0000-00000000000a', 6, 10,
  (select coalesce(jsonb_agg(jsonb_build_object('band_id', band_id, 'perform_at', perform_at) order by performance_order), '[]')
     from public.performance_slots where event_id = '10000000-0000-0000-0000-00000000000a'),
  '[]', '[]') \g /dev/null
reset role;
set role anon;
do $$ begin
  assert public.schedule_version('future') > (select before from v), 'saving the schedule bumps its version';
  assert public.schedule_version('draft') is null, 'unpublished events have no public version';
end $$;
reset role;
drop table v;

-- ---------------------------------------------------------------------------
-- Several Volunteer Leads; several Section Leads per station
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000008', 'second@example.com', '{"full_name":"Val Second"}');
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000008', 'volunteer_director');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000008","email":"second@example.com"}';
do $$ begin
  assert public.can_manage_volunteers('10000000-0000-0000-0000-00000000000a'), 'a second Volunteer Lead can manage volunteers';
  insert into public.station_leads (station_id, user_id, event_id)
  values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-00000000000a');
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.station_leads where station_id = '20000000-0000-0000-0000-00000000000a') = 2,
         'leads see their station''s other leads';
  begin
    insert into public.station_leads (station_id, user_id, event_id)
    values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: a Section Lead added a lead';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.stations set lead_user_id = null where id = '20000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: set the derived lead column directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.station_leads where user_id = '00000000-0000-0000-0000-000000000008';
delete from public.event_staff where user_id = '00000000-0000-0000-0000-000000000008';

-- ---------------------------------------------------------------------------
-- Co-hosts
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000009', 'cohost@example.com', '{"full_name":"Cory Cohost"}');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  insert into public.invitations (event_id, email, as_host, invited_by)
  values ('10000000-0000-0000-0000-00000000000a', 'cohost@example.com', true, auth.uid());
  raise exception 'FAIL: a Volunteer Lead invited a co-host';
exception when insufficient_privilege then null;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.invitations (event_id, email, as_host, invited_by)
values ('10000000-0000-0000-0000-00000000000a', 'cohost@example.com', true, '00000000-0000-0000-0000-000000000001');
select set_config('test.host_token', (select token::text from public.invitations where email = 'cohost@example.com'), false) \g /dev/null
reset role;
set role anon;
do $$ declare r record; begin
  select * into r from public.get_invitation(current_setting('test.host_token')::uuid);
  assert r.as_host and r.role is null, 'the invite page knows it is a co-host invitation';
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000009","email":"cohost@example.com"}';
select public.accept_invitation(current_setting('test.host_token')::uuid) \g /dev/null
do $$ begin
  assert public.is_event_admin('10000000-0000-0000-0000-00000000000a'), 'a co-host can run the organization''s events';
  assert not exists (select 1 from public.event_staff where user_id = auth.uid()), 'a co-host is not event staff';
  begin
    delete from public.organization_members where role = 'owner';
    if found then raise exception 'FAIL: a co-host removed the owner'; end if;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  delete from public.organization_members where user_id = '00000000-0000-0000-0000-000000000009';
  if found then raise exception 'FAIL: a Volunteer Lead removed a co-host'; end if;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000009') = 'Cory Cohost',
         'the host sees their co-host''s name';
  delete from public.organization_members where user_id = '00000000-0000-0000-0000-000000000009';
  assert found, 'the host can remove a co-host';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- What leads see: bands without contact details, the published schedule,
-- and (for Section Leads) volunteer announcements only.
-- ---------------------------------------------------------------------------
update public.events set finalists_revealed = false where id = '10000000-0000-0000-0000-00000000000a';
delete from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a';
insert into public.finals_slots (event_id, slot_number, band_id)
values ('10000000-0000-0000-0000-00000000000a', 1, '40000000-0000-0000-0000-000000000001');
insert into public.announcements (event_id, sender_id, audiences, body) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', '{band_directors}', 'Directors: unload at Lot C');
set role authenticated;

-- Section Lead
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ declare r record; begin
  assert (select count(*) from public.bands) = 0, 'a Section Lead can''t read band registrations';
  select * into r from public.event_bands('10000000-0000-0000-0000-00000000000a')
   where id = '40000000-0000-0000-0000-000000000001';
  assert r.band_name = 'Mighty Marching', 'a Section Lead sees band names';
  assert r.student_count is null, 'a Section Lead doesn''t get headcounts';
  assert r.bus_count = 3, 'a Section Lead sees vehicles (for parking)';
  assert r.special_needs is null, 'accessibility needs stay with hosts';
  assert (select count(*) from public.performance_slots where event_id = '10000000-0000-0000-0000-00000000000a') > 0,
         'a Section Lead sees the published performance order';
  assert (select count(*) from public.finals_slots) = 0, 'a Section Lead can''t see finalists before the reveal';
  assert exists (select 1 from public.announcements where body = 'Lunch is ready'), 'a Section Lead reads volunteer announcements';
  assert not exists (select 1 from public.announcements where body = 'Directors: unload at Lot C'),
         'a Section Lead doesn''t read band-director announcements';
  begin
    insert into public.announcements (event_id, sender_id, audiences, body)
    values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{volunteers}', 'Hi team');
    raise exception 'FAIL: a Section Lead sent an announcement';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Volunteer Lead
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ declare r record; begin
  assert (select count(*) from public.bands) = 0, 'a Volunteer Lead can''t read band contact details';
  select * into r from public.event_bands('10000000-0000-0000-0000-00000000000a')
   where id = '40000000-0000-0000-0000-000000000001';
  assert r.student_count is not null and r.bus_count = 3, 'a Volunteer Lead sees headcounts and vehicles';
  update public.bands set band_name = 'Hacked' where event_id = '10000000-0000-0000-0000-00000000000a';
  if found then raise exception 'FAIL: a Volunteer Lead edited a band'; end if;
  assert (select count(*) from public.finals_slots) = 0, 'a Volunteer Lead can''t see finalists before the reveal';
  assert exists (select 1 from public.announcements where body = 'Directors: unload at Lot C'),
         'a Volunteer Lead reads every announcement';
  insert into public.announcements (event_id, sender_id, audiences, body)
  values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{volunteers}', 'Shirts at the gate');
end $$;

-- Someone outside the event
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.event_bands('10000000-0000-0000-0000-00000000000a')) = 0,
         'outsiders get nothing from event_bands';
end $$;

-- Host still sees everything, including finals before the reveal.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select count(*) from public.bands where event_id = '10000000-0000-0000-0000-00000000000a') > 0, 'the host reads band registrations';
  assert (select count(*) from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a') > 0,
         'the host sees finals before the reveal';
end $$;
reset role;

-- After the reveal, leads see the finals like everyone else.
update public.events set finalists_revealed = true where id = '10000000-0000-0000-0000-00000000000a';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.finals_slots) > 0, 'a Section Lead sees finals once revealed';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Contest day: ordered check-in stations, parking spots, one-tap stops, undo, notes
-- ---------------------------------------------------------------------------
-- Event A's path: 1 Parking (lead@), 2 Check-in table (no lead), 3 Warm-up, 4 Gate (newlead@).
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  update public.stations set checkpoint_kind = 'parking', checkpoint_order = 1, due_minutes_before_warm_up = 60
   where id = '20000000-0000-0000-0000-00000000000a';
  assert found, 'the host sets up a parking check-in station with a deadline';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  update public.stations set due_minutes_before_warm_up = 5 where id = '20000000-0000-0000-0000-00000000000a';
  if found then raise exception 'FAIL: a Section Lead changed their station''s deadline'; end if;
end $$;
reset role;
insert into public.stations (id, event_id, name, station_type, checkpoint_kind, checkpoint_order) values
  ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', 'Check-in table', 'active_checkpoint', 'stop', 2),
  ('20000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-00000000000a', 'Warm-up', 'active_checkpoint', 'warm_up', 3),
  ('20000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-00000000000a', 'Gate', 'active_checkpoint', 'gate', 4);
do $$ begin
  begin
    insert into public.stations (event_id, name, checkpoint_kind) values ('10000000-0000-0000-0000-00000000000a', 'Bad', 'stop');
    raise exception 'FAIL: a check-in station without an order';
  exception when check_violation then null;
  end;
end $$;
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000007', 'section_lead')
on conflict do nothing;
insert into public.station_leads (station_id, user_id, event_id) values
  ('20000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-00000000000a');
update public.bands set special_needs = 'Ramp for the pit' where id = '40000000-0000-0000-0000-000000000001';
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-000000000005', 'West HS', 'West Winds', '5A', 'addr',
        'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 50, 5);
set role authenticated;

-- The parking lead (lead@)
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$
declare park constant uuid := '20000000-0000-0000-0000-00000000000a';
begin
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'buses_here', park);
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'equipment_here', park);
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'equipment_here', park); -- a double tap changes nothing
  assert (select equipment_spot from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000002') = 1, 'first equipment in gets spot 1';
  assert (select count(*) from public.band_activity where band_id = '40000000-0000-0000-0000-000000000002') = 2,
         'each tap is logged once';
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'equipment_here', park);
  assert (select equipment_spot from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001') = 2, 'spots follow arrival order, not performance order';
  -- Away keeps the spot; left for the day frees it for the next band.
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'away', park);
  assert (select equipment_spot from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000002') = 1, 'a band away for lunch keeps its spot';
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'back', park);
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'left', park);
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'equipment_here', park);
  assert (select equipment_spot from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000009') = 1, 'a freed spot goes to the next band';
  begin
    perform public.undo_band_action('40000000-0000-0000-0000-000000000002');
    raise exception 'FAIL: undo gave a spot back to two bands';
  exception when raise_exception then null;
  end;
  perform public.undo_band_action('40000000-0000-0000-0000-000000000009');
  assert (select equipment_spot from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000009') is null, 'undo takes the spot back';
  -- Only at their own stations, and only that station's taps
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', '20000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: a parking lead tapped a band in at the check-in table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', park);
    raise exception 'FAIL: a plain Here tap at parking';
  exception when raise_exception then null;
  end;
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000009', 'scratched');
    raise exception 'FAIL: a Section Lead scratched a band';
  exception when insufficient_privilege then null;
  end;
  -- Notes
  insert into public.band_notes (band_id, body) values ('40000000-0000-0000-0000-000000000002', 'Lunch off campus, back 1:00');
  assert (select event_id from public.band_notes where body like 'Lunch%') = '10000000-0000-0000-0000-00000000000a',
         'a note takes its band''s event';
  assert (select author_name from public.band_notes where body like 'Lunch%') = 'Lee Lead', 'a note shows who wrote it';
  assert (select actor_name from public.band_activity order by id desc limit 1) = 'Lee Lead', 'a tap shows who made it';
  assert (select special_needs from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001') is null, 'accessibility needs stay with hosts';
end $$;

-- The gate lead (newlead@): Here and Performed, per round
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","email":"newlead@example.com"}';
do $$
declare gate constant uuid := '20000000-0000-0000-0000-0000000000c3';
begin
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', gate);
    raise exception 'FAIL: a gate tap without a round';
  exception when raise_exception then null;
  end;
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', gate, 'prelims');
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', gate, 'prelims'); -- double tap
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'performed', gate, 'prelims');
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', gate, 'finals');
  assert (select count(*) from public.band_stops where band_id = '40000000-0000-0000-0000-000000000009') = 3,
         'prelims and finals stops are kept apart, once each';
  perform public.undo_band_action('40000000-0000-0000-0000-000000000009');
  assert not exists (select 1 from public.band_stops where band_id = '40000000-0000-0000-0000-000000000009' and round = 'finals'),
         'undo removes the latest stop';
end $$;

-- The Volunteer Lead can tap anywhere and scratch; a lead can't undo their taps.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'here', '20000000-0000-0000-0000-0000000000c1');
  perform public.band_action('40000000-0000-0000-0000-000000000009', 'scratched');
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000009', 'performed', '20000000-0000-0000-0000-0000000000c2', 'prelims');
    raise exception 'FAIL: Performed tapped at warm-up';
  exception when raise_exception then null;
  end;
  insert into public.band_notes (band_id, body) values ('40000000-0000-0000-0000-000000000009', 'Director called: running late');
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    perform public.undo_band_action('40000000-0000-0000-0000-000000000009');
    raise exception 'FAIL: a Section Lead undid someone else''s tap';
  exception when insufficient_privilege then null;
  end;
  delete from public.band_notes where body like 'Director called%';
  if found then raise exception 'FAIL: a Section Lead deleted someone else''s note'; end if;
  delete from public.band_notes where body like 'Lunch%';
  assert found, 'a lead deletes their own note';
  assert (select count(*) from public.band_stops where band_id = '40000000-0000-0000-0000-000000000009') = 3,
         'the whole team sees where bands have been';
end $$;

-- Directors and outsiders see none of it.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.band_notes) = 0, 'directors don''t see the team''s notes';
  assert (select count(*) from public.band_activity) = 0, 'directors don''t see the activity log';
  assert (select count(*) from public.band_stops) = 0, 'directors don''t see the stops log';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000001', 'buses_here', '20000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: an outsider tapped a band in';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.band_notes (band_id, body) values ('40000000-0000-0000-0000-000000000001', 'hi');
    raise exception 'FAIL: an outsider left a note';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The host sees accessibility needs.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select special_needs from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001') = 'Ramp for the pit', 'the host sees accessibility needs';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Running behind: push the rest of the schedule back
-- ---------------------------------------------------------------------------
delete from public.schedule_breaks where event_id = '10000000-0000-0000-0000-00000000000a';
delete from public.performance_slots where event_id = '10000000-0000-0000-0000-00000000000a';
delete from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a';
insert into public.performance_slots (band_id, event_id, performance_order, warm_up_at, perform_at) values
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 1, '2030-01-01 09:00+00', '2030-01-01 10:00+00'),
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 2, '2030-01-01 09:15+00', '2030-01-01 10:15+00'),
  ('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-00000000000a', 3, '2030-01-01 09:30+00', '2030-01-01 10:30+00');
insert into public.schedule_breaks (event_id, starts_at, minutes, label) values
  ('10000000-0000-0000-0000-00000000000a', '2030-01-01 09:55+00', 5, 'Before band 1'),
  ('10000000-0000-0000-0000-00000000000a', '2030-01-01 10:10+00', 5, 'Between 1 and 2'),
  ('10000000-0000-0000-0000-00000000000a', '2030-01-01 18:30+00', 30, 'Before finals');
insert into public.finals_slots (event_id, slot_number, band_id, warm_up_at, perform_at) values
  ('10000000-0000-0000-0000-00000000000a', 1, '40000000-0000-0000-0000-000000000002', '2030-01-01 18:00+00', '2030-01-01 19:00+00');
set role authenticated;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  begin
    perform public.push_schedule_back('10000000-0000-0000-0000-00000000000a', 2, 10, false);
    raise exception 'FAIL: a Volunteer Lead moved the schedule';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ declare moved int; begin
  begin
    perform public.push_schedule_back('10000000-0000-0000-0000-00000000000a', 2, 0, false);
    raise exception 'FAIL: pushed back by 0 minutes';
  exception when raise_exception then null;
  end;
  select count(*) into moved from public.push_schedule_back('10000000-0000-0000-0000-00000000000a', 2, 10, false);
  assert moved = 2, format('bands #2 and #3 move (got %s)', moved);
  assert (select perform_at from public.performance_slots where performance_order = 1
           and event_id = '10000000-0000-0000-0000-00000000000a') = '2030-01-01 10:00+00', 'band #1 stays put';
  assert (select warm_up_at = '2030-01-01 09:25+00' and perform_at = '2030-01-01 10:25+00' from public.performance_slots
           where performance_order = 2 and event_id = '10000000-0000-0000-0000-00000000000a'), 'band #2 moves 10 minutes later';
  assert (select starts_at from public.schedule_breaks where label = 'Before band 1') = '2030-01-01 09:55+00',
         'a break before the first moved band stays put';
  assert (select starts_at from public.schedule_breaks where label = 'Between 1 and 2') = '2030-01-01 10:20+00',
         'a break after the band before moves';
  assert (select starts_at from public.schedule_breaks where label = 'Before finals') = '2030-01-01 18:30+00',
         'finals breaks stay put unless finals move';
  assert (select perform_at from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a') = '2030-01-01 19:00+00',
         'finals stay put unless asked';
  select count(*) into moved from public.push_schedule_back('10000000-0000-0000-0000-00000000000a', 3, 5, true);
  assert moved = 2, format('band #3 and the finalist move (got %s)', moved);
  assert (select perform_at from public.finals_slots where event_id = '10000000-0000-0000-0000-00000000000a') = '2030-01-01 19:05+00',
         'finals move when asked';
  assert (select starts_at from public.schedule_breaks where label = 'Before finals') = '2030-01-01 18:35+00',
         'finals breaks move with the finals';
end $$;
reset role;

\echo 'All database security tests passed.'
