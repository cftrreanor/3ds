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

-- Hosts are invited by FieldCommand: without an invitation, nobody can create an organization.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert not public.has_host_invitation(), 'no invitation for a stranger';
  begin
    perform public.create_organization('Stranger Boosters', 'stranger-boosters');
    raise exception 'FAIL: created an organization without an invitation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_invite_host('stranger@example.com');
    raise exception 'FAIL: a non-admin invited a host';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.host_invitations) = 0, 'invitations are hidden from non-admins';
end $$;
reset role;
insert into public.host_invitations (email) values ('host@example.com');

-- Organization without a plan, created through the RPC as the (invited) host.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select public.has_host_invitation() as invited \gset
\if :invited
\else
  \echo 'FAIL: the invited host has no invitation'
  select 1/0;
\endif
select id from public.create_organization('Pflugerville Band Boosters', 'pf-boosters') \gset org_
do $$ begin
  assert not public.has_host_invitation(), 'an invitation is used up by creating the organization';
  begin
    perform public.create_organization('Second Boosters', 'second-boosters');
    raise exception 'FAIL: one invitation created two organizations';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A new account starts on the pilot; take it to "No plan" to check publishing needs one.
reset role;
update public.organizations set subscription_status = 'none', free_until = null;
set role authenticated;
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

-- People join a team by accepting an invitation; set the team up directly here.
reset role;
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'volunteer_director'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', 'section_lead'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role authenticated;
-- A host can't add someone to the team without their say-so (their profile, email
-- and phone would then be readable by the host).
do $$ begin
  begin
    insert into public.event_staff (event_id, user_id, role)
    values ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000006', 'section_lead');
    raise exception 'FAIL: a host added a stranger to the team directly';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000006') = 0,
         'a host can''t read a stranger''s profile';
end $$;

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
-- A host can't register a band in someone else's name (it would show that
-- person's email in past_band_directors()).
do $$ begin
  begin
    insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                              contact_email, head_director_name, head_director_email, head_director_phone,
                              student_count, chaperone_count)
    values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000006', 'X HS', 'X', '6A', 'addr',
            'x@example.com', 'X', 'x@example.com', '+15125550199', 1, 1);
    raise exception 'FAIL: a host registered a band for another user';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A second band from the same director (set up directly).
reset role;
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-000000000005', 'North HS', 'Northern Lights', '6A', 'addr',
        'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 200, 20);
set role authenticated;
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

-- ---------------------------------------------------------------------------
-- Live status for directors and the public
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert exists (select 1 from public.my_band_progress('40000000-0000-0000-0000-000000000009')
                  where checkpoint_kind = 'gate' and round = 'prelims' and performed),
         'a director sees their band performed';
  assert (select count(distinct station_id) from public.my_band_progress('40000000-0000-0000-0000-000000000009')) = 4,
         'a director sees every stop on the path';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.my_band_progress('40000000-0000-0000-0000-000000000009')) = 0,
         'nobody else sees a band''s progress';
end $$;
reset role;
set role anon;
set request.jwt.claims = '';
do $$ declare r record; begin
  begin
    perform public.my_band_progress('40000000-0000-0000-0000-000000000009');
    raise exception 'FAIL: the public read a band''s progress';
  exception when insufficient_privilege then null;
  end;
  select * into r from public.public_progress('future') where round = 'prelims' and number = 3;
  assert r.performed and r.scratched, 'the public sees performed and withdrawn';
  select * into r from public.public_progress('future') where round = 'prelims' and number = 2;
  assert not r.performed and not r.at_gate, 'bands not yet at the gate show as such';
  assert (select count(*) from public.public_progress('draft')) = 0, 'nothing for unpublished events';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Tap a done step again to take it back
-- ---------------------------------------------------------------------------
update public.bands set buses_at = null, equipment_at = null, equipment_spot = null, away_at = null, left_at = null, scratched_at = null
 where event_id = '10000000-0000-0000-0000-00000000000a';
delete from public.band_stops where event_id = '10000000-0000-0000-0000-00000000000a';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$
declare park constant uuid := '20000000-0000-0000-0000-00000000000a';
begin
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'buses_here', park);
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_buses', park);
  assert (select buses_at from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001') is null, 'tapping Buses again takes it back';
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'equipment_here', park);
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_equipment', park);
  assert (select equipment_spot is null and equipment_at is null from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001'), 'taking equipment back frees the spot';
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'equipment_here', park);
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'left', park);
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_left', park);
  assert (select left_at is null and equipment_spot = 1 from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001'), 'taking "left" back returns the band to its spot';
  -- Spot 1 taken while they were gone: they get the next free one.
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'left', park);
  perform public.band_action('40000000-0000-0000-0000-000000000002', 'equipment_here', park);
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_left', park);
  assert (select equipment_spot from public.event_bands('10000000-0000-0000-0000-00000000000a')
           where id = '40000000-0000-0000-0000-000000000001') = 2, 'a band coming back gets a free spot if theirs was taken';
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_here', '20000000-0000-0000-0000-0000000000c3', 'prelims');
    raise exception 'FAIL: a parking lead took back a gate tap';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","email":"newlead@example.com"}';
do $$
declare gate constant uuid := '20000000-0000-0000-0000-0000000000c3';
begin
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'here', gate, 'prelims');
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'performed', gate, 'prelims');
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_performed', gate, 'prelims');
  assert (select count(*) from public.band_stops where band_id = '40000000-0000-0000-0000-000000000001') = 1,
         'taking Performed back leaves Here';
  perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_here', gate, 'prelims');
  assert not exists (select 1 from public.band_stops where band_id = '40000000-0000-0000-0000-000000000001'),
         'taking Here back removes the stop';
  begin
    perform public.band_action('40000000-0000-0000-0000-000000000001', 'clear_buses', gate);
    raise exception 'FAIL: a parking take-back at the gate';
  exception when raise_exception then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Pilot requests: only platform admins can read them; no one writes from a browser
-- ---------------------------------------------------------------------------
insert into public.pilot_requests (name, email, organization, bands, volunteers)
values ('Pat Pilot', 'pat@example.com', 'Lakeside Band Boosters', 20, 150);
set role anon;
set request.jwt.claims = '{}';
do $$ begin
  begin
    insert into public.pilot_requests (name, email, organization) values ('Spam Bot', 'bot@example.com', 'Spam');
    raise exception 'FAIL: a visitor wrote a pilot request straight to the table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.pilot_requests;
    raise exception 'FAIL: a visitor read pilot requests';
  exception when insufficient_privilege then null;
  end;
end $$;
set role authenticated;
-- The host of an organization is not FieldCommand staff.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert not public.is_platform_admin(), 'a host is not a platform admin';
  assert (select count(*) from public.pilot_requests) = 0, 'a host can''t read pilot requests';
  update public.pilot_requests set status = 'invited';
  begin
    insert into public.platform_admins (user_id) values (auth.uid());
    raise exception 'FAIL: a user made themselves a platform admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.platform_admins;
    raise exception 'FAIL: a user read the platform admin list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select status from public.pilot_requests where email = 'pat@example.com') = 'new', 'a host can''t change a pilot request';
end $$;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert public.is_platform_admin(), 'an admin is a platform admin';
  assert (select count(*) from public.pilot_requests) = 1, 'a platform admin reads pilot requests';
  update public.pilot_requests set status = 'contacted' where email = 'pat@example.com';
  assert (select status from public.pilot_requests where email = 'pat@example.com') = 'contacted', 'a platform admin marks a request contacted';
  begin
    update public.pilot_requests set email = 'changed@example.com';
    raise exception 'FAIL: a platform admin rewrote what someone submitted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.pilot_requests;
    raise exception 'FAIL: deleted pilot requests from a browser';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.platform_admins;

-- ---------------------------------------------------------------------------
-- Invitation emails: the secret one-tap key never reaches a browser
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.invitations (event_id, email, role, invited_by)
values ('10000000-0000-0000-0000-00000000000a', 'mailme@example.com', 'section_lead', '00000000-0000-0000-0000-000000000001');
insert into public.invitations (event_id, email, as_host, invited_by)
values ('10000000-0000-0000-0000-00000000000a', 'hostmail@example.com', true, '00000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    perform email_token from public.invitations;
    raise exception 'FAIL: a host read the secret email key';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('test.key_before', (select email_token::text from public.invitations where email = 'mailme@example.com'), false) \g /dev/null
update public.invitations set expires_at = now() - interval '1 day' where email = 'mailme@example.com';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare r record;
begin
  select * into r from public.prepare_invitation_email((select id from public.invitations where email = 'mailme@example.com'));
  assert r.email = 'mailme@example.com' and r.role = 'section_lead' and r.inviter_name = 'Hana Host', 'the email gets the invitation details';
  assert r.expires_at > now() + interval '29 days', 'resending an expired invitation gives it another 30 days';
end $$;
-- (Sending again within 5 minutes is refused: tested at the end. Clear it for the next check.)
reset role;
update public.invitations set sent_at = null where email = 'mailme@example.com';
set role authenticated;
-- A Volunteer Lead can send Section Lead invitations, not co-host ones.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  perform public.prepare_invitation_email((select id from public.invitations where email = 'mailme@example.com'));
  begin
    perform public.prepare_invitation_email((select id from public.invitations where email = 'hostmail@example.com'));
    raise exception 'FAIL: a Volunteer Lead sent a co-host invitation';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.prepare_invitation_email((select id from public.invitations where email = 'mailme@example.com'));
    raise exception 'FAIL: a stranger sent an invitation';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select email_token::text from public.invitations where email = 'mailme@example.com') <> current_setting('test.key_before'),
         'sending makes a new secret key, so older emails stop working';
  assert (select sent_at is not null from public.invitations where email = 'mailme@example.com'), 'sending is recorded';
end $$;
delete from public.invitations where email in ('mailme@example.com', 'hostmail@example.com');

-- ---------------------------------------------------------------------------
-- Removed team members are listed (to the right people) and cleared on return
-- ---------------------------------------------------------------------------
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000004', 'section_lead');
insert into public.organization_members (organization_id, user_id, role)
select organization_id, '00000000-0000-0000-0000-000000000004', 'admin' from public.events where id = '10000000-0000-0000-0000-00000000000a';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
delete from public.event_staff where event_id = '10000000-0000-0000-0000-00000000000a'
   and user_id = '00000000-0000-0000-0000-000000000004' and role = 'section_lead';
delete from public.organization_members where user_id = '00000000-0000-0000-0000-000000000004';
do $$ begin
  assert (select count(*) from public.team_removals where user_id = '00000000-0000-0000-0000-000000000004') = 2,
         'the host sees the removed Section Lead and co-host';
  assert (select removed_by from public.team_removals where role = 'section_lead' and user_id = '00000000-0000-0000-0000-000000000004')
         = '00000000-0000-0000-0000-000000000001', 'who removed them is recorded';
  begin
    insert into public.team_removals (organization_id, role, user_id, email)
    select organization_id, 'co_host', auth.uid(), 'x@example.com' from public.events limit 1;
    raise exception 'FAIL: wrote a removal record directly';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert (select array_agg(role) from public.team_removals where user_id = '00000000-0000-0000-0000-000000000004') = array['section_lead'],
         'a Volunteer Lead sees removed leads, not removed co-hosts';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.team_removals) = 0, 'a Section Lead sees no removals';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.team_removals) = 0, 'a stranger sees no removals';
end $$;
reset role;
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000004', 'section_lead');
do $$ begin
  assert not exists (select 1 from public.team_removals where role = 'section_lead' and user_id = '00000000-0000-0000-0000-000000000004'),
         'joining again clears the removal';
end $$;
-- Deleting an event doesn't trip over its team being removed.
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000004', 'section_lead');
delete from public.events where id = '10000000-0000-0000-0000-00000000000c';
do $$ begin
  assert not exists (select 1 from public.team_removals where event_id = '10000000-0000-0000-0000-00000000000c'),
         'deleting an event leaves no removal records';
end $$;

-- ---------------------------------------------------------------------------
-- Walk-up volunteers: the desk adds them (checked in), even to a full shift
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$
declare a uuid; before int;
begin
  select registered_count into before from public.shifts where id = '30000000-0000-0000-0000-000000000002';
  a := public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Wally Walkup', '+15125550190');
  assert (select checked_in_at is not null from public.volunteer_assignments
           where volunteer_id = a and shift_id = '30000000-0000-0000-0000-000000000002'), 'a walk-up is checked in right away';
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-000000000002') = before + 1, 'a walk-up takes a spot';
  assert (select walk_up and email is null from public.volunteers where phone = '+15125550190'), 'a walk-up needs no email';
  begin
    perform public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Wally Walkup', '+15125550190');
    raise exception 'FAIL: the same walk-up added to a shift twice';
  exception when raise_exception then null;
  end;
end $$;
-- A full shift asks first, then grows by one.
reset role;
update public.shifts set max_capacity = registered_count where id = '30000000-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$
declare cap int;
begin
  select max_capacity into cap from public.shifts where id = '30000000-0000-0000-0000-000000000002';
  begin
    perform public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Fiona Full', '+15125550191');
    raise exception 'FAIL: a walk-up went into a full shift without asking';
  exception when sqlstate 'P0004' then null;
  end;
  perform public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Fiona Full', '+15125550191', true);
  assert (select max_capacity from public.shifts where id = '30000000-0000-0000-0000-000000000002') = cap + 1,
         'adding anyway makes room for one more';
end $$;
-- Section Leads and strangers can't add walk-ups.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    perform public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Sly Lead', '+15125550192');
    raise exception 'FAIL: a Section Lead added a walk-up';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Sam Stranger', '+15125550193');
    raise exception 'FAIL: a stranger added a walk-up';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.add_walk_up('30000000-0000-0000-0000-000000000002', 'Anon', '+15125550194');
    raise exception 'FAIL: a visitor added a walk-up';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Signing up with others, minors, and name-only walk-ups
-- ---------------------------------------------------------------------------
insert into public.shifts (id, station_id, title, starts_at, ends_at, max_capacity) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', 'Family Parking',
   now() + interval '11 days', now() + interval '11 days 2 hours', 3),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a', 'Tiny Parking',
   now() + interval '12 days', now() + interval '12 days 2 hours', 1);
set role service_role;
select public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Pat Pair', 'pat.pair@example.com', '+15125550170',
       array['30000000-0000-0000-0000-0000000000a1']::uuid[], false,
       '[{"name": "Sam Pair"}, {"name": "Kid Pairson Junior", "minor": true}]'::jsonb) \g /dev/null
do $$
declare primary_id uuid;
begin
  select id into primary_id from public.volunteers where email = 'pat.pair@example.com';
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-0000000000a1') = 3,
         'everyone in a signup takes a spot';
  assert (select count(*) from public.volunteers where contact_id = primary_id and phone = '+15125550170' and email is null) = 2,
         'the people added share the signer''s phone and have no email';
  assert exists (select 1 from public.volunteers where contact_id = primary_id and minor and full_name = 'Kid Pairson J.'),
         'a minor is stored as first name + last initial';
  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Duo One', 'duo@example.com', '+15125550171',
            array['30000000-0000-0000-0000-0000000000a2']::uuid[], false, '[{"name": "Duo Two"}]'::jsonb);
    raise exception 'FAIL: a group of 2 got the last 1 spot';
  exception when sqlstate 'P0002' then null;
  end;
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-0000000000a2') = 0
     and not exists (select 1 from public.volunteers where email = 'duo@example.com'), 'a group that doesn''t fit books no one';
  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Big Group', 'big@example.com', '+15125550172',
            array['30000000-0000-0000-0000-0000000000a2']::uuid[], false,
            '[{"name":"A"},{"name":"B"},{"name":"C"},{"name":"D"},{"name":"E"}]'::jsonb);
    raise exception 'FAIL: added more than 4 people';
  exception when sqlstate 'P0001' then null;
  end;
  perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Teen Volunteer', 'guardian@example.com', '+15125550173',
          array['30000000-0000-0000-0000-0000000000a2']::uuid[], true, '[]'::jsonb);
  assert (select full_name from public.volunteers where email = 'guardian@example.com') = 'Teen V.',
         'a minor signing up for themselves keeps only their last initial';
end $$;
reset role;
do $$ begin
  begin
    update public.volunteers set minor = true where email = 'pat.pair@example.com';
    raise exception 'FAIL: stored a minor''s full last name';
  exception when check_violation then null;
  end;
end $$;
-- The desk adds a walk-up by name only, with a minor alongside.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$
declare walk uuid;
begin
  walk := public.add_walk_up('30000000-0000-0000-0000-0000000000a1', 'Nora Noname', null, true, false,
          '[{"name": "Nolan Noname", "minor": true}]'::jsonb);
  assert (select phone is null and walk_up from public.volunteers where id = walk), 'a walk-up needs only a name';
  assert (select count(*) from public.volunteer_assignments va join public.volunteers v on v.id = va.volunteer_id
           where va.shift_id = '30000000-0000-0000-0000-0000000000a1' and (v.id = walk or v.contact_id = walk)
             and va.checked_in_at is not null) = 2, 'a walk-up and the person with them are both checked in';
  assert (select max_capacity from public.shifts where id = '30000000-0000-0000-0000-0000000000a1') = 5,
         'adding a group to a full shift makes room for all of them';
  assert (select bool_or(minor and signed_up_by = 'Pat Pair') from public.station_roster('20000000-0000-0000-0000-00000000000a')),
         'the roster says who''s a minor and who signed them up';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Adults-only stations: no minors, by signup or at the desk
-- ---------------------------------------------------------------------------
update public.stations set adults_only = true where id = '20000000-0000-0000-0000-00000000000a';
insert into public.shifts (id, station_id, title, starts_at, ends_at, max_capacity) values
  ('30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-00000000000a', 'Grown-up Parking',
   now() + interval '13 days', now() + interval '13 days 2 hours', 5);
set role service_role;
do $$ begin
  begin
    perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Mom Adult', 'mom.adult@example.com', '+15125550180',
            array['30000000-0000-0000-0000-0000000000a3']::uuid[], false, '[{"name": "Kiddo Adult", "minor": true}]'::jsonb);
    raise exception 'FAIL: a minor signed up for an adults-only station';
  exception when sqlstate 'P0005' then null;
  end;
  assert not exists (select 1 from public.volunteers where email = 'mom.adult@example.com'), 'nothing is booked when a minor is turned away';
  perform public.register_volunteer('10000000-0000-0000-0000-00000000000a', 'Mom Adult', 'mom.adult@example.com', '+15125550180',
          array['30000000-0000-0000-0000-0000000000a3']::uuid[], false, '[{"name": "Dad Adult"}]'::jsonb);
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-0000000000a3') = 2, 'adults can sign up';
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  begin
    perform public.add_walk_up('30000000-0000-0000-0000-0000000000a3', 'Teen Walker', null, false, true);
    raise exception 'FAIL: the desk added a minor to an adults-only station';
  exception when sqlstate 'P0005' then null;
  end;
end $$;
reset role;
update public.stations set adults_only = false where id = '20000000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------------------
-- Maps & documents: only hosts see and change the file list
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select not public from storage.buckets where id = 'event-files'), 'the files bucket is private';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences, created_by)
values ('10000000-0000-0000-0000-00000000000a', 'Stadium map', '10000000-0000-0000-0000-00000000000a/map.pdf', 'map.pdf',
        'application/pdf', 12345, array['public', 'directors'], '00000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.event_files) = 1, 'a host sees their files';
  update public.event_files set label = 'Stadium & parking map';
  begin
    insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences, created_by)
    values ('10000000-0000-0000-0000-00000000000a', 'Bad', '10000000-0000-0000-0000-00000000000b/x.pdf', 'x.pdf',
            'application/pdf', 1, array['public'], auth.uid());
    raise exception 'FAIL: a file path outside its event''s folder';
  exception when check_violation then null;
  end;
  begin
    insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences, created_by)
    values ('10000000-0000-0000-0000-00000000000a', 'Bad', '10000000-0000-0000-0000-00000000000a/x.exe', 'x.exe',
            'application/x-msdownload', 1, array['public'], auth.uid());
    raise exception 'FAIL: stored a file type that isn''t a PDF or image';
  exception when check_violation then null;
  end;
end $$;
-- A Volunteer Lead, a Section Lead and a stranger can't read or change the list directly.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert (select count(*) from public.event_files) = 0, 'a Volunteer Lead doesn''t read the file list directly';
  update public.event_files set label = 'hijacked';
  delete from public.event_files;
  begin
    insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences, created_by)
    values ('10000000-0000-0000-0000-00000000000a', 'Mine', '10000000-0000-0000-0000-00000000000a/m.pdf', 'm.pdf',
            'application/pdf', 1, array['public'], auth.uid());
    raise exception 'FAIL: a Volunteer Lead added a file';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.event_files) = 0, 'a stranger can''t read the file list';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.event_files;
    raise exception 'FAIL: a visitor read the file list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select label from public.event_files) = 'Stadium & parking map', 'only the host''s change stuck';
end $$;

-- ---------------------------------------------------------------------------
-- Maps & documents: who uploaded a file, and when (replacing counts as uploading)
-- ---------------------------------------------------------------------------
alter table public.event_files disable trigger event_files_stamp_upload;
update public.event_files set uploaded_at = now() - interval '1 day', uploaded_by = null;
alter table public.event_files enable trigger event_files_stamp_upload;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  update public.event_files set label = 'Renamed map';
  assert (select uploaded_by is null and uploaded_at < now() - interval '1 hour' from public.event_files),
         'renaming a file doesn''t change who uploaded it';
  update public.event_files set path = '10000000-0000-0000-0000-00000000000a/new-map.pdf';
  assert (select uploaded_by = auth.uid() and uploaded_at > now() - interval '1 minute' from public.event_files),
         'replacing a file records who uploaded it, and when';
  begin
    insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences, created_by, uploaded_by)
    values ('10000000-0000-0000-0000-00000000000a', 'Packet', '10000000-0000-0000-0000-00000000000a/p.pdf', 'p.pdf',
            'application/pdf', 1, array['directors'], auth.uid(), '00000000-0000-0000-0000-000000000006');
    raise exception 'FAIL: set someone else as the uploader';
  exception when insufficient_privilege then null;
  end;
  insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences, created_by)
  values ('10000000-0000-0000-0000-00000000000a', 'Packet', '10000000-0000-0000-0000-00000000000a/p.pdf', 'p.pdf',
          'application/pdf', 1, array['directors'], auth.uid());
  assert (select uploaded_by from public.event_files where label = 'Packet') = auth.uid(), 'a new file records its uploader';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Demo mode: demo people, added and removed only by the server
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-000000000001', 'host-1@demo.fieldcommandevents.com',     '{"full_name":"Demo Host"}'),
  ('d0000000-0000-0000-0000-000000000002', 'lead-1@demo.fieldcommandevents.com',     '{"full_name":"Demo Section Lead"}'),
  ('d0000000-0000-0000-0000-000000000003', 'director-1@demo.fieldcommandevents.com', '{"full_name":"Demo Director"}'),
  ('d0000000-0000-0000-0000-000000000004', 'vol-1@demo.fieldcommandevents.com',      '{"full_name":"Demo Volunteer"}');
insert into public.demo_accounts (user_id, owner_id, persona) values
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'host'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'section_lead'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'director'),
  ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'volunteer');

-- Browsers (even a demo account) can't see or change any of it.
set role authenticated;
set request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","email":"host-1@demo.fieldcommandevents.com"}';
do $$ begin
  begin
    perform 1 from public.demo_accounts;
    raise exception 'FAIL: a browser read the demo accounts';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.demo_events (owner_id, event_id) values (auth.uid(), '10000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: a browser turned on demo mode';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.demo_join('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', auth.uid());
    raise exception 'FAIL: a browser added a demo person to an event';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.demo_leave('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: a browser removed demo people';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.demo_events;
    raise exception 'FAIL: a visitor read the demo events';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
do $$ begin
  begin
    perform public.demo_join('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a',
                             'd0000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: added a demo person to an event without demo mode on';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
insert into public.demo_events (owner_id, event_id)
values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a');
do $$
declare
  owner constant uuid := '00000000-0000-0000-0000-000000000001';
  ev    constant uuid := '10000000-0000-0000-0000-00000000000a';
  org   uuid := (select organization_id from public.events where id = ev);
  band  uuid;
  spots int := (select sum(registered_count) from public.shifts where event_id = ev);
begin
  begin
    perform public.demo_join('00000000-0000-0000-0000-000000000002', ev, 'd0000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: used someone else''s demo account';
  exception when sqlstate 'P0001' then null;
  end;

  perform public.demo_join(owner, ev, 'd0000000-0000-0000-0000-000000000001');
  assert exists (select 1 from public.organization_members
                  where organization_id = org and user_id = 'd0000000-0000-0000-0000-000000000001' and role = 'admin'),
         'the demo host co-hosts';

  perform public.demo_join(owner, ev, 'd0000000-0000-0000-0000-000000000002');
  assert exists (select 1 from public.event_staff
                  where event_id = ev and user_id = 'd0000000-0000-0000-0000-000000000002' and role = 'section_lead'),
         'the demo Section Lead is on the team';
  assert (select count(*) from public.station_leads where user_id = 'd0000000-0000-0000-0000-000000000002') between 1 and 2,
         'the demo Section Lead leads a station or two';

  band := public.demo_join(owner, ev, 'd0000000-0000-0000-0000-000000000003');
  assert band is not null and (select school_name from public.bands where id = band) = 'Demo High School',
         'the demo director has a band';
  assert public.demo_join(owner, ev, 'd0000000-0000-0000-0000-000000000003') = band, 'switching again keeps the same band';

  perform public.demo_join(owner, ev, 'd0000000-0000-0000-0000-000000000004');
  perform public.demo_join(owner, ev, 'd0000000-0000-0000-0000-000000000004');
  assert (select count(*) from public.volunteer_assignments va join public.volunteers v on v.id = va.volunteer_id
           where v.email = 'vol-1@demo.fieldcommandevents.com') = 1, 'the demo volunteer has one shift';
  assert (select sum(registered_count) from public.shifts where event_id = ev) = spots + 1, 'their spot is counted';

  perform public.demo_leave(owner, ev);
  assert (select sum(registered_count) from public.shifts where event_id = ev) = spots, 'their spot is freed';
  assert not exists (select 1 from public.volunteers where email = 'vol-1@demo.fieldcommandevents.com'), 'the demo volunteer is gone';
  assert not exists (select 1 from public.bands where id = band), 'the demo band is gone';
  assert not exists (select 1 from public.station_leads where user_id = 'd0000000-0000-0000-0000-000000000002'), 'the demo lead''s stations are freed';
  assert not exists (select 1 from public.event_staff where user_id::text like 'd0000000%'), 'the demo team is gone';
  assert not exists (select 1 from public.organization_members where user_id::text like 'd0000000%'), 'the demo host is gone';
  assert not exists (select 1 from public.team_removals where user_id::text like 'd0000000%'), 'demo people aren''t listed as removed';
  assert not exists (select 1 from public.demo_events where event_id = ev), 'demo mode is off for the event';
  assert exists (select 1 from public.organization_members where organization_id = org and user_id = owner), 'the real host stays';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Band invitations: hosts invite directors from their earlier events
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'past@example.com', '{"full_name":"Pat Past"}');
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-00000000000f',
        (select organization_id from public.events where id = '10000000-0000-0000-0000-00000000000a'),
        'Next Classic', 'next-classic', 'draft', current_date + 40, current_date + 40,
        now() + interval '40 days', now() + interval '40 days 10 hours', '1 Stadium Rd');
insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1', 'West HS', 'Westwind', '5A',
        'addr', 'past@example.com', 'Pat Past', 'past@example.com', '+15125550120', 80, 8);

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare r record;
begin
  select * into r from public.past_band_directors('10000000-0000-0000-0000-00000000000f') where email = 'past@example.com';
  assert found, 'a host sees directors from their earlier events';
  assert r.bands = array['Westwind (West HS)'] and r.last_event = 'Today Invitational' and not r.registered
         and r.invited_at is null, 'with their bands, last event and invitation status';
  begin
    insert into public.band_invitations (event_id, email) values ('10000000-0000-0000-0000-00000000000f', 'past@example.com');
    raise exception 'FAIL: a browser created a band invitation';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.band_invitations (event_id, email, invited_by)
values ('10000000-0000-0000-0000-00000000000f', 'past@example.com', '00000000-0000-0000-0000-000000000001');
set role authenticated;
do $$ begin
  assert (select invited_at is not null from public.past_band_directors('10000000-0000-0000-0000-00000000000f')
           where email = 'past@example.com'), 'the list shows who was invited';
  assert (select count(*) from public.band_invitations) = 1, 'a host sees their event''s invitations';
  begin
    perform token from public.band_invitations;
    raise exception 'FAIL: a browser read an invitation''s sign-in token';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A Volunteer Lead, the director and a stranger see neither the list nor the invitations.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert (select count(*) from public.past_band_directors('10000000-0000-0000-0000-00000000000f')) = 0
         and (select count(*) from public.past_band_directors('10000000-0000-0000-0000-00000000000a')) = 0,
         'a Volunteer Lead doesn''t see past directors';
  assert (select count(*) from public.band_invitations) = 0, 'a Volunteer Lead doesn''t see invitations';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","email":"past@example.com"}';
do $$ begin
  assert (select count(*) from public.past_band_directors('10000000-0000-0000-0000-00000000000f')) = 0, 'a director doesn''t see the list';
  assert (select count(*) from public.band_invitations) = 0, 'a director doesn''t read invitations';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.past_band_directors('10000000-0000-0000-0000-00000000000f')) = 0, 'a stranger sees nothing';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.past_band_directors('10000000-0000-0000-0000-00000000000f');
    raise exception 'FAIL: a visitor listed past directors';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.band_invitations;
    raise exception 'FAIL: a visitor read band invitations';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Admin dashboard: plans, free-until dates and the admin log
-- ---------------------------------------------------------------------------
select organization_id as plan_org from public.events where id = '10000000-0000-0000-0000-00000000000a' \gset
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    update public.organizations set free_until = current_date + 365;
    raise exception 'FAIL: a host extended their own free period';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_set_plan((select organization_id from public.events where id = '10000000-0000-0000-0000-00000000000a'),
                                  'active', null, null);
    raise exception 'FAIL: a host changed their own plan';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.admin_log) = 0, 'a host can''t read the admin log';
end $$;
reset role;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$
declare
  org uuid := (select organization_id from public.events where id = '10000000-0000-0000-0000-00000000000a');
  -- Already past in the organization's own time zone, which org_has_active_plan() uses:
  -- on US evenings the server's UTC date is a day ahead, so "UTC yesterday" can still be today there.
  ended date := current_date - 2;
begin
  begin
    perform public.admin_set_plan(org, 'comped', null, null);
    raise exception 'FAIL: a pilot without its last free day';
  exception when sqlstate 'P0001' then null;
  end;
  perform public.admin_set_plan(org, 'comped', ended, 'Pilot ended');
  assert not public.org_has_active_plan(org), 'a pilot past its last day isn''t active';
  assert (select details->'to'->>'free_until' from public.admin_log where organization_id = org) = ended::text
         and (select details->>'note' from public.admin_log where organization_id = org) = 'Pilot ended'
         and (select admin_id from public.admin_log where organization_id = org) = auth.uid(),
         'the change is logged with who made it';
end $$;
reset role;

-- After a pilot ends: published events stay editable, new ones can't be published.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  update public.events set director_info = 'Gates open at 7.' where id = '10000000-0000-0000-0000-00000000000a';
  assert (select director_info from public.events where id = '10000000-0000-0000-0000-00000000000a') = 'Gates open at 7.',
         'a host still edits a published event after their pilot ends';
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-00000000000f';
    raise exception 'FAIL: published a new event after the pilot ended';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
select public.admin_set_plan(:'plan_org', 'comped', current_date, null);
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  update public.events set status = 'published' where id = '10000000-0000-0000-0000-00000000000f';
  assert (select status from public.events where id = '10000000-0000-0000-0000-00000000000f') = 'published',
         'a pilot is active through its last day';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.admin_log;
    raise exception 'FAIL: a visitor read the admin log';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.platform_admins;
update public.organizations set subscription_status = 'comped', free_until = null;

-- ---------------------------------------------------------------------------
-- Event types: volunteer events have no bands
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare
  org uuid := (select organization_id from public.events where id = '10000000-0000-0000-0000-00000000000a');
  vol uuid;
  plain uuid;
begin
  assert (select event_type from public.events where id = '10000000-0000-0000-0000-00000000000a') = 'band_contest',
         'existing events are band contests';

  insert into public.events (organization_id, name, slug, event_type, starts_on, ends_on, window_start, window_end, venue_address)
  values (org, 'Fall Fundraiser', 'fall-fundraiser', 'volunteer', current_date + 20, current_date + 20,
          now() + interval '20 days', now() + interval '20 days 6 hours', '1 Main St')
  returning id into vol;
  insert into public.stations (event_id, name) values (vol, 'Concessions');
  begin
    insert into public.stations (event_id, name, checkpoint_kind, checkpoint_order) values (vol, 'Bus parking', 'parking', 1);
    raise exception 'FAIL: a band check-in station on a volunteer event';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                              contact_email, head_director_name, head_director_email, head_director_phone,
                              student_count, chaperone_count)
    values (vol, auth.uid(), 'Central HS', 'Mighty Marching', '5A', 'addr', 'band@example.com', 'Bo Band',
            'band@example.com', '+15125550105', 10, 1);
    raise exception 'FAIL: a band on a volunteer event';
  exception when sqlstate 'P0001' then null;
  end;
  update public.events set band_registration_open = true where id = vol;
  assert not public.band_registration_is_open(vol), 'band registration never opens on a volunteer event';

  -- A band contest with bands can't become a volunteer event.
  begin
    update public.events set event_type = 'volunteer' where id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: switched a contest with bands to a volunteer event';
  exception when sqlstate 'P0001' then null;
  end;

  -- One without bands can; its check-in stations become plain stations.
  insert into public.events (organization_id, name, slug, starts_on, ends_on, window_start, window_end, venue_address)
  values (org, 'Maybe Contest', 'maybe-contest', current_date + 30, current_date + 30,
          now() + interval '30 days', now() + interval '30 days 6 hours', '1 Main St')
  returning id into plain;
  insert into public.stations (event_id, name, checkpoint_kind, checkpoint_order) values (plain, 'Gate', 'gate', 1);
  update public.events set event_type = 'volunteer', band_registration_open = true where id = plain;
  assert (select event_type from public.events where id = plain) = 'volunteer', 'switched to a volunteer event';
  assert (select checkpoint_kind is null from public.stations where event_id = plain), 'its check-in station became a plain station';
  assert not (select band_registration_open from public.events where id = plain), 'and band registration closed';
  update public.events set event_type = 'band_contest' where id = plain;
  assert (select event_type from public.events where id = plain) = 'band_contest', 'and back to a band contest';
  delete from public.events where id in (vol, plain);
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- School visitor events: parent registration, the door, 30-day erasing
-- ---------------------------------------------------------------------------
insert into public.events (id, organization_id, name, slug, status, event_type, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000c1',
        (select organization_id from public.events where id = '10000000-0000-0000-0000-00000000000a'),
        'Open House', 'open-house', 'published', 'school_visit', current_date + 3, current_date + 3,
        now() + interval '3 days', now() + interval '3 days 3 hours', '1 School Rd');
-- Registration starts closed, even once the event is published: nobody can register until the host opens it.
set role service_role;
do $$ begin
  assert not (select parent_registration_open from public.events where id = '10000000-0000-0000-0000-0000000000c1'),
         'parent registration starts closed';
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Early Parent', 'early@example.com', null,
            '[{"name":"Early Kid","teacher":"Smith","grade":"3rd"}]');
    raise exception 'registered before the host opened registration';
  exception when raise_exception then
    if sqlerrm not like '%closed%' then raise; end if;
  end;
end $$;
reset role;
update public.events set parent_registration_open = true where id = '10000000-0000-0000-0000-0000000000c1';
insert into public.event_staff (event_id, user_id, role)
values ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role service_role;
do $$
declare t1 uuid; t2 uuid;
begin
  t1 := public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Rita Parent', 'Rita@example.com', '+15125550170',
          '[{"name":"Ava Lopez","teacher":"Smith","grade":"3rd"},{"name":"Leo Lopez","teacher":"Jones","grade":"K"}]');
  -- Registering again with the same email changes nothing (someone who only
  -- knows a parent's email can't replace their children); the server emails
  -- that parent their own link instead.
  t2 := public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Someone Else', 'rita@example.com', null,
          '[{"name":"Other Kid","teacher":"X","grade":"3rd"}]');
  assert t2 is null and (select parent_name = 'Rita Parent' and jsonb_array_length(children) = 2
                           from public.parent_registrations where email = 'rita@example.com'),
         'registering again with a known email changes nothing';
  assert (select adult_count from public.parent_registrations where email = 'rita@example.com') = 1,
         'one adult when not given';
  -- The parent edits from their own link: same link, calendar invite version bumped.
  assert public.update_parent_registration(t1, 'Rita Parent', null,
           '[{"name":"Ava Lopez","teacher":"Smith","grade":"3rd"}]', '[" Marco Lopez ", "Rosa Diaz"]')
         = '10000000-0000-0000-0000-0000000000c1', 'a parent edits with their link';
  assert (select jsonb_array_length(children) = 1 and calendar_sequence = 1 and phone is null
            from public.parent_registrations where access_token = t1),
         'editing replaces the children and bumps the calendar invite version';
  assert (select adult_count = 3
                 and other_adults = '[{"name": "Marco Lopez", "checked_in_at": null, "checked_in_by": null},
                                      {"name": "Rosa Diaz", "checked_in_at": null, "checked_in_by": null}]'::jsonb
            from public.parent_registrations where email = 'rita@example.com'),
         'other adults are named, and counted with the parent';
  begin
    perform public.update_parent_registration(gen_random_uuid(), 'Rita Parent', null, '[{"name":"A B","teacher":"X","grade":"1st"}]');
    raise exception 'FAIL: edited a registration without its link';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Big Group', 'big@example.com', null,
              '[{"name":"Mia","teacher":"Lee","grade":"2nd"}]', '["A One","B Two","C Three","D Four","E Five","F Six"]');
    raise exception 'FAIL: registered 6 other adults';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Blank Adult', 'blank@example.com', null,
              '[{"name":"Mia","teacher":"Lee","grade":"2nd"}]', '[" "]');
    raise exception 'FAIL: registered an adult with no name';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'No Kids', 'nokids@example.com', null, '[]');
    raise exception 'FAIL: registered with no children';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Half Filled', 'half@example.com', null,
              '[{"name":"Mia","teacher":"","grade":"2nd"}]');
    raise exception 'FAIL: registered a child without a teacher';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.register_parents('10000000-0000-0000-0000-00000000000a', 'Wrong Event', 'wrong@example.com', null,
              '[{"name":"Mia","teacher":"Lee","grade":"2nd"}]');
    raise exception 'FAIL: parent registration on a band contest';
  exception when sqlstate 'P0001' then null;
  end;
  perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Sam Second', 'sam@example.com', null,
            '[{"name":"Noah Kim","teacher":"Lee","grade":"5th"}]');
  assert public.cancel_parent_registration((select access_token from public.parent_registrations where email = 'sam@example.com'))
         = '10000000-0000-0000-0000-0000000000c1', 'a parent cancels with their link';
end $$;
reset role;
set role authenticated;
-- Children's details: a Section Lead sees nothing before event day; a Volunteer Lead does.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert not public.can_check_in_parents('10000000-0000-0000-0000-0000000000c1'), 'a Section Lead can''t work the door before event day';
  assert (select count(*) from public.parent_registrations) = 0, 'a Section Lead sees no children''s details before event day';
  begin
    perform public.set_parent_checked_in((select id from public.parent_registrations limit 1), true);
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.event_staff (event_id, user_id, role)
values ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000007', 'volunteer_director');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","email":"newlead@example.com"}';
do $$ begin
  assert (select count(*) from public.parent_registrations) = 1, 'a Volunteer Lead sees registrations before event day';
end $$;
-- On event day the Section Lead works the door: sees registrations (never the links) and checks parents in.
reset role;
delete from public.event_staff where event_id = '10000000-0000-0000-0000-0000000000c1' and user_id = '00000000-0000-0000-0000-000000000007';
update public.events set starts_on = (now() at time zone timezone)::date, ends_on = (now() at time zone timezone)::date
 where id = '10000000-0000-0000-0000-0000000000c1';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert public.can_check_in_parents('10000000-0000-0000-0000-0000000000c1'), 'a Section Lead works the door on event day';
  assert (select count(*) from public.parent_registrations) = 1, 'the team sees registrations';
  assert (select adult_count = 3 and jsonb_array_length(other_adults) = 2 from public.parent_registrations),
         'the team sees the other adults coming';
  begin
    perform access_token from public.parent_registrations;
    raise exception 'FAIL: a browser read a parent''s private link';
  exception when insufficient_privilege then null;
  end;
  perform public.set_parent_checked_in((select id from public.parent_registrations), true);
  assert (select checked_in_at is not null and checked_in_by = auth.uid() from public.parent_registrations), 'checked in, and by whom';
  -- Each adult is checked in on their own.
  assert (select other_adults -> 0 ->> 'checked_in_at' is null from public.parent_registrations),
         'checking in the parent leaves the other adults waiting';
  perform public.set_parent_checked_in((select id from public.parent_registrations), true, 2);
  assert (select other_adults -> 1 ->> 'checked_in_at' is not null
             and other_adults -> 1 ->> 'checked_in_by' = auth.uid()::text
             and other_adults -> 0 ->> 'checked_in_at' is null from public.parent_registrations),
         'a grandparent checks in separately';
  perform public.set_parent_checked_in((select id from public.parent_registrations), false, 2);
  assert (select other_adults -> 1 ->> 'checked_in_at' is null from public.parent_registrations), 'one adult''s check-in can be undone';
  perform public.set_parent_checked_in((select id from public.parent_registrations), true, 1);
  begin
    perform public.set_parent_checked_in((select id from public.parent_registrations), true, 3);
    raise exception 'FAIL: checked in an adult who isn''t on the registration';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    update public.parent_registrations set parent_name = 'Changed';
    raise exception 'FAIL: a browser edited a registration';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.update_parent_registration(gen_random_uuid(), 'X Y', null, '[]');
    raise exception 'FAIL: a browser called update_parent_registration';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.parent_registrations) = 0, 'a stranger sees no registrations';
  begin
    perform public.set_parent_checked_in((select id from public.parent_registrations limit 1), false);
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.events set starts_on = current_date + 3, ends_on = current_date + 3
 where id = '10000000-0000-0000-0000-0000000000c1';
-- Editing a registration keeps anyone already checked in as checked in.
do $$ begin
  perform public.update_parent_registration((select access_token from public.parent_registrations where email = 'rita@example.com'),
          'Rita Parent', null, '[{"name":"Ava Lopez","teacher":"Smith","grade":"3rd"}]', '["marco lopez", "New Uncle"]');
  assert (select other_adults -> 0 ->> 'checked_in_at' is not null and other_adults -> 1 ->> 'checked_in_at' is null
            from public.parent_registrations where email = 'rita@example.com'),
         'editing keeps check-ins of adults still on the list';
end $$;
-- Registration closes on its own at the time the host picked.
do $$ begin
  update public.events set parent_registration_closes_at = now() - interval '1 minute' where id = '10000000-0000-0000-0000-0000000000c1';
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Too Late', 'late@example.com', null,
              '[{"name":"Mia","teacher":"Lee","grade":"2nd"}]');
    raise exception 'FAIL: registered after registration closed';
  exception when sqlstate 'P0001' then null;
  end;
  update public.events set parent_registration_closes_at = now() + interval '1 day' where id = '10000000-0000-0000-0000-0000000000c1';
  perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'On Time', 'ontime@example.com', null,
            '[{"name":"Mia","teacher":"Lee","grade":"2nd"}]');
  delete from public.parent_registrations where email = 'ontime@example.com';
  update public.events set parent_registration_closes_at = null where id = '10000000-0000-0000-0000-0000000000c1';
end $$;
do $$ begin
  assert (select checked_in_at is not null from public.parent_registrations where email = 'rita@example.com'),
         'a stranger couldn''t undo a check-in';
end $$;
set role anon;
do $$ begin
  begin
    perform 1 from public.parent_registrations;
    raise exception 'FAIL: a visitor read parent registrations';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.register_parents('10000000-0000-0000-0000-0000000000c1', 'Direct', 'direct@example.com', null,
              '[{"name":"X","teacher":"Y","grade":"1st"}]');
    raise exception 'FAIL: a browser registered without going through the server';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- No bands on a school visitor event, and it keeps its type once parents register.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    update public.events set event_type = 'volunteer' where id = '10000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: switched a school visitor event with registrations';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into public.stations (event_id, name, checkpoint_kind, checkpoint_order)
    values ('10000000-0000-0000-0000-0000000000c1', 'Gate', 'gate', 1);
    raise exception 'FAIL: a band check-in station on a school visitor event';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
reset role;

-- 30 days after the event: hidden, then erased.
update public.events set starts_on = (now() at time zone timezone)::date - 31, ends_on = (now() at time zone timezone)::date - 31,
       window_start = now() - interval '31 days', window_end = now() - interval '31 days' + interval '3 hours'
 where id = '10000000-0000-0000-0000-0000000000c1';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select count(*) from public.parent_registrations) = 0, 'registrations are hidden 30 days after the event';
end $$;
reset role;
set role service_role;
do $$ begin
  assert public.purge_parent_registrations() = 1, 'and erased by the clean-up';
  assert not exists (select 1 from public.parent_registrations), 'nothing left';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000c1';

-- ---------------------------------------------------------------------------
-- Group events: groups register like bands; rooms and each group's times
-- ---------------------------------------------------------------------------
insert into public.events (id, organization_id, name, slug, status, event_type, starts_on, ends_on, window_start, window_end,
                           venue_address, band_registration_open)
values ('10000000-0000-0000-0000-0000000000d1',
        (select organization_id from public.events where id = '10000000-0000-0000-0000-00000000000a'),
        'Spring Choir Festival', 'spring-choir', 'published', 'group_event', current_date + 5, current_date + 5,
        now() + interval '5 days', now() + interval '5 days 8 hours', '1 School Rd', true);
set role authenticated;
-- A director registers a choir (registration is open on a choir festival).
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', auth.uid(), 'Central HS',
        'Varsity Treble', '5A', 'addr', 'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 40, 4);
-- A second group (set up directly; groups register under their own director).
reset role;
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002',
        'West HS', 'Chamber Singers', '5A', 'addr', 'w@example.com', 'Dee Director', 'director@example.com', '+15125550106', 24, 2);
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare
  ev    uuid := '10000000-0000-0000-0000-0000000000d1';
  t0    timestamptz := date_trunc('hour', now()) + interval '5 days';
  warm  uuid; stage uuid; sight uuid;
begin
  perform public.save_rooms(ev, '[
    {"name":"Warm-up","note":"Choir room, Room 112","on_path":true,"minutes":20},
    {"name":"Main Stage","note":"Auditorium","on_path":true,"minutes":15},
    {"name":"Sight-reading","note":"Black box","on_path":true,"minutes":20},
    {"name":"Hospitality","on_path":false}]');
  select id into warm from public.rooms where event_id = ev and name = 'Warm-up';
  select id into stage from public.rooms where event_id = ev and name = 'Main Stage';
  select id into sight from public.rooms where event_id = ev and name = 'Sight-reading';
  assert (select path_order from public.rooms where id = sight) = 3
     and (select path_order from public.rooms where event_id = ev and name = 'Hospitality') is null,
         'rooms on the path are numbered in order; others are just listed';

  perform public.save_room_schedule(ev, t0, 20, 5, jsonb_build_array(
    jsonb_build_object('band_id', '40000000-0000-0000-0000-0000000000d1'),
    jsonb_build_object('band_id', '40000000-0000-0000-0000-0000000000d2', 'skipped_room_ids', jsonb_build_array(sight),
                       'extra_minutes_before', 10)));
  assert (select count(*) from public.room_slots where event_id = ev) = 5, 'three stops for one choir, two for the one skipping a room';
  assert (select starts_at from public.room_slots where room_id = stage and band_id = '40000000-0000-0000-0000-0000000000d1')
         = t0 + interval '25 minutes', 'the next room starts after the last one plus passing time';
  assert (select starts_at from public.room_slots where room_id = warm and band_id = '40000000-0000-0000-0000-0000000000d2')
         = t0 + interval '30 minutes', 'the next choir starts one interval later, plus its break';
  assert not exists (select 1 from public.room_slots where room_id = sight and band_id = '40000000-0000-0000-0000-0000000000d2'),
         'a skipped room has no time';

  -- Renaming or retiming a room updates everyone's times.
  perform public.save_rooms(ev, jsonb_build_array(
    jsonb_build_object('id', warm, 'name', 'Warm-up', 'on_path', true, 'minutes', 30),
    jsonb_build_object('id', stage, 'name', 'Main Stage', 'on_path', true, 'minutes', 15),
    jsonb_build_object('id', sight, 'name', 'Sight-reading', 'on_path', true, 'minutes', 20)));
  assert (select starts_at from public.room_slots where room_id = stage and band_id = '40000000-0000-0000-0000-0000000000d1')
         = t0 + interval '35 minutes', 'room changes rebuild the times';
  assert not exists (select 1 from public.rooms where event_id = ev and name = 'Hospitality'), 'a room left out is removed';

  begin
    update public.events set event_type = 'volunteer' where id = ev;
    raise exception 'FAIL: switched a choir festival with choirs registered';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into public.stations (event_id, name, checkpoint_kind, checkpoint_order) values (ev, 'Gate', 'gate', 1);
    raise exception 'FAIL: a band check-in station on a choir festival';
  exception when sqlstate 'P0001' then null;
  end;
end $$;

-- The team sees the working schedule before it's posted.
reset role;
insert into public.event_staff (event_id, user_id, role)
values ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.room_slots) = 5, 'the team sees every choir''s times before they''re posted';
  assert (select count(*) from public.group_order) = 0, 'but not the host''s working order';
end $$;
-- Not posted yet: directors and the public see no times.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.room_slots) = 0, 'a director sees no times before the schedule is posted';
  assert (select count(*) from public.group_order) = 0, 'and never the host''s working order';
  begin
    perform public.save_rooms('10000000-0000-0000-0000-0000000000d1', '[]');
    raise exception 'FAIL: a director changed the rooms';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_room_schedule('10000000-0000-0000-0000-0000000000d1', now(), 20, 5, '[]');
    raise exception 'FAIL: a director changed the schedule';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.public_room_schedule('spring-choir')) = 0, 'nothing public before it''s posted';
  assert (select count(*) from public.rooms where event_id = '10000000-0000-0000-0000-0000000000d1') = 3, 'room names are public';
  begin
    perform 1 from public.room_slots;
    raise exception 'FAIL: the public read room_slots directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.events set performance_order_published = true where id = '10000000-0000-0000-0000-0000000000d1';
set role anon;
do $$ begin
  assert (select count(*) from public.public_room_schedule('spring-choir')) = 5, 'the posted schedule is public';
end $$;
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.room_slots) = 3, 'once posted, a director sees only their own choir''s times';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.room_slots) = 0, 'a stranger reads no times directly';
end $$;
-- On the day: the team taps groups in ("Arrived", then "Done" per room).
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$
declare
  stage uuid := (select id from public.rooms where event_id = '10000000-0000-0000-0000-0000000000d1' and name = 'Main Stage');
begin
  perform public.group_checkin('40000000-0000-0000-0000-0000000000d1', null, true);
  perform public.group_checkin('40000000-0000-0000-0000-0000000000d1', null, true);
  assert (select count(*) from public.group_checkins) = 1, 'a Section Lead marks a group arrived (twice is still once)';
  perform public.group_checkin('40000000-0000-0000-0000-0000000000d2', stage, true);
  assert (select count(*) from public.group_checkins where band_id = '40000000-0000-0000-0000-0000000000d2') = 2,
         'a room done also marks the group arrived';
  assert (select actor_name from public.group_checkins where room_id = stage) is not null, 'taps say who';
  perform public.group_checkin('40000000-0000-0000-0000-0000000000d2', stage, false);
  assert not exists (select 1 from public.group_checkins where room_id = stage), 'a tap can be taken back';
  perform public.group_checkin('40000000-0000-0000-0000-0000000000d2', stage, true);
  begin
    perform public.group_checkin('40000000-0000-0000-0000-0000000000d1',
      (select id from public.rooms where event_id <> '10000000-0000-0000-0000-0000000000d1' limit 1), true);
    raise exception 'FAIL: checked a group into another event''s room';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.group_checkin('40000000-0000-0000-0000-000000000001', null, true);
    raise exception 'FAIL: group check-in on a band contest';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into public.group_checkins (event_id, band_id) values ('10000000-0000-0000-0000-0000000000d1', '40000000-0000-0000-0000-0000000000d1');
    raise exception 'FAIL: wrote group_checkins directly';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A director sees their own group's taps, can't tap; a stranger sees and taps nothing.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select count(*) from public.group_checkins) = 1, 'a director sees only their own group''s taps';
  begin
    perform public.group_checkin('40000000-0000-0000-0000-0000000000d1', null, false);
    raise exception 'FAIL: a director took back a check-in';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert (select count(*) from public.group_checkins) = 2, 'the other director sees their group''s arrival and room';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.group_checkins) = 0, 'a stranger reads no taps';
  begin
    perform public.group_checkin('40000000-0000-0000-0000-0000000000d1', null, true);
    raise exception 'FAIL: a stranger checked a group in';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.group_checkins;
    raise exception 'FAIL: the public read group_checkins';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000d1';

-- A FieldCommand admin invites a new host; they can then set up one organization.
reset role;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006') on conflict do nothing;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  perform public.admin_invite_host(' NewLead@Example.com ');
  assert (select count(*) from public.host_invitations where email = 'newlead@example.com' and used_at is null) = 1,
         'an admin invites a host (email tidied)';
  assert exists (select 1 from public.admin_log where action = 'invite_host'), 'the invitation is logged';
  begin
    perform public.admin_invite_host('not-an-email');
    raise exception 'FAIL: invited a host with a bad email';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","email":"newlead@example.com"}';
do $$ begin
  assert public.has_host_invitation(), 'the invited person sees their invitation';
  perform public.create_organization('Newlead Boosters', 'newlead-boosters');
  assert not public.has_host_invitation(), 'and it''s used up';
end $$;
reset role;
do $$ begin
  assert (select used_at is not null and organization_id = (select id from public.organizations where slug = 'newlead-boosters')
            from public.host_invitations where email = 'newlead@example.com'),
         'the invitation records the organization it created';
end $$;
delete from public.organizations where slug = 'newlead-boosters';

-- Volunteer records are deleted 10 days after the event (companions too); shift totals stay.
reset role;
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
values
  ('10000000-0000-0000-0000-0000000000e1', :'org_id', 'Long Ago Fair', 'long-ago', 'published',
   current_date - 12, current_date - 12, now() - interval '12 days', now() - interval '12 days' + interval '5 hours', '1 Old Rd'),
  ('10000000-0000-0000-0000-0000000000e2', :'org_id', 'Last Week Fair', 'last-week', 'published',
   current_date - 9, current_date - 9, now() - interval '9 days', now() - interval '9 days' + interval '5 hours', '2 Old Rd');
insert into public.stations (id, event_id, name, station_type)
values ('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e1', 'Tickets', 'passive');
insert into public.shifts (id, station_id, title, starts_at, ends_at, max_capacity, registered_count)
values ('30000000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-0000000000e1', 'Morning',
        now() - interval '12 days', now() - interval '12 days' + interval '2 hours', 5, 2);
insert into public.volunteers (id, event_id, full_name, email, phone)
values ('50000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e1', 'Old Volunteer', 'old@example.com', '+15125550101'),
       ('50000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000e2', 'Recent Volunteer', 'recent@example.com', '+15125550103');
insert into public.volunteers (id, event_id, full_name, email, phone, contact_id)
values ('50000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000e1', 'Kid V.', 'old+kid@example.com', '+15125550101',
        '50000000-0000-0000-0000-0000000000e1');
insert into public.volunteer_assignments (shift_id, volunteer_id)
values ('30000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-0000000000e1'),
       ('30000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-0000000000e2');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform public.purge_volunteers();
    raise exception 'FAIL: a browser ran the volunteer clean-up';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role service_role;
do $$ begin
  assert public.purge_volunteers() = 2, 'an event over 10 days ago loses its volunteer and their under-18 helper';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.volunteers where event_id = '10000000-0000-0000-0000-0000000000e1'), 'no names, emails or phones left';
  assert not exists (select 1 from public.volunteer_assignments where shift_id = '30000000-0000-0000-0000-0000000000e1'), 'nor their sign-ups';
  assert (select registered_count from public.shifts where id = '30000000-0000-0000-0000-0000000000e1') = 2, 'the shift total stays';
  assert exists (select 1 from public.volunteers where id = '50000000-0000-0000-0000-0000000000e3'), 'an event 9 days ago keeps its volunteers';
  assert exists (select 1 from public.volunteers where event_id = '10000000-0000-0000-0000-00000000000a'), 'upcoming events keep theirs';
end $$;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e2');

-- Admin CRM: the pilot pipeline moves itself along; notes, the email log and
-- sign-ins are for FieldCommand admins only.
reset role;
delete from public.platform_admins;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006');
insert into public.pilot_requests (id, name, email, organization)
values ('60000000-0000-0000-0000-0000000000c1', 'Pia Pipeline', 'pia@example.com', 'Pipeline HS');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'pia@example.com', '{"full_name":"Pia Pipeline"}');
insert into auth.audit_log_entries (payload, created_at) values
  ('{"actor_id":"00000000-0000-0000-0000-0000000000c1","action":"login"}', now() - interval '1 hour'),
  ('{"actor_id":"00000000-0000-0000-0000-0000000000c1","action":"token_refreshed"}', now()),
  ('{"actor_id":"00000000-0000-0000-0000-000000000001","action":"login"}', now());
insert into public.email_log (to_email, subject, status, created_at) values
  ('pia@example.com', 'Old note to a host', 'sent', now() - interval '20 days'),
  ('volunteer-only@example.com', 'Old volunteer email', 'sent', now() - interval '20 days'),
  ('volunteer-only@example.com', 'Recent volunteer email', 'sent', now() - interval '2 days'),
  ('pia@example.com', 'Ancient', 'failed', now() - interval '200 days');

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select count(*) from public.email_log) = 0, 'a host can''t read the email log';
  assert (select count(*) from public.admin_notes) = 0, 'or admin notes';
  begin
    insert into public.admin_notes (organization_id, body, author_id)
    values ((select id from public.organizations limit 1), 'sneaky', auth.uid());
    raise exception 'FAIL: a host wrote an admin note';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.admin_sign_ins();
    raise exception 'FAIL: a host listed everyone''s sign-ins';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.admin_auth_history('00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: a host read someone''s sign-in history';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.purge_admin_records();
    raise exception 'FAIL: a browser ran the admin clean-up';
  exception when insufficient_privilege then null;
  end;
end $$;
set role anon;
do $$ begin
  begin
    perform 1 from public.admin_notes;
    raise exception 'FAIL: anon read admin notes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.email_log;
    raise exception 'FAIL: anon read the email log';
  exception when insufficient_privilege then null;
  end;
end $$;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.email_log) = 4, 'an admin reads the email log';
  assert (select count(*) from public.admin_auth_history('00000000-0000-0000-0000-0000000000c1')) = 1,
         'an admin sees one person''s sign-ins, without session refreshes';
  assert exists (select 1 from public.admin_sign_ins() where user_id = '00000000-0000-0000-0000-0000000000c1'),
         'and everyone''s account dates';
  insert into public.admin_notes (pilot_request_id, body, follow_up_on)
  values ('60000000-0000-0000-0000-0000000000c1', 'Call after spring break', current_date + 7);
  assert (select author_id from public.admin_notes where body = 'Call after spring break') = auth.uid(), 'notes are signed by their admin';
  begin
    insert into public.admin_notes (pilot_request_id, body, author_id)
    values ('60000000-0000-0000-0000-0000000000c1', 'Pretending', '00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: an admin wrote a note in someone else''s name';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.admin_notes (body) values ('About nobody');
    raise exception 'FAIL: a note about nothing';
  exception when check_violation then null;
  end;
  update public.admin_notes set done_at = now(), done_by = auth.uid() where body = 'Call after spring break';
  assert (select done_at is not null from public.admin_notes where body = 'Call after spring break'), 'an admin marks a follow-up done';
  begin
    update public.admin_notes set author_id = '00000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: changed who wrote a note';
  exception when insufficient_privilege then null;
  end;

  update public.pilot_requests set status = 'contacted' where id = '60000000-0000-0000-0000-0000000000c1';
  perform public.admin_invite_host('pia@example.com', '60000000-0000-0000-0000-0000000000c1');
  assert (select status from public.pilot_requests where id = '60000000-0000-0000-0000-0000000000c1') = 'invited',
         'inviting the host moves the request to "invited"';
  begin
    update public.pilot_requests set status = 'accepted' where id = '60000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL: an unknown stage';
  exception when check_violation then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"pia@example.com"}';
do $$ begin
  perform public.create_organization('Pipeline Boosters', 'pipeline-boosters');
end $$;
reset role;
do $$ begin
  assert (select status = 'set_up' and organization_id = (select id from public.organizations where slug = 'pipeline-boosters')
            from public.pilot_requests where id = '60000000-0000-0000-0000-0000000000c1'),
         'setting up the organization moves the request to "set up" and links it';
  assert (select subscription_status = 'comped' and free_until = date '2027-01-01'
            from public.organizations where slug = 'pipeline-boosters'),
         'an invited host''s new account starts on the free pilot, through the pilot''s end';
end $$;
insert into public.events (id, organization_id, name, slug, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000c1', (select id from public.organizations where slug = 'pipeline-boosters'),
        'Pipeline Contest', 'pipeline-contest', current_date + 30, current_date + 30, now() + interval '30 days',
        now() + interval '30 days 5 hours', '1 Pipe Rd');
update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c1';
do $$ begin
  assert (select status from public.pilot_requests where id = '60000000-0000-0000-0000-0000000000c1') = 'active',
         'publishing their first event makes the pilot "active"';
end $$;
set role service_role;
do $$ begin
  assert public.purge_admin_records() = 2, 'old emails to people without an account, and anything past 180 days, are removed';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from public.email_log where subject = 'Old note to a host'), 'a host''s 20-day-old email stays';
  assert exists (select 1 from public.email_log where subject = 'Recent volunteer email'), 'a recent volunteer email stays';
end $$;
delete from public.organizations where slug = 'pipeline-boosters';
delete from public.pilot_requests where id = '60000000-0000-0000-0000-0000000000c1';
delete from public.email_log;
delete from public.platform_admins;

-- Admin email templates: FieldCommand admins only.
reset role;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  insert into public.email_templates (name, subject, body) values ('Welcome', 'Welcome, {{first_name}}', 'Hi {{first_name}}!');
  assert (select created_by from public.email_templates where name = 'Welcome') = auth.uid(), 'templates are signed by their admin';
  update public.email_templates set body = 'Hello {{first_name}}!', updated_at = now() where name = 'Welcome';
  assert (select body from public.email_templates where name = 'Welcome') = 'Hello {{first_name}}!', 'an admin edits a template';
  begin
    insert into public.email_templates (name, subject, body, created_by) values ('Fake', 'x', 'y', '00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: a template in someone else''s name';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select count(*) from public.email_templates) = 0, 'a host can''t read email templates';
  begin
    insert into public.email_templates (name, subject, body, created_by) values ('Mine', 'x', 'y', auth.uid());
    raise exception 'FAIL: a host saved an email template';
  exception when insufficient_privilege then null;
  end;
  update public.email_templates set body = 'hacked';
  delete from public.email_templates;
end $$;
set role anon;
do $$ begin
  begin
    perform 1 from public.email_templates;
    raise exception 'FAIL: anon read email templates';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select body from public.email_templates where name = 'Welcome') = 'Hello {{first_name}}!', 'a host can''t change or delete templates';
end $$;
delete from public.email_templates;
delete from public.platform_admins;

-- The database's messages use the company name, and the rules behind them are unchanged.
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$
declare msg text;
begin
  begin
    perform public.create_organization('Name Check Boosters', 'name-check-boosters');
    raise exception 'FAIL: created an organization without an invitation';
  exception when insufficient_privilege then
    get stacked diagnostics msg = message_text;
  end;
  assert msg like '%Field Command Events%', 'the invitation message says Field Command Events';
  begin
    perform * from public.admin_sign_ins();
    raise exception 'FAIL: a non-admin listed sign-ins';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Company banners: admins write them; signed-in people read live ones;
-- visitors only live public ones; people close their own (not urgent ones).
reset role;
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  insert into public.site_banners (title, audience, host_filter) values ('Hosts: new feature', 'hosts', 'pilot');
  insert into public.site_banners (title, audience) values ('Pilot spots filling up', 'public');
  insert into public.site_banners (title, audience, tone) values ('Outage tonight', 'hosts', 'urgent');
  insert into public.site_banners (title, audience, starts_at) values ('Next month', 'hosts', now() + interval '30 days');
  -- Aimed at free teacher accounts, or at everyone but them.
  insert into public.site_banners (title, audience, host_filter, starts_at) values ('Teachers only', 'hosts', 'teacher', now() + interval '30 days');
  insert into public.site_banners (title, audience, host_filter, starts_at) values ('Schools only', 'hosts', 'schools', now() + interval '30 days');
  begin
    insert into public.site_banners (title, audience, host_filter) values ('Bad filter', 'hosts', 'everyone');
    raise exception 'FAIL: a banner with an unknown host filter';
  exception when check_violation then null;
  end;
  assert (select created_by from public.site_banners where title = 'Outage tonight') = auth.uid(), 'banners are signed by their admin';
  begin
    insert into public.site_banners (title, audience, created_by) values ('Fake', 'public', '00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: a banner in someone else''s name';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.site_banners (title, audience, link_url) values ('Bad link', 'public', 'javascript:alert(1)');
    raise exception 'FAIL: a banner with a javascript: link';
  exception when check_violation then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select count(*) from public.site_banners) = 3, 'a signed-in person reads the live banners, not scheduled ones';
  begin
    insert into public.site_banners (title, audience, created_by) values ('Mine', 'public', auth.uid());
    raise exception 'FAIL: a host posted a company banner';
  exception when insufficient_privilege then null;
  end;
  update public.site_banners set title = 'hacked';
  delete from public.site_banners;
  insert into public.site_banner_dismissals (banner_id) select id from public.site_banners where title = 'Hosts: new feature';
  assert (select count(*) from public.site_banner_dismissals) = 1, 'a host closes a banner for themselves';
  begin
    insert into public.site_banner_dismissals (banner_id) select id from public.site_banners where title = 'Outage tonight';
    raise exception 'FAIL: closed an urgent banner';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.site_banner_dismissals (banner_id, user_id)
    select id, '00000000-0000-0000-0000-000000000002' from public.site_banners where title = 'Pilot spots filling up';
    raise exception 'FAIL: closed a banner for someone else';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert (select count(*) from public.site_banner_dismissals) = 0, 'people only see their own dismissals';
end $$;
set role anon;
do $$ begin
  assert (select count(*) from public.site_banners) = 1, 'visitors only see live public banners';
  assert (select title from public.site_banners) = 'Pilot spots filling up', 'the public one';
  begin
    insert into public.site_banner_dismissals (banner_id) select id from public.site_banners;
    raise exception 'FAIL: anon wrote a dismissal';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.site_banners where title = 'hacked') = 0 and (select count(*) from public.site_banners) = 6,
         'a host can''t change or delete banners';
end $$;
delete from public.site_banners;
delete from public.platform_admins;

-- Event banners: hosts and Volunteer Leads post; they can end them early
-- (Volunteer Leads only their own kind); nothing else about a sent one changes.
reset role;
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'volunteer_director'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000003', 'section_lead')
on conflict do nothing;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  insert into public.announcements (event_id, sender_id, audiences, priority, body, ends_at)
  values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{public,band_directors}', 'schedule', 'Band switch: Lakeview now at 2:15', now() + interval '2 hours');
  update public.announcements set ends_at = now() where body = 'Band switch: Lakeview now at 2:15';
  assert (select ends_at <= now() from public.announcements where body = 'Band switch: Lakeview now at 2:15'), 'a host ends a banner early';
  begin
    update public.announcements set body = 'changed' where body = 'Band switch: Lakeview now at 2:15';
    raise exception 'FAIL: changed what a sent banner says';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  insert into public.announcements (event_id, sender_id, audiences, priority, body)
  values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{volunteers,section_leads}', 'routine', 'Lunch is in the cafeteria');
  update public.announcements set ends_at = now() where body = 'Lunch is in the cafeteria';
  assert (select ends_at is not null from public.announcements where body = 'Lunch is in the cafeteria'), 'a Volunteer Lead ends their banner';
  update public.announcements set ends_at = now() + interval '1 day' where body = 'Band switch: Lakeview now at 2:15';
  begin
    insert into public.announcements (event_id, sender_id, audiences, priority, body)
    values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{public}', 'routine', 'To everyone');
    raise exception 'FAIL: a Volunteer Lead posted to the public';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    insert into public.announcements (event_id, sender_id, audiences, priority, body)
    values ('10000000-0000-0000-0000-00000000000a', auth.uid(), '{volunteers}', 'routine', 'From a Section Lead');
    raise exception 'FAIL: a Section Lead posted a banner';
  exception when insufficient_privilege then null;
  end;
  update public.announcements set ends_at = now();
end $$;
reset role;
do $$ begin
  assert (select ends_at <= now() from public.announcements where body = 'Band switch: Lakeview now at 2:15'),
         'a Volunteer Lead can''t change the end of a host''s public banner';
  assert (select count(*) from public.announcements where body = 'Lunch is in the cafeteria' and ends_at is not null) = 1,
         'a Section Lead can''t end banners (the Volunteer Lead had already ended this one)';
end $$;
set role anon;
do $$ begin
  assert (select count(*) from public.announcements where body = 'Band switch: Lakeview now at 2:15') = 1, 'visitors read public banners';
  assert (select count(*) from public.announcements where body = 'Lunch is in the cafeteria') = 0, 'but not the team''s';
end $$;
reset role;
delete from public.announcements where event_id = '10000000-0000-0000-0000-00000000000a' and body in ('Band switch: Lakeview now at 2:15', 'Lunch is in the cafeteria');

-- School fairs: booths belong to fairs only; the host and Volunteer Leads
-- manage them; the event team checks partners in; the public list has no
-- contact details and only listed booths of published fairs.
reset role;
insert into public.events (id, organization_id, name, slug, status, event_type, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000f1', :'org_id', 'Cardinal Renaissance Fair', 'ren-fair', 'draft', 'fair',
        current_date + 10, current_date + 10, now() + interval '10 days', now() + interval '10 days 3 hours', '1 Cardinal Way');
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  insert into public.fair_booths (event_id, title, host_name, zone, contact_email)
  values ('10000000-0000-0000-0000-0000000000f1', 'Dunk Tank', 'Verizon', 'Activity Stations', 'events@verizon.example');
  insert into public.fair_booths (event_id, title, zone, show_publicly)
  values ('10000000-0000-0000-0000-0000000000f1', 'Supply closet', 'Back of house', false);
  begin
    insert into public.fair_booths (event_id, title) values ('10000000-0000-0000-0000-00000000000a', 'Not a fair');
    raise exception 'FAIL: a booth on a band contest';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    update public.fair_booths set arrived_at = now() where title = 'Dunk Tank';
    raise exception 'FAIL: set arrival directly instead of through check-in';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.fair_booths where event_id = '10000000-0000-0000-0000-0000000000f1') = 2, 'a Station Coordinator sees the booths';
  perform public.fair_booth_checkin((select id from public.fair_booths where title = 'Dunk Tank'), true);
  assert (select arrived_at is not null and arrived_by = auth.uid() from public.fair_booths where title = 'Dunk Tank'), 'and checks a partner in';
  begin
    insert into public.fair_booths (event_id, title) values ('10000000-0000-0000-0000-0000000000f1', 'Sneaky booth');
    raise exception 'FAIL: a Station Coordinator added a booth';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.fair_booths) = 0, 'strangers can''t read booths (or partner contacts)';
  begin
    perform public.fair_booth_checkin((select id from public.fair_booths limit 1), false);
    raise exception 'FAIL: a stranger checked a partner in';
  exception when sqlstate 'P0001' or insufficient_privilege then null;
  end;
end $$;
set role anon;
do $$ begin
  assert (select count(*) from public.public_fair_booths('ren-fair')) = 0, 'a draft fair lists nothing';
  begin
    perform 1 from public.fair_booths;
    raise exception 'FAIL: anon read the booths table';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000f1';
set role anon;
do $$ begin
  assert (select count(*) from public.public_fair_booths('ren-fair')) = 1, 'the public sees listed booths only';
  assert (select host_name from public.public_fair_booths('ren-fair')) = 'Verizon', 'with who hosts them';
end $$;
reset role;
do $$ begin
  begin
    update public.events set event_type = 'volunteer' where id = '10000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: a fair with booths changed type';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
-- Fair zones: the host (and Volunteer Leads) create, rename and delete them,
-- carrying booths along; Station Coordinators only read; strangers see none.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  insert into public.fair_zones (event_id, name) values
    ('10000000-0000-0000-0000-0000000000f1', 'Activity Stations'),
    ('10000000-0000-0000-0000-0000000000f1', 'Game Zone');
  begin
    insert into public.fair_zones (event_id, name) values ('10000000-0000-0000-0000-00000000000a', 'Not a fair');
    raise exception 'FAIL: a zone on a band contest';
  exception when sqlstate 'P0001' then null;
  end;
  perform public.rename_fair_zone('10000000-0000-0000-0000-0000000000f1', 'Activity Stations', 'Activities');
  assert (select zone from public.fair_booths where title = 'Dunk Tank') = 'Activities', 'renaming a zone moves its booths';
  assert exists (select 1 from public.fair_zones where event_id = '10000000-0000-0000-0000-0000000000f1' and name = 'Activities'), 'and renames the zone';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.fair_zones where event_id = '10000000-0000-0000-0000-0000000000f1') = 2, 'a Station Coordinator sees the zones';
  begin
    insert into public.fair_zones (event_id, name) values ('10000000-0000-0000-0000-0000000000f1', 'Sneaky zone');
    raise exception 'FAIL: a Station Coordinator added a zone';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.rename_fair_zone('10000000-0000-0000-0000-0000000000f1', 'Game Zone', 'Mine');
    raise exception 'FAIL: a Station Coordinator renamed a zone';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_fair_zone('10000000-0000-0000-0000-0000000000f1', 'Activities');
    raise exception 'FAIL: a Station Coordinator deleted a zone';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.fair_zones) = 0, 'strangers can''t read zones';
  begin
    perform public.delete_fair_zone('10000000-0000-0000-0000-0000000000f1', 'Activities');
    raise exception 'FAIL: a stranger deleted a zone';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  perform public.delete_fair_zone('10000000-0000-0000-0000-0000000000f1', 'Activities');
  assert (select zone is null from public.fair_booths where title = 'Dunk Tank'), 'deleting a zone leaves its booths with no zone';
  assert not exists (select 1 from public.fair_zones where name = 'Activities'), 'and removes the zone';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000f1';

-- ---------------------------------------------------------------------------
-- Demo sample data: filled in by the server only, and taken back off with the
-- demo people
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform public.demo_seed('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', null);
    raise exception 'FAIL: a browser filled an event with sample data';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.demo_samples;
    raise exception 'FAIL: a browser read the sample-data list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address, event_type)
select ('10000000-0000-0000-0000-0000000000d' || n)::uuid, e.organization_id, 'Demo ' || t, 'demo-sample-' || n, 'draft',
       current_date + 20, current_date + 20, now() + interval '20 days', now() + interval '20 days 6 hours', '1 Main St',
       t::public.event_type
  from public.events e,
       (values (1, 'band_contest'), (2, 'group_event'), (3, 'school_visit'), (4, 'fair'), (5, 'volunteer')) v(n, t)
 where e.id = '10000000-0000-0000-0000-00000000000a';

set role service_role;
do $$
declare
  owner constant uuid := '00000000-0000-0000-0000-000000000001';
  director constant uuid := 'd0000000-0000-0000-0000-000000000003';
  ev uuid;
  n int;
begin
  begin
    perform public.demo_seed(owner, '10000000-0000-0000-0000-0000000000d1', director);
    raise exception 'FAIL: sample data without demo mode on';
  exception when sqlstate 'P0001' then null;
  end;

  for n in 1..5 loop
    ev := ('10000000-0000-0000-0000-0000000000d' || n)::uuid;
    insert into public.demo_events (owner_id, event_id) values (owner, ev);
    perform public.demo_seed(owner, ev, director);
    perform public.demo_seed(owner, ev, director);  -- a second switch adds nothing
    assert (select count(*) from public.stations where event_id = ev) = 3, 'three sample stations';
    assert (select count(*) from public.volunteers where event_id = ev) = 14, 'a dozen volunteers plus two students';
    assert (select count(*) from public.volunteers where event_id = ev and minor and contact_id is not null) = 2,
           'the students are signed up by a parent';
    assert (select sum(registered_count) from public.shifts where event_id = ev)
         = (select count(*) from public.volunteer_assignments va join public.shifts s on s.id = va.shift_id where s.event_id = ev),
           'every sign-up is counted';
  end loop;

  assert (select count(*) from public.bands where event_id = '10000000-0000-0000-0000-0000000000d1') = 6, 'a band contest gets bands';
  assert (select count(*) from public.bands where event_id = '10000000-0000-0000-0000-0000000000d2') = 5, 'a group event gets groups';
  assert (select count(*) from public.rooms where event_id = '10000000-0000-0000-0000-0000000000d2') = 3, 'and rooms';
  assert (select count(*) from public.parent_registrations where event_id = '10000000-0000-0000-0000-0000000000d3') = 8,
         'a school visit gets parents';
  assert (select count(*) from public.fair_booths where event_id = '10000000-0000-0000-0000-0000000000d4') = 8, 'a fair gets booths';
  assert not exists (select 1 from public.bands where event_id = '10000000-0000-0000-0000-0000000000d5'), 'a volunteer event gets no bands';
  assert not exists (
    select email from public.volunteers where email is not null and email not like '%@demo.fieldcommandevents.com'
       and event_id::text like '10000000-0000-0000-0000-0000000000d%'
    union all
    select email from public.parent_registrations where email not like '%@demo.fieldcommandevents.com'
       and event_id = '10000000-0000-0000-0000-0000000000d3'
  ), 'sample people are never emailed';

  for n in 1..5 loop
    ev := ('10000000-0000-0000-0000-0000000000d' || n)::uuid;
    perform public.demo_leave(owner, ev);
    assert not exists (select 1 from public.stations where event_id = ev), 'sample stations are gone';
    assert not exists (select 1 from public.volunteers where event_id = ev), 'sample volunteers are gone';
    assert not exists (select 1 from public.bands where event_id = ev), 'sample bands are gone';
    assert not exists (select 1 from public.rooms where event_id = ev), 'sample rooms are gone';
    assert not exists (select 1 from public.parent_registrations where event_id = ev), 'sample parents are gone';
    assert not exists (select 1 from public.fair_booths where event_id = ev), 'sample booths are gone';
    assert not exists (select 1 from public.demo_samples where event_id = ev), 'nothing left on the list';
  end loop;
end $$;
reset role;
delete from public.events where id::text like '10000000-0000-0000-0000-0000000000d%';

-- Demo sample data for a conference: sample families booked into most of its
-- times (setting up sample times if it has none), never emailed, and gone
-- again with the demo people.
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address)
select '10000000-0000-0000-0000-0000000000d6', e.organization_id, 'Demo Conferences', 'demo-sample-6', 'draft', 'conference', 'America/Chicago',
       current_date + 20, current_date + 20,
       ((current_date + 20) + time '15:00') at time zone 'America/Chicago',
       ((current_date + 20) + time '17:00') at time zone 'America/Chicago', ''
  from public.events e where e.id = '10000000-0000-0000-0000-00000000000a';
insert into public.demo_events (owner_id, event_id) values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000d6');
set role service_role;
do $$
declare
  owner constant uuid := '00000000-0000-0000-0000-000000000001';
  ev    constant uuid := '10000000-0000-0000-0000-0000000000d6';
begin
  perform public.demo_seed(owner, ev, null);
  perform public.demo_seed(owner, ev, null);  -- a second switch adds nothing
  assert (select times_saved_at is not null from public.conference_settings where event_id = ev), 'sample meeting times are set up';
  assert (select count(*) from public.conference_bookings where event_id = ev) = 6,
         'two of every three 15-minute times are booked (6 of 8)';
  assert not exists (select 1 from public.stations where event_id = ev), 'a conference gets no stations';
  assert not exists (select 1 from public.volunteers where event_id = ev), 'or volunteers';
  assert not exists (select 1 from public.conference_bookings b, jsonb_array_elements(b.parents) p
                      where b.event_id = ev and p ->> 'email' not like '%@demo.fieldcommandevents.com'),
         'sample families are never emailed';
  assert (select count(*) from public.conference_open_times('demo-sample-6')) = 0, 'a draft still lists no times';
  perform public.demo_leave(owner, ev);
  assert not exists (select 1 from public.conference_bookings where event_id = ev), 'sample bookings are gone';
  assert not exists (select 1 from public.conference_settings where event_id = ev), 'and the sample meeting times';
  assert not exists (select 1 from public.demo_samples where event_id = ev), 'nothing left on the list';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000d6';

-- Pilot requests: only known event types can be saved.
do $$ begin
  begin
    insert into public.pilot_requests (name, email, organization, event_types)
    values ('Odd Type', 'odd@example.com', 'Odd PTO', array['rodeo']);
    raise exception 'FAIL: saved an unknown event type on a pilot request';
  exception when check_violation then null;
  end;
  insert into public.pilot_requests (name, email, organization, event_types)
  values ('Fair Host', 'fairhost@example.com', 'Oak PTO', array['fair', 'volunteer']);
  delete from public.pilot_requests where email = 'fairhost@example.com';
  -- Teachers ask for parent-teacher conferences through the same form.
  insert into public.pilot_requests (name, email, organization, event_types)
  values ('Tess Teacher', 'tess@example.com', 'Oak Elementary', array['conference']);
  delete from public.pilot_requests where email = 'tess@example.com';
end $$;

-- Volunteer reminders: only the server marks a shift as reminded.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    update public.volunteer_assignments set reminded_at = now();
    raise exception 'FAIL: a browser marked volunteer shifts as reminded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Data retention (privacy policy): closing accounts, old pilot requests,
-- directors' details after 2 years, booth contacts after 15 months, files
-- after 30 days. Only FieldCommand admins close accounts; only the server
-- runs the clean-ups.
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f8', 'closehost@example.com', '{"full_name":"Cleo Closing"}'),
  ('00000000-0000-0000-0000-0000000000f9', 'closeteam@example.com', '{"full_name":"Tad Team"}');
insert into public.organizations (id, name, slug)
values ('60000000-0000-0000-0000-000000000001', 'Closing Boosters', 'closing-boosters');
insert into public.organization_members (organization_id, user_id, role)
values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f8', 'owner');
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000a9', '60000000-0000-0000-0000-000000000001', 'Closing Contest', 'closing-contest',
        'published', current_date + 20, current_date + 20, now() + interval '20 days', now() + interval '20 days 6 hours', '9 Close Rd');
-- Their team member also directs a band at another organization's contest, so keeps their account.
insert into public.event_staff (event_id, user_id, role)
values ('10000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000f9', 'section_lead');
insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone, student_count, chaperone_count)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f9', 'Team HS', 'Team Band', '4A', 'addr',
        'closeteam@example.com', 'Tad Team', 'closeteam@example.com', '+15125550109', 40, 5);
insert into public.pilot_requests (name, email, organization, organization_id)
values ('Cleo Closing', 'closehost@example.com', 'Closing Boosters', '60000000-0000-0000-0000-000000000001');
insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences)
values ('10000000-0000-0000-0000-0000000000a9', 'Parking', '10000000-0000-0000-0000-0000000000a9/parking.pdf', 'parking.pdf',
        'application/pdf', 100, array['public']);
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform public.admin_close_account('60000000-0000-0000-0000-000000000001', null);
    raise exception 'FAIL: a host closed an account';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.purge_closed_accounts();
    raise exception 'FAIL: a browser ran the closed-account clean-up';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.user_deletion_queue;
    raise exception 'FAIL: a browser read the account deletion queue';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.purge_band_directors();
    raise exception 'FAIL: a browser ran the directors'' details clean-up';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.expired_event_files();
    raise exception 'FAIL: a browser listed expired files';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
select public.admin_close_account('60000000-0000-0000-0000-000000000001', 'Moving to another tool');
reset role;
do $$ begin
  assert (select closed_at is not null from public.organizations where id = '60000000-0000-0000-0000-000000000001'), 'an admin closes the account';
  assert (select status from public.events where id = '10000000-0000-0000-0000-0000000000a9') = 'draft',
         'closing an account takes its published events offline';
  assert (select (details->>'unpublished')::int from public.admin_log
           where organization_id = '60000000-0000-0000-0000-000000000001' and action = 'account_closed') = 1,
         'the log says how many events went offline';
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000a9';
    raise exception 'FAIL: a closed account published an event';
  exception when insufficient_privilege then null;
  end;
end $$;
set role authenticated;
do $$ begin
  begin
    perform public.admin_close_account('60000000-0000-0000-0000-000000000001', null);
    raise exception 'FAIL: closed an account twice';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
select public.admin_reopen_account('60000000-0000-0000-0000-000000000001', 'Changed their mind');
reset role;
do $$ begin
  assert (select closed_at is null from public.organizations where id = '60000000-0000-0000-0000-000000000001'), 'and can reopen it';
end $$;
set role authenticated;
select public.admin_close_account('60000000-0000-0000-0000-000000000001', null);
reset role;
do $$ begin
  assert (select count(*) from public.admin_log where organization_id = '60000000-0000-0000-0000-000000000001'
            and action in ('account_closed', 'account_reopened')) = 3, 'closing and reopening are logged';
end $$;

set role service_role;
do $$ begin
  assert public.purge_closed_accounts() = 0, 'a just-closed account stays for 90 days';
end $$;
reset role;
update public.organizations set closed_at = now() - interval '91 days' where id = '60000000-0000-0000-0000-000000000001';
set role service_role;
do $$ begin
  assert exists (select 1 from public.expired_event_files() where path = '10000000-0000-0000-0000-0000000000a9/parking.pdf'),
         'its files are handed to the server to remove from storage first';
  assert public.purge_closed_accounts() = 1, '90 days after closing, the account goes';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.organizations where id = '60000000-0000-0000-0000-000000000001'), 'no organization left';
  assert not exists (select 1 from public.events where id = '10000000-0000-0000-0000-0000000000a9'), 'nor its events';
  assert not exists (select 1 from public.pilot_requests where email = 'closehost@example.com'), 'nor its pilot request';
  assert exists (select 1 from public.user_deletion_queue where user_id = '00000000-0000-0000-0000-0000000000f8'),
         'its host, with no other role, is queued for account deletion';
  assert not exists (select 1 from public.user_deletion_queue where user_id = '00000000-0000-0000-0000-0000000000f9'),
         'a team member who directs a band elsewhere keeps their account';
end $$;
set role service_role;
do $$ begin
  assert (select array_agg(u) from public.user_deletions_due() u) = array['00000000-0000-0000-0000-0000000000f8'::uuid],
         'the server is handed the host to delete';
end $$;
reset role;
-- Someone who picks up a role before the server gets to them leaves the queue.
insert into public.organizations (id, name, slug) values ('60000000-0000-0000-0000-000000000002', 'New Start PTO', 'new-start');
insert into public.organization_members (organization_id, user_id, role)
values ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f8', 'owner');
set role service_role;
do $$ begin
  assert not exists (select 1 from public.user_deletions_due()), 'a host who started again isn''t deleted';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.user_deletion_queue), 'and is out of the queue';
end $$;
delete from public.organizations where id = '60000000-0000-0000-0000-000000000002';

-- Pilot requests that never became an account go after a year.
insert into public.pilot_requests (name, email, organization, created_at) values
  ('Old Lead', 'oldlead@example.com', 'Old PTO', now() - interval '13 months'),
  ('New Lead', 'newlead2@example.com', 'New PTO', now() - interval '11 months');
insert into public.pilot_requests (name, email, organization, organization_id, created_at)
values ('Old Customer', 'oldcustomer@example.com', 'Customer Boosters', :'org_id', now() - interval '13 months');
set role service_role;
do $$ begin
  assert public.purge_pilot_requests() = 1, 'a request over a year old with no account is deleted';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.pilot_requests where email = 'oldlead@example.com'), 'the old lead is gone';
  assert exists (select 1 from public.pilot_requests where email = 'newlead2@example.com'), 'a newer one stays';
  assert exists (select 1 from public.pilot_requests where email = 'oldcustomer@example.com'), 'one that became an account stays';
end $$;
delete from public.pilot_requests where email in ('newlead2@example.com', 'oldcustomer@example.com');

-- Directors' details are removed 2 years after the event; the band's name and headcounts stay.
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000b8', :'org_id', 'Ancient Contest', 'ancient-contest', 'published',
        current_date - interval '2 years 5 days', current_date - interval '2 years 5 days',
        now() - interval '2 years 5 days', now() - interval '2 years 5 days' + interval '6 hours', '1 Past Ln'),
       ('10000000-0000-0000-0000-0000000000b9', :'org_id', 'Recent Contest', 'recent-contest', 'published',
        current_date - interval '2 years' + interval '5 days', current_date - interval '2 years' + interval '5 days',
        now() - interval '2 years' + interval '5 days', now() - interval '2 years' + interval '5 days 6 hours', '2 Past Ln');
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          assistant_directors, student_count, chaperone_count, special_needs)
values ('40000000-0000-0000-0000-0000000000b8', '10000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000005',
        'Old HS', 'Old Band', '5A', '1 Old School Rd', 'band@example.com', 'Bo Band', 'band@example.com', '+15125550105',
        array['Ann Assistant'], 90, 10, 'Ramp for a wheelchair'),
       ('40000000-0000-0000-0000-0000000000b9', '10000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000005',
        'Old HS', 'Newer Band', '5A', '1 Old School Rd', 'band@example.com', 'Bo Band', 'band@example.com', '+15125550105',
        '{}', 80, 10, null);
insert into public.band_invitations (event_id, email) values ('10000000-0000-0000-0000-0000000000b8', 'band@example.com');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert exists (select 1 from public.past_band_directors('10000000-0000-0000-0000-00000000000a') d where 'Old Band (Old HS)' = any (d.bands)),
         'before the clean-up, the host can invite the old band''s director back';
end $$;
reset role;
set role service_role;
do $$ begin
  assert public.purge_band_directors() = 1, 'one registration over 2 years old loses its director''s details';
  assert public.purge_band_directors() = 0, 'and only once';
end $$;
reset role;
do $$ begin
  assert (select head_director_name = '' and head_director_email = '' and head_director_phone = '' and contact_email = ''
             and school_address = '' and assistant_directors = '{}' and special_needs is null and details_removed_at is not null
            from public.bands where id = '40000000-0000-0000-0000-0000000000b8'), 'no names, emails, phones, address or notes left';
  assert (select band_name = 'Old Band' and school_name = 'Old HS' and student_count = 90
            from public.bands where id = '40000000-0000-0000-0000-0000000000b8'), 'the band, school and headcount stay';
  assert (select head_director_email = 'band@example.com' from public.bands where id = '40000000-0000-0000-0000-0000000000b9'),
         'a registration under 2 years old keeps its details';
  assert not exists (select 1 from public.band_invitations where event_id = '10000000-0000-0000-0000-0000000000b8'),
         'the old event''s invitations are gone';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert not exists (select 1 from public.past_band_directors('10000000-0000-0000-0000-00000000000a') d where 'Old Band (Old HS)' = any (d.bands)),
         'after it, the old registration no longer offers its director to invite';
end $$;
reset role;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000b8', '10000000-0000-0000-0000-0000000000b9');

-- Fair booth contacts are removed 15 months after the fair.
insert into public.events (id, organization_id, name, slug, status, event_type, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000c8', :'org_id', 'Old Fair', 'old-fair', 'published', 'fair',
        current_date - interval '16 months', current_date - interval '16 months',
        now() - interval '16 months', now() - interval '16 months' + interval '4 hours', '1 Fair Rd'),
       ('10000000-0000-0000-0000-0000000000c9', :'org_id', 'Last Year Fair', 'last-year-fair', 'published', 'fair',
        current_date - interval '14 months', current_date - interval '14 months',
        now() - interval '14 months', now() - interval '14 months' + interval '4 hours', '2 Fair Rd');
insert into public.fair_booths (event_id, title, contact_name, contact_email, contact_phone) values
  ('10000000-0000-0000-0000-0000000000c8', 'Old Dunk Tank', 'Pat Partner', 'pat@partner.example', '+15125550110'),
  ('10000000-0000-0000-0000-0000000000c9', 'New Dunk Tank', 'Pat Partner', 'pat@partner.example', '+15125550110');
set role service_role;
do $$ begin
  assert public.purge_booth_contacts() = 1, 'a booth at a fair over 15 months ago loses its contact';
end $$;
reset role;
do $$ begin
  assert (select contact_name is null and contact_email is null and contact_phone is null and title = 'Old Dunk Tank'
            from public.fair_booths where event_id = '10000000-0000-0000-0000-0000000000c8'), 'the booth stays, without its contact';
  assert (select contact_email = 'pat@partner.example' from public.fair_booths where event_id = '10000000-0000-0000-0000-0000000000c9'),
         'a fair 14 months ago keeps its contacts';
end $$;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000c8', '10000000-0000-0000-0000-0000000000c9');

-- Uploaded files are listed for removal 30 days after the event.
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000d8', :'org_id', 'Old Files Contest', 'old-files', 'published',
        current_date - 35, current_date - 35, now() - interval '35 days', now() - interval '35 days' + interval '6 hours', '1 File Rd'),
       ('10000000-0000-0000-0000-0000000000d9', :'org_id', 'Recent Files Contest', 'recent-files', 'published',
        current_date - 25, current_date - 25, now() - interval '25 days', now() - interval '25 days' + interval '6 hours', '2 File Rd');
insert into public.event_files (event_id, label, path, file_name, content_type, size_bytes, audiences) values
  ('10000000-0000-0000-0000-0000000000d8', 'Old map', '10000000-0000-0000-0000-0000000000d8/map.pdf', 'map.pdf', 'application/pdf', 100, array['public']),
  ('10000000-0000-0000-0000-0000000000d9', 'New map', '10000000-0000-0000-0000-0000000000d9/map.pdf', 'map.pdf', 'application/pdf', 100, array['public']);
set role service_role;
do $$ begin
  assert (select array_agg(path) from public.expired_event_files()) = array['10000000-0000-0000-0000-0000000000d8/map.pdf'],
         'only the file of the event over 30 days ago is due for removal';
end $$;
reset role;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000d8', '10000000-0000-0000-0000-0000000000d9');
delete from public.platform_admins where user_id = '00000000-0000-0000-0000-000000000006';

-- Deleting an event (Edit details → Delete this event): only its hosts can,
-- and everything attached to it goes too (stations, shifts, volunteers, team).
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end,
                           venue_address, volunteer_signup_open)
values ('10000000-0000-0000-0000-0000000000e9', :'org_id', 'Delete Me Fair', 'delete-me', 'published',
        current_date + 20, current_date + 20, now() + interval '20 days', now() + interval '20 days 4 hours',
        '9 Gone Rd', true);
insert into public.stations (id, event_id, name, station_type) values
  ('20000000-0000-0000-0000-0000000000e9', '10000000-0000-0000-0000-0000000000e9', 'Snacks', 'passive');
insert into public.shifts (id, station_id, title, starts_at, ends_at, max_capacity) values
  ('30000000-0000-0000-0000-0000000000e9', '20000000-0000-0000-0000-0000000000e9', 'Snack Shift',
   now() + interval '20 days', now() + interval '20 days 2 hours', 3);
reset role;
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role service_role;
select public.register_volunteer('10000000-0000-0000-0000-0000000000e9', 'Del Volunteer', 'del@example.com', '+15125550188',
       array['30000000-0000-0000-0000-0000000000e9']::uuid[]);
reset role;

-- A Section Lead and a stranger can't delete it (the row just isn't theirs to delete).
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
delete from public.events where id = '10000000-0000-0000-0000-0000000000e9';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
delete from public.events where id = '10000000-0000-0000-0000-0000000000e9';
reset role;
do $$ begin
  assert exists (select 1 from public.events where id = '10000000-0000-0000-0000-0000000000e9'),
         'only a host can delete an event';
end $$;

-- The host can, and its volunteers, shifts, stations and team go with it.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
delete from public.events where id = '10000000-0000-0000-0000-0000000000e9';
reset role;
do $$ begin
  assert not exists (select 1 from public.events where id = '10000000-0000-0000-0000-0000000000e9'), 'the host deleted the event';
  assert not exists (select 1 from public.volunteers where email = 'del@example.com'), 'its volunteers are deleted';
  assert not exists (select 1 from public.shifts where id = '30000000-0000-0000-0000-0000000000e9'), 'its shifts are deleted';
  assert not exists (select 1 from public.stations where id = '20000000-0000-0000-0000-0000000000e9'), 'its stations are deleted';
  assert not exists (select 1 from public.event_staff where event_id = '10000000-0000-0000-0000-0000000000e9'), 'its team is removed';
end $$;

-- Spreadsheet imports. Bands: the host saves directors' details (band_prefills);
-- only the director with that email sees them, nobody is registered.
insert into public.events (id, organization_id, name, slug, status, event_type, starts_on, ends_on, window_start, window_end,
                           venue_address, volunteer_signup_open)
values ('10000000-0000-0000-0000-0000000000f1', :'org_id', 'Import Contest', 'import-contest', 'draft', 'band_contest',
        current_date + 30, current_date + 30, now() + interval '30 days', now() + interval '30 days 8 hours', '1 Sheet Rd', false),
       ('10000000-0000-0000-0000-0000000000f2', :'org_id', 'Import Lunch', 'import-lunch', 'draft', 'school_visit',
        current_date + 30, current_date + 30, now() + interval '30 days', now() + interval '30 days 2 hours', '2 Sheet Rd', false),
       ('10000000-0000-0000-0000-0000000000f3', :'org_id', 'Import Picnic', 'import-picnic', 'draft', 'volunteer',
        current_date + 30, current_date + 30, now() + interval '30 days', now() + interval '30 days 2 hours', '3 Sheet Rd', false);
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 'volunteer_director'),
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003', 'section_lead'),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000003', 'section_lead');
insert into public.stations (id, event_id, name, station_type) values
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1', 'Gate', 'passive');
insert into public.shifts (id, station_id, event_id, title, starts_at, ends_at, max_capacity) values
  ('30000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1',
   'Gate Morning', now() + interval '30 days', now() + interval '30 days 2 hours', 1);

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.band_prefills (event_id, email, school_name, band_name, classification, created_by) values
  ('10000000-0000-0000-0000-0000000000f1', 'band@example.com', 'Sheet High', 'Sheet High Band', '5A',
   '00000000-0000-0000-0000-000000000001');
-- Importing the same row again updates it in place.
insert into public.band_prefills (event_id, email, school_name, band_name, classification, created_by) values
  ('10000000-0000-0000-0000-0000000000f1', 'band@example.com', 'Sheet High', 'Sheet High Band', '6A',
   '00000000-0000-0000-0000-000000000001')
on conflict (event_id, email, band_name) do update
  set event_id = excluded.event_id, email = excluded.email, band_name = excluded.band_name,
      school_name = excluded.school_name, classification = excluded.classification, created_by = excluded.created_by;
do $$ begin
  assert (select count(*) = 1 and min(classification) = '6A' from public.band_prefills where email = 'band@example.com'),
         'a re-import updates the saved details';
  -- Not for a volunteer event, and never in someone else's name.
  begin
    insert into public.band_prefills (event_id, email, band_name, created_by)
    values ('10000000-0000-0000-0000-0000000000f3', 'band@example.com', 'Nope', '00000000-0000-0000-0000-000000000001');
    raise exception 'saved band details for a volunteer event';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.band_prefills (event_id, email, band_name, created_by)
    values ('10000000-0000-0000-0000-0000000000f1', 'band@example.com', 'Nope', '00000000-0000-0000-0000-000000000006');
    raise exception 'saved band details as someone else';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.bands where event_id = '10000000-0000-0000-0000-0000000000f1'),
         'importing registers nobody';
end $$;

set role authenticated;
-- Not a Volunteer Lead, a Section Lead or a stranger: they can't read or add any.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert (select count(*) from public.band_prefills) = 0, 'a Volunteer Lead can''t read saved band details';
  assert (select count(*) from public.my_band_prefills('10000000-0000-0000-0000-0000000000f1')) = 0,
         'nor see them for someone else''s email';
  begin
    insert into public.band_prefills (event_id, email, band_name, created_by)
    values ('10000000-0000-0000-0000-0000000000f1', 'x@example.com', 'Nope', '00000000-0000-0000-0000-000000000002');
    raise exception 'a Volunteer Lead saved band details';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.band_prefills) = 0, 'a stranger can''t read saved band details';
  delete from public.band_prefills;
end $$;
-- The director it names sees their own.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
do $$ begin
  assert (select band_name from public.my_band_prefills('10000000-0000-0000-0000-0000000000f1')) = 'Sheet High Band',
         'the director sees the details saved for them';
  assert (select count(*) from public.band_prefills) = 0, 'but not the table itself';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.my_band_prefills('10000000-0000-0000-0000-0000000000f1');
    raise exception 'anon read saved band details';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.band_prefills where event_id = '10000000-0000-0000-0000-0000000000f1') = 1,
         'the stranger''s delete removed nothing';
end $$;

-- Volunteers: hosts and Volunteer Leads import; a full shift grows to fit.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select public.import_volunteer('10000000-0000-0000-0000-0000000000f1', 'Ida Import', 'ida@example.com', '+15125550170', false,
       '[{"name": "Ivy Importson", "minor": true}]', array['30000000-0000-0000-0000-0000000000f1']::uuid[]) \g /dev/null
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
select public.import_volunteer('10000000-0000-0000-0000-0000000000f1', 'Lia Lead-Added', 'lia@example.com', null, false,
       '[]', array['30000000-0000-0000-0000-0000000000f1']::uuid[]) \g /dev/null
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    perform public.import_volunteer('10000000-0000-0000-0000-0000000000f1', 'No Way', 'noway@example.com', null, false,
            '[]', array['30000000-0000-0000-0000-0000000000f1']::uuid[]);
    raise exception 'a Section Lead imported volunteers';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.import_volunteer('10000000-0000-0000-0000-0000000000f1', 'No Way', 'noway@example.com', null, false,
            '[]', array['30000000-0000-0000-0000-0000000000f1']::uuid[]);
    raise exception 'a stranger imported volunteers';
  exception when insufficient_privilege then null;
  end;
  -- Nor onto another event's shift through an event they don't run.
  begin
    perform public.import_volunteer('10000000-0000-0000-0000-0000000000f3', 'No Way', 'noway@example.com', null, false,
            '[]', array['30000000-0000-0000-0000-0000000000f1']::uuid[]);
    raise exception 'a stranger imported volunteers to an event they don''t run';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select registered_count = 3 and max_capacity = 3 from public.shifts where id = '30000000-0000-0000-0000-0000000000f1'),
         'the full shift grew to fit the three imported people';
  assert exists (select 1 from public.volunteers where full_name = 'Ivy I.' and minor and contact_id is not null),
         'an imported under-18 helper keeps only a last initial';
  assert not exists (select 1 from public.volunteers where email = 'noway@example.com'), 'nobody else was imported';
end $$;

-- A host can't import onto another event's shift through their own event.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform public.import_volunteer('10000000-0000-0000-0000-0000000000f3', 'Wrong Event', 'wrong@example.com', null, false,
            '[]', array['30000000-0000-0000-0000-0000000000f1']::uuid[]);
    raise exception 'imported onto a shift from another event';
  exception when raise_exception then
    if sqlerrm not like '%does not exist%' then raise; end if;
  end;
end $$;

-- Parents: the host of a school visit only, open or not; an email already registered is left alone.
select public.import_parent_registration('10000000-0000-0000-0000-0000000000f2', 'Pam Parent', 'pam@example.com', null,
       '[{"name": "Pia Parent", "teacher": "Smith", "grade": "3rd"}]') \g /dev/null
do $$ begin
  assert public.import_parent_registration('10000000-0000-0000-0000-0000000000f2', 'Someone Else', 'pam@example.com', null,
         '[{"name": "Other Kid", "teacher": "Jones", "grade": "1st"}]') is null, 'a second import of the same email changes nothing';
  begin
    perform public.import_parent_registration('10000000-0000-0000-0000-0000000000f1', 'Pam Parent', 'pam2@example.com', null,
            '[{"name": "Pia Parent", "teacher": "Smith", "grade": "3rd"}]');
    raise exception 'imported parents into a band contest';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  begin
    perform public.import_parent_registration('10000000-0000-0000-0000-0000000000f2', 'Lead Parent', 'leadp@example.com', null,
            '[{"name": "Kid", "teacher": "Smith", "grade": "3rd"}]');
    raise exception 'a Section Lead imported children''s details';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select parent_name = 'Pam Parent' and children -> 0 ->> 'name' = 'Pia Parent'
            from public.parent_registrations where email = 'pam@example.com'), 'the imported family is registered once';
  assert not exists (select 1 from public.parent_registrations where email = 'leadp@example.com'), 'the lead''s import was refused';
end $$;

-- Saved band details go once the event is over.
-- (Two days back, so it's over in the event's own time zone at any hour.)
update public.events set starts_on = current_date - 2, ends_on = current_date - 2,
       window_start = now() - interval '2 days', window_end = now() - interval '44 hours'
 where id = '10000000-0000-0000-0000-0000000000f1';
set role service_role;
do $$ begin
  assert public.purge_band_prefills() = 1, 'saved band details are removed after the event';
end $$;
reset role;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f2',
                                       '10000000-0000-0000-0000-0000000000f3');

-- Stations, step by step: hosts and Volunteer Leads mark a station's details
-- as saved; a Section Lead or a stranger can't.
insert into public.events (id, organization_id, name, slug, status, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000fa', :'org_id', 'Steps Fair', 'steps-fair', 'draft',
        current_date + 40, current_date + 40, now() + interval '40 days', now() + interval '40 days 4 hours', '4 Step Rd');
insert into public.stations (id, event_id, name, station_type) values
  ('20000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000fa', 'Ticket Table', 'passive');
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-000000000002', 'volunteer_director'),
  ('10000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
update public.stations set details_saved_at = now() where id = '20000000-0000-0000-0000-0000000000fa';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
update public.stations set details_saved_at = now() where id = '20000000-0000-0000-0000-0000000000fa';
reset role;
do $$ begin
  assert (select details_saved_at is null from public.stations where id = '20000000-0000-0000-0000-0000000000fa'),
         'a Section Lead or a stranger can''t mark station details saved';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
update public.stations set details_saved_at = now() where id = '20000000-0000-0000-0000-0000000000fa';
reset role;
do $$ begin
  assert (select details_saved_at is not null from public.stations where id = '20000000-0000-0000-0000-0000000000fa'),
         'a Volunteer Lead marks station details saved';
end $$;
delete from public.events where id = '10000000-0000-0000-0000-0000000000fa';

-- Parent-teacher conferences: free (no plan needed), one published per
-- account, ready before publishing; one day; never switch kinds. Settings
-- (with the video link) are for the event's hosts and team only.
reset role;
update public.organizations set subscription_status = 'none' where id = :'org_id';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
insert into public.events (id, organization_id, name, slug, status, event_type, starts_on, ends_on, window_start, window_end, venue_address)
values
  ('10000000-0000-0000-0000-0000000000c1', :'org_id', 'Fall Conferences', 'fall-conf', 'draft', 'conference',
   current_date + 20, current_date + 20, now() + interval '20 days', now() + interval '20 days 4 hours', '1 School Rd'),
  ('10000000-0000-0000-0000-0000000000c2', :'org_id', 'Spring Conferences', 'spring-conf', 'draft', 'conference',
   current_date + 30, current_date + 30, now() + interval '30 days', now() + interval '30 days 4 hours', '1 School Rd'),
  ('10000000-0000-0000-0000-0000000000c3', :'org_id', 'Book Fair Helpers', 'book-fair-helpers', 'draft', 'volunteer',
   current_date + 30, current_date + 30, now() + interval '30 days', now() + interval '30 days 4 hours', '1 School Rd');
reset role;
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000003', 'section_lead');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare ok boolean;
begin
  -- One day only.
  ok := false;
  begin
    update public.events set ends_on = starts_on + 1 where id = '10000000-0000-0000-0000-0000000000c1';
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a conference can''t span two days';
  -- Never switches kinds, either way.
  ok := false;
  begin
    update public.events set event_type = 'volunteer' where id = '10000000-0000-0000-0000-0000000000c1';
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a conference can''t become another kind of event';
  ok := false;
  begin
    update public.events set event_type = 'conference' where id = '10000000-0000-0000-0000-0000000000c3';
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'another kind of event can''t become a conference';
  -- Settings only on conferences.
  ok := false;
  begin
    insert into public.conference_settings (event_id) values ('10000000-0000-0000-0000-0000000000c3');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'meeting times only belong to conferences';
  -- Not ready yet: publishing says what's missing.
  ok := false;
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c1';
  exception when sqlstate 'P0001' then ok := sqlerrm like '%meeting times%';
  end;
  assert ok, 'a conference without meeting times can''t be published';
  insert into public.conference_settings (event_id, meeting_minutes, times_saved_at, meeting_mode, video_link)
  values ('10000000-0000-0000-0000-0000000000c1', 15, now(), 'video', 'https://zoom.us/j/123');
  ok := false;
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c1';
  exception when sqlstate 'P0001' then ok := sqlerrm like '%waiting room%';
  end;
  assert ok, 'a video conference needs the waiting room ticked';
  ok := false;
  begin
    update public.conference_settings set video_link = 'javascript:alert(1)' where event_id = '10000000-0000-0000-0000-0000000000c1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'the meeting link must be an https link';
  update public.conference_settings set waiting_room_confirmed = true where event_id = '10000000-0000-0000-0000-0000000000c1';
  -- Free: publishes without a plan.
  update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c1';
  assert (select status from public.events where id = '10000000-0000-0000-0000-0000000000c1') = 'published',
         'a ready conference publishes without a paid plan';
  -- Only one published at a time.
  insert into public.conference_settings (event_id, meeting_minutes, times_saved_at, meeting_mode, room)
  values ('10000000-0000-0000-0000-0000000000c2', 20, now(), 'in_person', 'Room 214, purple hallway');
  ok := false;
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c2';
  exception when sqlstate 'P0001' then ok := sqlerrm like '%Fall Conferences%';
  end;
  assert ok, 'only one conference can be published at a time';
  update public.events set status = 'draft' where id = '10000000-0000-0000-0000-0000000000c1';
  -- In person needs the school's address (asked in step 2).
  update public.events set venue_address = '' where id = '10000000-0000-0000-0000-0000000000c2';
  ok := false;
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c2';
  exception when sqlstate 'P0001' then ok := sqlerrm like '%address%';
  end;
  assert ok, 'an in-person conference needs the school''s address';
  update public.events set venue_address = '1 School Rd' where id = '10000000-0000-0000-0000-0000000000c2';
  update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c2';
  -- A teacher who sends their own video link needs no link or waiting-room tick here.
  update public.conference_settings set video_link = null, waiting_room_confirmed = false, own_link = true
   where event_id = '10000000-0000-0000-0000-0000000000c1';
  assert public.conference_not_ready('10000000-0000-0000-0000-0000000000c1') is null,
         'a video conference whose teacher sends their own link is ready';
  update public.conference_settings set video_link = 'https://zoom.us/j/123', own_link = false
   where event_id = '10000000-0000-0000-0000-0000000000c1';
  -- Other kinds still need a plan.
  ok := false;
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c3';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'other kinds of event still need a plan to publish';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$
declare ok boolean := false;
begin
  assert (select video_link from public.conference_settings where event_id = '10000000-0000-0000-0000-0000000000c1') = 'https://zoom.us/j/123',
         'the conference''s team can read its settings';
  update public.conference_settings set video_link = 'https://evil.example' where event_id = '10000000-0000-0000-0000-0000000000c1';
  assert (select video_link from public.conference_settings where event_id = '10000000-0000-0000-0000-0000000000c1') = 'https://zoom.us/j/123',
         'the team can''t change the settings';
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000c1';
  exception when others then ok := true;
  end;
  assert ok or (select status from public.events where id = '10000000-0000-0000-0000-0000000000c1') = 'draft',
         'the team can''t publish a conference';
  assert public.conference_not_ready('10000000-0000-0000-0000-0000000000c1') like 'Only the event%',
         'readiness is for the event''s hosts';
  assert public.other_published_conference('10000000-0000-0000-0000-0000000000c1') is null,
         'and so is the other published conference';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.conference_settings) = 0, 'strangers can''t read conference settings';
end $$;
set role anon;
set request.jwt.claims = '';
do $$
declare n integer;
begin
  begin
    select count(*) into n from public.conference_settings;
    raise exception 'FAIL: anonymous visitors read conference settings';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c2',
                                       '10000000-0000-0000-0000-0000000000c3');
update public.organizations set subscription_status = 'comped' where id = :'org_id';

-- Conference bookings: families book open times (one family per time, one
-- meeting per child), the public sees only open times, the team reads
-- bookings, families change or cancel by link, and old bookings are purged.
reset role;
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000d1', :'org_id', 'Ms. Smith Conferences', 'conf-d1', 'published', 'conference', 'America/Chicago',
        current_date + 3, current_date + 3,
        ((current_date + 3) + time '15:00') at time zone 'America/Chicago',
        ((current_date + 3) + time '16:00') at time zone 'America/Chicago', '1 School Rd');
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room)
values ('10000000-0000-0000-0000-0000000000d1', 15, 0, '[{"start": "15:30", "minutes": 15, "label": "Break"}]', now(), 'in_person', 'Room 214');
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000003', 'section_lead');
do $$
declare
  d   date := current_date + 3;
  s1  timestamptz := (d + time '15:00') at time zone 'America/Chicago';
  s2  timestamptz := (d + time '15:15') at time zone 'America/Chicago';
  s3  timestamptz := (d + time '15:45') at time zone 'America/Chicago';
  t1  uuid;
  ok  boolean;
  fam jsonb := '[{"name": "Maria Lopez", "email": "Maria@Example.com"}, {"name": "Jo Lopez", "email": "jo@example.com"}]';
begin
  assert (select array_agg(t order by t) from public.conference_slot_starts('10000000-0000-0000-0000-0000000000d1') t) = array[s1, s2, s3],
         'meeting times skip the break';
  t1 := public.book_conference('10000000-0000-0000-0000-0000000000d1', s1, 'Ava Lopez', fam, 'video', 'Reading');
  assert (select meeting_mode from public.conference_bookings where access_token = t1) = 'in_person',
         'an in-person conference books in person, whatever the form says';
  assert (select parents -> 0 ->> 'email' from public.conference_bookings where access_token = t1) = 'maria@example.com',
         'parents'' emails are stored lower case';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000d1', s1, 'Ben Park', '[{"name": "Kim Park", "email": "kim@example.com"}]', null, null);
  exception when sqlstate 'P0001' then ok := sqlerrm like '%just taken%';
  end;
  assert ok, 'a booked time can''t be booked again';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000d1', s2, ' ava lopez ', fam, null, null);
  exception when sqlstate 'P0001' then ok := sqlerrm like '%already has a meeting%';
  end;
  assert ok, 'a child has one meeting';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000d1', s1 + interval '5 minutes', 'Cy Diaz', '[{"name": "Al Diaz", "email": "al@example.com"}]', null, null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'only real meeting times can be booked';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000d1', s2, 'Cy Diaz', '[{"name": "Al Diaz", "email": "not-an-email"}]', null, null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'each parent needs an email address';
  -- Change from the link: a new time, and a new calendar version.
  perform public.change_conference_booking(t1, s3, null);
  assert (select starts_at = s3 and calendar_sequence = 1 from public.conference_bookings where access_token = t1),
         'a family moves their meeting';
end $$;
-- The public sees only open times, and can't read or make bookings directly.
set role anon;
set request.jwt.claims = '';
do $$
declare ok boolean := false; n integer;
begin
  assert (select count(*) from public.conference_open_times('conf-d1')) = 2, 'the public sees the two open times';
  assert not exists (select 1 from public.conference_open_times('conf-d1') o
                      join (select ((current_date + 3) + time '15:45') at time zone 'America/Chicago' as t) b on o.starts_at = b.t),
         'a booked time isn''t listed';
  begin
    select count(*) into n from public.conference_bookings;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anonymous visitors can''t read bookings';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000d1', now() + interval '3 days', 'X Y', '[]', null, null);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anonymous visitors can''t call the booking function directly';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.conference_bookings) = 0, 'strangers can''t read bookings';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d1') = 0,
         'only the teacher sees bookings, not the event''s team';
  delete from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d1';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d1') = 1,
         'the team can''t cancel bookings';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d1') = 1,
         'the teacher sees their bookings';
  delete from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d1';
end $$;
reset role;
do $$
declare
  t uuid;
  ok boolean := false;
begin
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d1') = 0,
         'the host can cancel a booking';
  -- Cancel by link.
  t := public.book_conference('10000000-0000-0000-0000-0000000000d1', ((current_date + 3) + time '15:15') at time zone 'America/Chicago',
                              'Dee Fox', '[{"name": "Ann Fox", "email": "ann@example.com"}]', null, null);
  perform public.cancel_conference_booking(t);
  assert not exists (select 1 from public.conference_bookings where access_token = t), 'a family cancels by link';
  -- Drafts take no bookings.
  update public.events set status = 'draft' where id = '10000000-0000-0000-0000-0000000000d1';
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000d1', ((current_date + 3) + time '15:15') at time zone 'America/Chicago',
                                   'Dee Fox', '[{"name": "Ann Fox", "email": "ann@example.com"}]', null, null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'an unpublished conference takes no bookings';
  assert (select count(*) from public.conference_open_times('conf-d1')) = 0, 'and lists no times';
  -- Purged 30 days after.
  update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000d1';
  perform public.book_conference('10000000-0000-0000-0000-0000000000d1', ((current_date + 3) + time '15:15') at time zone 'America/Chicago',
                                 'Dee Fox', '[{"name": "Ann Fox", "email": "ann@example.com"}]', null, null);
  update public.events set starts_on = current_date - 40, ends_on = current_date - 40 where id = '10000000-0000-0000-0000-0000000000d1';
  assert public.purge_conference_bookings() = 1, 'bookings are deleted 30 days after the conference';
end $$;
delete from public.events where id = '10000000-0000-0000-0000-0000000000d1';

-- ---------------------------------------------------------------------------
-- Free teacher accounts: by invitation, conferences only
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('0000000a-0000-0000-0000-000000000001', 'teacher@example.com', '{}'),
  ('0000000a-0000-0000-0000-000000000002', 'uninvited@example.com', '{}');
set role authenticated;
-- Without an invitation, nobody makes a teacher account (or an organization).
set request.jwt.claims = '{"sub":"0000000a-0000-0000-0000-000000000002","email":"uninvited@example.com"}';
do $$
declare ok boolean := false;
begin
  begin
    perform public.create_teacher_account('Una Uninvited', 'Oak Elementary', 'America/Chicago');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'a teacher account needs an invitation';
  ok := false;
  begin
    perform public.create_organization('Una Boosters', 'una-boosters');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'so does an organization';
end $$;
reset role;
insert into public.host_invitations (email) values ('teacher@example.com');
set role authenticated;
set request.jwt.claims = '{"sub":"0000000a-0000-0000-0000-000000000001","email":"teacher@example.com"}';
do $$
declare
  org public.organizations;
  ok boolean := false;
begin
  begin
    perform public.create_teacher_account('Tia Teacher', '', 'America/Chicago');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a teacher account needs a school';
  ok := false;
  begin
    perform public.create_teacher_account('Tia Teacher', 'Oak Elementary', 'Not/AZone');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a teacher account needs a real time zone';

  org := public.create_teacher_account('Tia Teacher', 'Oak Elementary', 'America/Chicago');
  assert org.account_kind = 'teacher' and org.school = 'Oak Elementary', 'an invited teacher sets up their account';
  assert org.subscription_status = 'none', 'with no plan: one free conference, weekly hours stay premium';
  assert (select full_name from public.profiles where id = auth.uid()) = 'Tia Teacher', 'their name is saved';
  ok := false;
  begin
    perform public.create_teacher_account('Tia Teacher', 'Oak Elementary', 'America/Chicago');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'one account per person';

  insert into public.events (organization_id, name, slug, event_type, starts_on, ends_on, window_start, window_end, venue_address)
  values (org.id, 'Fall Conferences', 'tia-fall', 'conference', current_date + 5, current_date + 5,
          now() + interval '5 days', now() + interval '5 days 3 hours', '');
  ok := false;
  begin
    insert into public.events (organization_id, name, slug, event_type, starts_on, ends_on, window_start, window_end, venue_address)
    values (org.id, 'Fun Run', 'tia-run', 'volunteer', current_date + 5, current_date + 5,
            now() + interval '5 days', now() + interval '5 days 3 hours', '1 Oak St');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'teacher accounts can only create conferences';

  ok := false;
  begin
    update public.organizations set account_kind = 'standard' where id = org.id;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'a teacher can''t upgrade their own account';
end $$;
reset role;
do $$ begin
  assert (select used_at is not null from public.host_invitations where email = 'teacher@example.com'), 'the teacher''s invitation is used';
end $$;
set role authenticated;
-- A host with an organization can't also make a teacher account.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare ok boolean := false;
begin
  begin
    perform public.create_teacher_account('Hana Host', 'Oak Elementary', 'America/Chicago');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'people who already host can''t make a second account';
end $$;
set role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform public.create_teacher_account('Anon', 'Oak Elementary', 'America/Chicago');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'signing up needs a sign-in';
end $$;
reset role;
do $$
declare ok boolean := false;
begin
  -- Even the server can't add other kinds of events to a teacher account.
  begin
    insert into public.events (organization_id, name, slug, event_type, starts_on, ends_on, window_start, window_end, venue_address)
    values ((select id from public.organizations where school = 'Oak Elementary'), 'Fair', 'tia-fair', 'fair',
            current_date + 5, current_date + 5, now() + interval '5 days', now() + interval '5 days 3 hours', '1 Oak St');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'the conferences-only rule holds for everyone';
end $$;

-- ---------------------------------------------------------------------------
-- Admin tools for teacher accounts: pipeline card, suspend, upgrade
-- ---------------------------------------------------------------------------
select set_config('test.tia_org', id::text, false) from public.organizations where school = 'Oak Elementary';
do $$ begin
  assert (select status from public.pilot_requests
           where organization_id = current_setting('test.tia_org')::uuid) = 'teacher',
         'a teacher sign-up adds a Teacher (free) pipeline card';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"0000000a-0000-0000-0000-000000000001","email":"teacher@example.com"}';
do $$
declare
  org uuid := current_setting('test.tia_org')::uuid;
  ok boolean := false;
begin
  begin
    perform public.admin_upgrade_teacher(org, null);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'a teacher can''t upgrade their own account';
  ok := false;
  begin
    perform public.admin_unsuspend_account(org, null);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'only admins can unsuspend';
end $$;
reset role;
update public.events set status = 'published' where slug = 'tia-fall';
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000006');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$
declare
  org uuid := current_setting('test.tia_org')::uuid;
begin
  assert public.admin_suspend_account(org, 'Spam') = 1, 'suspending unpublishes the account''s events';
end $$;
reset role;
do $$
declare
  org uuid := current_setting('test.tia_org')::uuid;
  ok boolean := false;
begin
  assert (select status from public.events where slug = 'tia-fall') = 'draft', 'the conference is offline';
  assert exists (select 1 from public.admin_log where organization_id = org and action = 'account_suspended'), 'suspending is logged';
  begin
    update public.events set status = 'published' where slug = 'tia-fall';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'a suspended account can''t publish';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$
declare
  org uuid := current_setting('test.tia_org')::uuid;
begin
  perform public.admin_unsuspend_account(org, null);
  perform public.admin_upgrade_teacher(org, 'Joined the pilot');
end $$;
reset role;
do $$
declare
  org uuid := current_setting('test.tia_org')::uuid;
begin
  assert (select account_kind from public.organizations where id = org) = 'standard', 'an admin upgrades a teacher account';
  assert (select status from public.pilot_requests where organization_id = org) = 'set_up', 'its pipeline card moves to Set up';
  update public.events set status = 'published' where slug = 'tia-fall';
  insert into public.events (organization_id, name, slug, event_type, starts_on, ends_on, window_start, window_end, venue_address)
  values (org, 'Fun Run', 'tia-run2', 'volunteer', current_date + 5, current_date + 5,
          now() + interval '5 days', now() + interval '5 days 3 hours', '1 Oak St');
end $$;
delete from public.platform_admins where user_id = '00000000-0000-0000-0000-000000000006';

-- Penetration test hardening (20261129000000_security_hardening.sql) ---------
-- An invitation can't be re-sent within 5 minutes, and one organization can't
-- send more than 40 invitation emails an hour (even by cancelling and re-inviting).
reset role;
insert into public.invitations (event_id, email, role, invited_by)
values ('10000000-0000-0000-0000-00000000000a', 'flood@example.com', 'volunteer_director', '00000000-0000-0000-0000-000000000001');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare ok boolean := false;
begin
  perform public.prepare_invitation_email((select id from public.invitations where email = 'flood@example.com'));
  begin
    perform public.prepare_invitation_email((select id from public.invitations where email = 'flood@example.com'));
  exception when raise_exception then ok := true;
  end;
  assert ok, 'the same invitation can''t be re-sent within 5 minutes';
end $$;
reset role;
update public.invitations set sent_at = null where email = 'flood@example.com';
insert into public.invitation_sends (organization_id)
select e.organization_id from public.events e, generate_series(1, 40) where e.id = '10000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare ok boolean := false;
begin
  begin
    perform public.prepare_invitation_email((select id from public.invitations where email = 'flood@example.com'));
  exception when raise_exception then ok := true;
  end;
  assert ok, 'an organization can''t send more than 40 invitation emails an hour';
end $$;
-- Nobody can read the send records directly.
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.invitation_sends;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'invitation send records are private';
end $$;
reset role;
delete from public.invitation_sends;
delete from public.invitations where email = 'flood@example.com';

-- Visitors who aren't signed in have no write permission on any table.
set role anon;
do $$
declare
  t text;
  ok boolean;
begin
  foreach t in array array['volunteers', 'parent_registrations', 'conference_bookings', 'events', 'organizations',
                           'organization_members', 'profiles', 'bands', 'invitations'] loop
    ok := false;
    begin
      execute format('delete from public.%I', t);
    exception when insufficient_privilege then ok := true;
    end;
    assert ok, format('anon can''t delete from %s', t);
  end loop;
  ok := false;
  begin
    insert into public.volunteers (event_id, full_name, email) values (gen_random_uuid(), 'X', 'x@example.com');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'anon can''t add volunteers directly';
end $$;
reset role;
do $$ begin
  assert not exists (
    select 1 from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ), 'anon holds no write permission on any table';
end $$;

-- Conference outcomes (20261130000000_conference_outcomes.sql) --------------
-- The teacher marks a started meeting Met or No-show; nobody else can.
reset role;
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000000d2', :'org_id', 'Mr. Lee Conferences', 'conf-d2', 'published', 'conference', 'America/Chicago',
        current_date + 3, current_date + 3,
        ((current_date + 3) + time '15:00') at time zone 'America/Chicago',
        ((current_date + 3) + time '16:00') at time zone 'America/Chicago', '1 School Rd');
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room)
values ('10000000-0000-0000-0000-0000000000d2', 15, 0, '[]', now(), 'in_person', 'Room 9');
select set_config('test.outcome_token', public.book_conference('10000000-0000-0000-0000-0000000000d2',
  ((current_date + 3) + time '15:00') at time zone 'America/Chicago', 'Eli Ward', '[{"name": "Sam Ward", "email": "sam@example.com"}]', null, null)::text, false) \g /dev/null
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$
declare
  bid uuid := (select b.id from public.conference_bookings b where b.event_id = '10000000-0000-0000-0000-0000000000d2');
  ok boolean := false;
begin
  begin
    perform public.set_conference_outcome(bid, 'met');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a meeting can''t be marked before it starts';
end $$;
reset role;
update public.conference_bookings set starts_at = now() - interval '10 minutes' where access_token = current_setting('test.outcome_token')::uuid;
set role authenticated;
do $$
declare
  bid uuid := (select b.id from public.conference_bookings b where b.event_id = '10000000-0000-0000-0000-0000000000d2');
  ok boolean := false;
begin
  perform public.set_conference_outcome(bid, 'met');
  assert (select outcome from public.conference_bookings where conference_bookings.id = bid) = 'met', 'the teacher marks a meeting Met';
  perform public.set_conference_outcome(bid, 'no_show');
  assert (select outcome from public.conference_bookings where conference_bookings.id = bid) = 'no_show', 'and changes it to No-show';
  begin
    perform public.set_conference_outcome(bid, 'late');
  exception when sqlstate '22023' then ok := true;
  end;
  assert ok, 'only Met or No-show';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$
declare ok boolean := false;
begin
  begin
    perform public.set_conference_outcome((select id from public.conference_bookings limit 1), 'met');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'strangers can''t mark meetings';
end $$;
reset role;
do $$
declare
  ok boolean := false;
  -- The stranger can't see the booking's id, so try it with the real one too.
  real_id uuid := (select id from public.conference_bookings where access_token = current_setting('test.outcome_token')::uuid);
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}', true);
  begin
    perform public.set_conference_outcome(real_id, 'met');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'strangers can''t mark a meeting even with its id';
end $$;
reset role;
do $$ begin
  assert (select outcome from public.conference_bookings where access_token = current_setting('test.outcome_token')::uuid) = 'no_show',
         'the stranger changed nothing';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  perform public.set_conference_outcome((select id from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d2'), null);
  assert (select outcome is null and outcome_at is null from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d2'),
         'tapping again undoes it';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000d2';

-- Conference bookings, teacher only (20261209000000_conference_teacher_only.sql)
-- On a shared account, only the teacher who set up the conference sees its
-- bookings; another host on the account sees how many are booked, not who.
insert into public.organization_members (organization_id, user_id, role)
values (:'org_id', '00000000-0000-0000-0000-000000000009', 'admin');
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address, created_by)
values ('10000000-0000-0000-0000-0000000000d3', :'org_id', 'Ms. Park Conferences', 'conf-d3', 'published', 'conference', 'America/Chicago',
        current_date + 3, current_date + 3,
        ((current_date + 3) + time '15:00') at time zone 'America/Chicago',
        ((current_date + 3) + time '16:00') at time zone 'America/Chicago', '1 School Rd', '00000000-0000-0000-0000-000000000001');
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room)
values ('10000000-0000-0000-0000-0000000000d3', 15, 0, '[]', now(), 'in_person', 'Room 3');
select set_config('test.park_token', public.book_conference('10000000-0000-0000-0000-0000000000d3',
  ((current_date + 3) + time '15:00') at time zone 'America/Chicago', 'Ivy Chen', '[{"name": "Lin Chen", "email": "lin@example.com"}]', null, 'Math')::text, false) \g /dev/null
update public.conference_bookings set starts_at = now() - interval '10 minutes' where access_token = current_setting('test.park_token')::uuid;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000009","email":"cohost@example.com"}';
do $$
declare
  ok boolean := false;
  real_id uuid;
begin
  assert public.is_event_admin('10000000-0000-0000-0000-0000000000d3'), 'the other host runs the account''s events';
  assert not public.is_conference_teacher('10000000-0000-0000-0000-0000000000d3'), 'but isn''t this conference''s teacher';
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d3') = 0,
         'another host on the account can''t read the teacher''s bookings';
  assert public.conference_booked_count('10000000-0000-0000-0000-0000000000d3') = 1, 'but sees how many times are booked';
  delete from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d3';
  reset role;
  real_id := (select id from public.conference_bookings where access_token = current_setting('test.park_token')::uuid);
  set local role authenticated;
  begin
    perform public.set_conference_outcome(real_id, 'met');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'another host can''t mark the teacher''s meetings';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from public.conference_bookings where access_token = current_setting('test.park_token')::uuid and outcome is null),
         'another host can''t cancel or mark the teacher''s bookings';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert public.conference_booked_count('10000000-0000-0000-0000-0000000000d3') is null, 'strangers get no count';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  assert public.is_conference_teacher('10000000-0000-0000-0000-0000000000d3'), 'the teacher who set it up is its teacher';
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d3') = 1,
         'the teacher reads their bookings';
  perform public.set_conference_outcome((select id from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d3'), 'met');
  delete from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d3';
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000d3') = 0,
         'and can cancel them';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000d3';
delete from public.organization_members where user_id = '00000000-0000-0000-0000-000000000009';

-- Conference bookings follow the day (20261210000000_conference_bookings_follow_day.sql)
-- Changing a conference's day moves each booking to the new day at the same
-- time of day, and bumps its calendar sequence for the updated invites.
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address, created_by)
values ('10000000-0000-0000-0000-0000000000d4', :'org_id', 'Moving Conferences', 'conf-d4', 'published', 'conference', 'America/Chicago',
        current_date + 3, current_date + 3,
        ((current_date + 3) + time '15:00') at time zone 'America/Chicago',
        ((current_date + 3) + time '16:00') at time zone 'America/Chicago', '1 School Rd', '00000000-0000-0000-0000-000000000001');
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room)
values ('10000000-0000-0000-0000-0000000000d4', 15, 0, '[]', now(), 'in_person', 'Room 4');
select set_config('test.move_token', public.book_conference('10000000-0000-0000-0000-0000000000d4',
  ((current_date + 3) + time '15:15') at time zone 'America/Chicago', 'Max Ruiz', '[{"name": "Ana Ruiz", "email": "ana@example.com"}]', null, null)::text, false) \g /dev/null
update public.conference_bookings set reminded_at = now() where access_token = current_setting('test.move_token')::uuid;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$
declare ok boolean := false;
begin
  begin
    perform public.move_conference_bookings('10000000-0000-0000-0000-0000000000d4', 'UTC');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'nobody calls move_conference_bookings directly';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  perform public.reschedule_event('10000000-0000-0000-0000-0000000000d4', current_date + 5, current_date + 5,
    ((current_date + 5) + time '15:00') at time zone 'America/Chicago',
    ((current_date + 5) + time '16:00') at time zone 'America/Chicago', 'America/Chicago');
end $$;
reset role;
do $$ begin
  assert (select starts_at from public.conference_bookings where access_token = current_setting('test.move_token')::uuid)
         = ((current_date + 5) + time '15:15') at time zone 'America/Chicago',
         'a booking moves to the conference''s new day at the same time';
  assert (select calendar_sequence = 1 and reminded_at is null from public.conference_bookings where access_token = current_setting('test.move_token')::uuid),
         'a moved booking gets a new calendar sequence and a fresh reminder';
end $$;
-- A booking left on another day (before this fix) lands on the conference's
-- day the next time the day changes.
update public.conference_bookings set starts_at = ((current_date + 9) + time '15:30') at time zone 'America/Chicago'
 where access_token = current_setting('test.move_token')::uuid;
update public.events set starts_on = current_date + 6, ends_on = current_date + 6,
       window_start = ((current_date + 6) + time '15:00') at time zone 'America/Chicago',
       window_end = ((current_date + 6) + time '16:00') at time zone 'America/Chicago'
 where id = '10000000-0000-0000-0000-0000000000d4';
do $$ begin
  assert (select starts_at from public.conference_bookings where access_token = current_setting('test.move_token')::uuid)
         = ((current_date + 6) + time '15:30') at time zone 'America/Chicago',
         'a stray booking lands on the conference''s day';
end $$;
delete from public.events where id = '10000000-0000-0000-0000-0000000000d4';

-- ---------------------------------------------------------------------------
-- Children's details: the 30 days are counted in the event's own time zone.
-- Kiritimati (UTC+14) and Pago Pago (UTC-11) are always 1 or 2 calendar days
-- apart, so with the same end date one is past 30 days and the other isn't.
-- ---------------------------------------------------------------------------
insert into public.events (id, organization_id, name, slug, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address)
select x.id, :'org_id', x.name, x.slug, x.kind::public.event_type, x.tz,
       (now() at time zone 'Pacific/Kiritimati')::date - 31, (now() at time zone 'Pacific/Kiritimati')::date - 31,
       now() - interval '32 days', now() - interval '32 days' + interval '3 hours', '1 School Rd'
  from (values
    ('10000000-0000-0000-0000-0000000000e1'::uuid, 'East visit', 'tz-east-visit', 'school_visit', 'Pacific/Kiritimati'),
    ('10000000-0000-0000-0000-0000000000e2'::uuid, 'West visit', 'tz-west-visit', 'school_visit', 'Pacific/Pago_Pago'),
    ('10000000-0000-0000-0000-0000000000e3'::uuid, 'East conference', 'tz-east-conf', 'conference', 'Pacific/Kiritimati'),
    ('10000000-0000-0000-0000-0000000000e4'::uuid, 'West conference', 'tz-west-conf', 'conference', 'Pacific/Pago_Pago')
  ) as x(id, name, slug, kind, tz);
insert into public.parent_registrations (event_id, parent_name, email, phone, children)
select id, 'Pat Lee', 'pat@example.com', '+15125550100', '[{"name": "Sam Lee", "teacher": "Ms. Ray", "grade": "2"}]'
  from public.events where id in ('10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e2');
insert into public.conference_bookings (event_id, starts_at, child_name, parents, meeting_mode)
select id, window_start, 'Sam Lee', '[{"name": "Pat Lee", "email": "pat@example.com"}]', 'in_person'
  from public.events where id in ('10000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000e4');
set role service_role;
do $$ begin
  assert not public.parent_data_kept('10000000-0000-0000-0000-0000000000e1'), 'past 30 days in the event''s time zone: hidden';
  assert public.parent_data_kept('10000000-0000-0000-0000-0000000000e2'), 'not yet 30 days in the event''s time zone: still shown';
  assert public.purge_parent_registrations() = 1, 'only the visit past 30 days, local time, is erased';
  assert exists (select 1 from public.parent_registrations where event_id = '10000000-0000-0000-0000-0000000000e2'), 'the other is kept';
  assert public.purge_conference_bookings() = 1, 'only the conference past 30 days, local time, is erased';
  assert exists (select 1 from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000e4'), 'the other is kept';
end $$;
reset role;
delete from public.events where id in ('10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e2',
                                       '10000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000e4');

-- ---------------------------------------------------------------------------
-- "Saved by" (20261203000000_event_saves.sql): each part of an event keeps its
-- last save by a host or Volunteer Lead. Saves by anyone else, background jobs
-- and joining a team don't count. Read only through event_saves(), by the
-- event's hosts and Volunteer Leads.
-- ---------------------------------------------------------------------------
set request.jwt.claims = '';
insert into public.events (id, organization_id, name, slug, event_type, status, starts_on, ends_on, window_start, window_end, venue_address)
values ('10000000-0000-0000-0000-0000000005a1', :'org_id', 'Saves Fair', 'saves-fair', 'fair', 'draft',
        current_date + 40, current_date + 40, now() + interval '40 days', now() + interval '40 days 4 hours', '5 Save Rd');
insert into public.event_staff (event_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-000000000002', 'volunteer_director'),
  ('10000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-000000000003', 'section_lead');
insert into public.stations (id, event_id, name, station_type) values
  ('20000000-0000-0000-0000-0000000005a1', '10000000-0000-0000-0000-0000000005a1', 'Gate', 'passive');
do $$ begin
  assert not exists (select 1 from public.event_saves where event_id = '10000000-0000-0000-0000-0000000005a1'),
         'changes with nobody signed in (background jobs) aren''t saves';
end $$;

-- Someone who doesn't manage the event (a Section Lead, a band director, a stranger) never shows as a save.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
insert into public.fair_zones (event_id, name) values ('10000000-0000-0000-0000-0000000005a1', 'North');
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
update public.events set venue_name = 'Band field' where id = '10000000-0000-0000-0000-0000000005a1';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
insert into public.announcements (event_id, sender_id, audiences, priority, body)
values ('10000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-000000000006', '{volunteers}', 'routine', 'Hi');
-- Joining a team isn't editing it.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","email":"newlead@example.com"}';
insert into public.event_staff (event_id, user_id, role)
values ('10000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-000000000007', 'volunteer_director');
do $$ begin
  assert not exists (select 1 from public.event_saves where event_id = '10000000-0000-0000-0000-0000000005a1'),
         'saves by people who don''t manage the event, or joining a team, aren''t recorded';
end $$;
delete from public.event_staff where event_id = '10000000-0000-0000-0000-0000000005a1'
   and user_id = '00000000-0000-0000-0000-000000000007';

-- The host edits details and opens volunteer sign-up; the Volunteer Lead adds a shift.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set venue_name = 'Main lot', volunteer_signup_open = true where id = '10000000-0000-0000-0000-0000000005a1';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
insert into public.shifts (station_id, title, starts_at, ends_at, max_capacity)
values ('20000000-0000-0000-0000-0000000005a1', 'Morning', now() + interval '40 days', now() + interval '40 days 2 hours', 3);
do $$ begin
  begin
    perform public.record_event_save('10000000-0000-0000-0000-0000000005a1', 'details');
    raise exception 'FAIL: record_event_save can be called directly';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.event_saves) = 0, 'the saves table isn''t readable directly';
  assert (select count(*) from public.event_saves('10000000-0000-0000-0000-0000000005a1')) = 2, 'a Volunteer Lead reads the saves';
  assert (select role = 'Volunteer Lead' and is_you from public.event_saves('10000000-0000-0000-0000-0000000005a1') where area = 'volunteers'),
         'the shift is saved by the Volunteer Lead (you)';
  assert (select name = 'Hana Host' and role = 'Host' and not is_you and managers >= 2
            from public.event_saves('10000000-0000-0000-0000-0000000005a1') where area = 'details'),
         'details are saved by the Host, by name';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert (select count(*) from public.event_saves('10000000-0000-0000-0000-0000000005a1')) = 0, 'a Section Lead can''t read saves';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert (select count(*) from public.event_saves('10000000-0000-0000-0000-0000000005a1')) = 0, 'a stranger can''t read saves';
end $$;
set role anon;
set request.jwt.claims = '';
do $$ begin
  begin
    perform public.event_saves('10000000-0000-0000-0000-0000000005a1');
    raise exception 'FAIL: a visitor read saves';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
-- Turning sign-up on again (no change) or a sign-up count changing isn't a new save.
update public.event_saves set saved_at = now() - interval '1 day' where event_id = '10000000-0000-0000-0000-0000000005a1';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set volunteer_signup_open = true where id = '10000000-0000-0000-0000-0000000005a1';
reset role;
update public.shifts set registered_count = registered_count + 1 where station_id = '20000000-0000-0000-0000-0000000005a1';
do $$ begin
  assert (select bool_and(saved_at < now() - interval '12 hours') from public.event_saves
           where event_id = '10000000-0000-0000-0000-0000000005a1'), 'no-change updates aren''t saves';
end $$;
delete from public.events where id = '10000000-0000-0000-0000-0000000005a1';
do $$ begin
  assert not exists (select 1 from public.event_saves where event_id = '10000000-0000-0000-0000-0000000005a1'),
         'deleting the event removes its saves';
end $$;
set request.jwt.claims = '';

-- ---------------------------------------------------------------------------
-- Account logo for volunteer badges (20261205000000_org_logo.sql): only the
-- account's hosts set it, only into the account's own folder, and nobody
-- writes the column directly.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select public.set_org_logo(:'org_id', :'org_id' || '/logo.png') as first_old \gset
do $$ begin
  assert (select logo_path from public.organizations where id = (select organization_id from public.organization_members
            where user_id = '00000000-0000-0000-0000-000000000001' limit 1)) like '%/logo.png', 'a host sets the account logo';
end $$;
select public.set_org_logo(:'org_id', :'org_id' || '/new.png') as old_path \gset
\if :{?old_path}
\else
  \echo 'FAIL: no previous logo path returned'
  select 1/0;
\endif
do $$ begin
  begin
    perform public.set_org_logo((select organization_id from public.organization_members
                                  where user_id = '00000000-0000-0000-0000-000000000001' limit 1), '00000000-0000-0000-0000-00000000dead/x.png');
    raise exception 'FAIL: a logo was set from another account''s folder';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.organizations set logo_path = null;
    raise exception 'FAIL: the logo column was written directly';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A Volunteer Lead, a Section Lead and a stranger can't change it.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  begin
    perform public.set_org_logo((select organization_id from public.events where slug = 'future'), null);
    raise exception 'FAIL: a Volunteer Lead changed the account logo';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.set_org_logo((select organization_id from public.events where slug = 'future'), null);
    raise exception 'FAIL: a stranger changed the account logo';
  exception when insufficient_privilege then null;
  end;
end $$;
set role anon;
set request.jwt.claims = '';
do $$ begin
  begin
    perform public.set_org_logo((select id from public.organizations limit 1), null);
    raise exception 'FAIL: a visitor changed an account logo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select logo_path from public.organizations where id = (select organization_id from public.events where slug = 'future')) like '%/new.png',
         'the logo is unchanged by people who can''t set it';
end $$;

-- ---------------------------------------------------------------------------
-- Account color (20261206000000_org_brand_color.sql): only the account's hosts
-- set it, only as a #rrggbb color, and nobody writes the column directly.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
select public.set_org_brand_color(:'org_id', '#7a1f2b');
do $$ begin
  assert (select brand_color from public.organizations where id = (select organization_id from public.events where slug = 'future')) = '#7a1f2b',
         'a host sets the account color';
  begin
    perform public.set_org_brand_color((select organization_id from public.events where slug = 'future'), 'red; drop table events');
    raise exception 'FAIL: a color that isn''t #rrggbb was saved';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.organizations set brand_color = '#000000';
    raise exception 'FAIL: the color column was written directly';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  begin
    perform public.set_org_brand_color((select organization_id from public.events where slug = 'future'), '#000000');
    raise exception 'FAIL: a Volunteer Lead changed the account color';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.set_org_brand_color((select organization_id from public.events where slug = 'future'), '#000000');
    raise exception 'FAIL: a stranger changed the account color';
  exception when insufficient_privilege then null;
  end;
end $$;
set role anon;
set request.jwt.claims = '';
do $$ begin
  begin
    perform public.set_org_brand_color((select id from public.organizations limit 1), '#000000');
    raise exception 'FAIL: a visitor changed an account color';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select brand_color from public.organizations where id = (select organization_id from public.events where slug = 'future')) = '#7a1f2b',
         'the color is unchanged by people who can''t set it';
end $$;

-- ---------------------------------------------------------------------------
-- Director withdraw (20261207000000_director_withdraw.sql): a director marks
-- only their own band withdrawn; nobody else can, and it can't be undone by them.
-- ---------------------------------------------------------------------------
reset role;
insert into public.bands (id, event_id, director_user_id, school_name, band_name, classification, school_address,
                          contact_email, head_director_name, head_director_email, head_director_phone,
                          student_count, chaperone_count)
values ('40000000-0000-0000-0000-0000000000dd', '10000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-000000000005', 'West HS', 'Westwind Winds', '5A', 'addr',
        'band@example.com', 'Bo Band', 'band@example.com', '+15125550105', 60, 8);
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  begin
    perform public.withdraw_my_band('40000000-0000-0000-0000-0000000000dd');
    raise exception 'FAIL: a stranger withdrew someone else''s band';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform public.withdraw_my_band('40000000-0000-0000-0000-0000000000dd');
    raise exception 'FAIL: a host used the director''s withdraw';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"band@example.com"}';
select public.withdraw_my_band('40000000-0000-0000-0000-0000000000dd');
-- Undoing it isn't theirs to do: a direct write fails or changes nothing (checked below).
do $$ begin
  begin
    update public.bands set scratched_at = null where id = '40000000-0000-0000-0000-0000000000dd';
  exception when insufficient_privilege then null;
  end;
end $$;
set role anon;
set request.jwt.claims = '';
do $$ begin
  begin
    perform public.withdraw_my_band('40000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: a visitor withdrew a band';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select scratched_at from public.bands where id = '40000000-0000-0000-0000-0000000000dd') is not null,
         'the director withdrew their band, and only the organizer can undo it';
end $$;

-- ---------------------------------------------------------------------------
-- Pending band registrations (20261208000000_pending_band_registrations.sql):
-- only our server touches them. Visitors and signed-in people can't read,
-- add, or change one.
-- ---------------------------------------------------------------------------
reset role;
insert into public.pending_band_registrations (event_id, email, details)
values ('10000000-0000-0000-0000-00000000000a', 'someone@example.com', '{"band_name":"Waiting Winds"}');
set role anon;
set request.jwt.claims = '';
do $$ begin
  begin
    perform 1 from public.pending_band_registrations;
    raise exception 'FAIL: a visitor read pending registrations';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.pending_band_registrations (event_id, email, details)
    values ('10000000-0000-0000-0000-00000000000a', 'x@example.com', '{}');
    raise exception 'FAIL: a visitor added a pending registration';
  exception when insufficient_privilege then null;
  end;
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform 1 from public.pending_band_registrations;
    raise exception 'FAIL: a host read pending registrations';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"someone@example.com"}';
do $$ begin
  begin
    delete from public.pending_band_registrations;
    raise exception 'FAIL: a signed-in person deleted pending registrations';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.pending_band_registrations where email = 'someone@example.com') = 1,
         'pending registrations are untouched by browsers';
end $$;


-- ---------------------------------------------------------------------------
-- Conference weekly hours and phone calls (20261211000000_conference_weekly_hours.sql)
-- ---------------------------------------------------------------------------
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address, created_by)
values ('10000000-0000-0000-0000-0000000000e1', :'org_id', 'Ms. Park Call Hours', 'calls-e1', 'draft', 'conference', 'America/Chicago',
        (now() at time zone 'America/Chicago')::date, (now() at time zone 'America/Chicago')::date,
        now(), now() + interval '1 hour', '', '00000000-0000-0000-0000-000000000001');
-- Every day 3 to 4, 15-minute calls, a day off, 24 hours' notice, two weeks ahead.
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, schedule,
                                        weekly_hours, closed_dates, min_notice_hours, max_days_ahead)
values ('10000000-0000-0000-0000-0000000000e1', 15, 0, '[]', now(), 'phone', 'weekly',
        (select jsonb_agg(jsonb_build_object('day', d, 'start', '15:00', 'end', '16:00')) from generate_series(0, 6) d),
        jsonb_build_array(((now() at time zone 'America/Chicago')::date + 3)::text), 24, 14);
do $$
declare
  ok boolean := false;
  today date := (now() at time zone 'America/Chicago')::date;
begin
  -- Weekly hours run between the first and last day.
  update public.events set ends_on = today + 60 where id = '10000000-0000-0000-0000-0000000000e1';
  begin
    update public.conference_settings set schedule = 'one_day' where event_id = '10000000-0000-0000-0000-0000000000e1';
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a conference day has to be one day';
  ok := false;
  begin
    update public.conference_settings set weekly_hours = '[{"day": 2, "start": "16:30", "end": "15:30"}]'
     where event_id = '10000000-0000-0000-0000-0000000000e1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'weekly hours have to end after they start';
  ok := false;
  begin
    update public.conference_settings set closed_dates = '["next tuesday"]' where event_id = '10000000-0000-0000-0000-0000000000e1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'days off are dates';
  update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000e1';
end $$;

set role anon;
do $$
declare
  today date := (now() at time zone 'America/Chicago')::date;
  times timestamptz[];
begin
  select array_agg(starts_at) into times from public.conference_open_times('calls-e1');
  assert (select min(t) from unnest(times) t) > now() + interval '24 hours', 'families book at least 24 hours ahead';
  assert (select max((t at time zone 'America/Chicago')::date) from unnest(times) t) <= today + 14, 'and up to two weeks ahead';
  assert not exists (select 1 from unnest(times) t where (t at time zone 'America/Chicago')::date = today + 3), 'not on a day off';
  assert (select count(*) from unnest(times) t where (t at time zone 'America/Chicago')::date = today + 5) = 4,
         'four 15-minute calls each day from 3 to 4';
end $$;
reset role;

set role service_role;
do $$
declare
  day5 timestamptz := (((now() at time zone 'America/Chicago')::date + 5) + time '15:00') at time zone 'America/Chicago';
  ok boolean := false;
  tok uuid;
begin
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000e1', day5, 'Ivy Chen',
      '[{"name": "Lin Chen", "email": "lin@example.com"}]', null, null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'phone calls need a number to call';
  tok := public.book_conference('10000000-0000-0000-0000-0000000000e1', day5, 'Ivy Chen',
    '[{"name": "Lin Chen", "email": "lin@example.com"}]', null, null, '(512) 555-0101');
  assert (select meeting_mode = 'phone' and call_phone = '5125550101' from public.conference_bookings where access_token = tok),
         'the family''s number is saved for the teacher to call';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000e1', day5 + interval '15 minutes', 'ivy chen',
      '[{"name": "Lin Chen", "email": "lin@example.com"}]', null, null, '5125550101');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'one upcoming meeting per child';
  -- Once it's past, the family can book again.
  update public.conference_bookings set starts_at = now() - interval '2 days' where access_token = tok;
  perform public.book_conference('10000000-0000-0000-0000-0000000000e1', day5 + interval '15 minutes', 'Ivy Chen',
    '[{"name": "Lin Chen", "email": "lin@example.com"}]', null, null, '5125550101');
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000e1') = 2,
         'with weekly hours, a family books again after their meeting';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000e1', now() + interval '2 hours', 'Max Ruiz',
      '[{"name": "Ana Ruiz", "email": "ana@example.com"}]', null, null, '5125550102');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'not inside the notice';

  -- Children's details go 30 days after each meeting, not after the last day.
  update public.conference_bookings set starts_at = now() - interval '32 days' where access_token = tok;
  assert public.purge_conference_bookings() = 1, 'a weekly meeting is deleted 30 days after it';
  assert (select count(*) from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000e1') = 1,
         'and the upcoming one is kept';
end $$;
reset role;
do $$
declare before timestamptz;
begin
  before := (select starts_at from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000e1');
  update public.events set starts_on = starts_on + 1 where id = '10000000-0000-0000-0000-0000000000e1';
  assert (select starts_at from public.conference_bookings where event_id = '10000000-0000-0000-0000-0000000000e1') = before,
         'weekly meetings stay put when the first day changes';
end $$;
delete from public.events where id = '10000000-0000-0000-0000-0000000000e1';

-- Weekly hours are premium: a free teacher account can't publish them until it has a plan.
set role authenticated;
set request.jwt.claims = '{"sub":"0000000a-0000-0000-0000-000000000001","email":"teacher@example.com"}';
do $$
declare
  org uuid := (select organization_id from public.organization_members where user_id = auth.uid());
  today date := (now() at time zone 'America/Chicago')::date;
  ok boolean := false;
begin
  insert into public.events (id, organization_id, name, slug, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address, created_by)
  values ('10000000-0000-0000-0000-0000000000e2', org, 'Tia Call Hours', 'tia-calls', 'conference', 'America/Chicago',
          today, today, now(), now() + interval '1 hour', '', auth.uid());
  insert into public.conference_settings (event_id, meeting_minutes, times_saved_at, meeting_mode, schedule, weekly_hours)
  values ('10000000-0000-0000-0000-0000000000e2', 15, now(), 'phone', 'weekly', '[{"day": 2, "start": "15:00", "end": "16:00"}]');
  update public.events set ends_on = today + 30 where id = '10000000-0000-0000-0000-0000000000e2';
  begin
    update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000e2';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'weekly hours need a plan';
end $$;
reset role;
update public.organizations set subscription_status = 'comped', free_until = null
 where id = (select organization_id from public.events where id = '10000000-0000-0000-0000-0000000000e2');
set role authenticated;
do $$ begin
  update public.events set status = 'published' where id = '10000000-0000-0000-0000-0000000000e2';
  assert (select status = 'published' from public.events where id = '10000000-0000-0000-0000-0000000000e2'),
         'with a plan, weekly hours publish';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000e2';

-- ---------------------------------------------------------------------------
-- Event email settings (where replies go): Hosts only, never the public or
-- the event team, and only a plain email address.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  insert into public.event_email_settings (event_id, replies, reply_to)
  values ('10000000-0000-0000-0000-00000000000a', true, 'info@boosters.org');
  assert (select reply_to from public.event_email_settings where event_id = '10000000-0000-0000-0000-00000000000a') = 'info@boosters.org',
         'a host saves where replies go';
  update public.event_email_settings set replies = false where event_id = '10000000-0000-0000-0000-00000000000a';
  assert (select not replies from public.event_email_settings where event_id = '10000000-0000-0000-0000-00000000000a'),
         'a host turns replies off';
  begin
    update public.event_email_settings set reply_to = 'x@y.org>, evil@z.org' where event_id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: a reply address with extra recipients was saved';
  exception when check_violation then null;
  end;
end $$;
-- Volunteer Lead, Section Lead and a stranger: can't see or change it.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"director@example.com"}';
do $$ begin
  assert not exists (select 1 from public.event_email_settings), 'a Volunteer Lead can''t read where replies go';
  update public.event_email_settings set reply_to = 'vl@example.com' where event_id = '10000000-0000-0000-0000-00000000000a';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"lead@example.com"}';
do $$ begin
  assert not exists (select 1 from public.event_email_settings), 'a Section Lead can''t read where replies go';
end $$;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
do $$ begin
  assert not exists (select 1 from public.event_email_settings), 'a stranger can''t read where replies go';
  begin
    insert into public.event_email_settings (event_id, replies, reply_to)
    values ('10000000-0000-0000-0000-00000000000b', true, 'phish@example.com');
    raise exception 'FAIL: a stranger set where an event''s replies go';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select reply_to from public.event_email_settings where event_id = '10000000-0000-0000-0000-00000000000a') = 'info@boosters.org',
         'the Volunteer Lead''s change didn''t apply';
end $$;
set role anon;
do $$ begin
  begin
    perform 1 from public.event_email_settings;
    raise exception 'FAIL: the public read event email settings';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.calendar_entries(array[]::uuid[], false);
    raise exception 'FAIL: the public called calendar_entries';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.event_email_settings;

-- ---------------------------------------------------------------------------
-- Several ways to meet: a teacher offers any mix of in person, video and phone;
-- each family picks one the teacher offers, and a phone call needs a number.
-- ---------------------------------------------------------------------------
reset role;
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address, created_by)
values ('10000000-0000-0000-0000-0000000000f1', :'org_id', 'Ms. Ito Conferences', 'conf-f1', 'published', 'conference', 'America/Chicago',
        current_date + 3, current_date + 3,
        ((current_date + 3) + time '15:00') at time zone 'America/Chicago',
        ((current_date + 3) + time '16:00') at time zone 'America/Chicago', '1 School Rd', '00000000-0000-0000-0000-000000000001');
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_modes, room)
values ('10000000-0000-0000-0000-0000000000f1', 15, 0, '[]', now(), array['in_person', 'phone'], 'Room 9');
do $$
declare
  d    date := current_date + 3;
  s1   timestamptz := (d + time '15:00') at time zone 'America/Chicago';
  s2   timestamptz := (d + time '15:15') at time zone 'America/Chicago';
  s3   timestamptz := (d + time '15:30') at time zone 'America/Chicago';
  t_in uuid;
  t_ph uuid;
  fam  jsonb := '[{"name": "Lee Ito", "email": "lee@example.com"}]';
  ok   boolean;
begin
  assert (select meeting_mode from public.conference_settings where event_id = '10000000-0000-0000-0000-0000000000f1') = 'in_person',
         'the old single column follows the list';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000f1', s1, 'Kai Ito', fam, 'video', null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a family can''t pick a way the teacher doesn''t offer';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000f1', s1, 'Kai Ito', fam, null, null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'with several ways, the family has to pick one';
  ok := false;
  begin
    perform public.book_conference('10000000-0000-0000-0000-0000000000f1', s1, 'Kai Ito', fam, 'phone', null);
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'a phone call needs a number to call';
  t_ph := public.book_conference('10000000-0000-0000-0000-0000000000f1', s1, 'Kai Ito', fam, 'phone', null, '(512) 555-0199');
  assert (select meeting_mode = 'phone' and call_phone = '5125550199' from public.conference_bookings where access_token = t_ph),
         'a family books a phone call';
  t_in := public.book_conference('10000000-0000-0000-0000-0000000000f1', s2, 'Mia Ito', fam, 'in_person', null, '5125550199');
  assert (select meeting_mode = 'in_person' and call_phone is null from public.conference_bookings where access_token = t_in),
         'an in-person meeting keeps no number to call';
  ok := false;
  begin
    perform public.change_conference_booking(t_in, s3, 'phone');
  exception when sqlstate 'P0001' then ok := true;
  end;
  assert ok, 'switching to a phone call needs a number';
  perform public.change_conference_booking(t_in, s3, 'phone', '512-555-0123');
  assert (select meeting_mode = 'phone' and call_phone = '5125550123' and starts_at = s3
            from public.conference_bookings where access_token = t_in),
         'a family switches to a phone call';
  perform public.change_conference_booking(t_ph, s2, 'in_person');
  assert (select meeting_mode = 'in_person' and call_phone is null from public.conference_bookings where access_token = t_ph),
         'switching away from a call drops the number';
  ok := false;
  begin
    update public.conference_settings set meeting_modes = array['fax'] where event_id = '10000000-0000-0000-0000-0000000000f1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'only in person, video and phone';
  ok := false;
  begin
    update public.conference_settings set meeting_modes = array['video', 'video'] where event_id = '10000000-0000-0000-0000-0000000000f1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'each way once';
  ok := false;
  begin
    update public.conference_settings set meeting_modes = array[]::text[] where event_id = '10000000-0000-0000-0000-0000000000f1';
  exception when check_violation then ok := true;
  end;
  assert ok, 'at least one way';
  -- The app from before this update still sets the old column.
  update public.conference_settings set meeting_mode = 'either' where event_id = '10000000-0000-0000-0000-0000000000f1';
  assert (select meeting_modes = array['in_person', 'video'] from public.conference_settings where event_id = '10000000-0000-0000-0000-0000000000f1'),
         'the list follows the old single column';
end $$;
-- Publishing checks every way offered: adding video needs its link.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  update public.conference_settings set meeting_modes = array['in_person', 'phone'] where event_id = '10000000-0000-0000-0000-0000000000f1';
  assert public.conference_not_ready('10000000-0000-0000-0000-0000000000f1') is null, 'in person and phone with a room is ready';
  update public.conference_settings set meeting_modes = array['phone', 'video'] where event_id = '10000000-0000-0000-0000-0000000000f1';
  assert public.conference_not_ready('10000000-0000-0000-0000-0000000000f1') = 'Add your meeting link first (step 2).',
         'adding video needs a meeting link';
end $$;
reset role;
delete from public.events where id = '10000000-0000-0000-0000-0000000000f1';

-- Tables get no access automatically (Supabase from October 30, 2026), so a
-- migration that creates one must grant it: the server's key needs every table.
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and not has_table_privilege('service_role', c.oid, 'select, insert, update, delete');
  if missing is not null then
    raise exception 'FAIL: grant select, insert, update, delete to service_role on: %', missing;
  end if;
  -- The live database still has today's access; this keeps the tests honest about it.
  assert has_table_privilege('anon', 'public.events', 'select'), 'published events stay readable by visitors';
  assert not has_table_privilege('anon', 'public.events', 'insert'), 'visitors still can''t write';
  assert not has_table_privilege('authenticated', 'public.event_email_settings', 'insert'),
         'reply settings stay limited to their own columns';
end $$;

-- The QA outbox: only the server (its own key) reads or writes it.
do $$ begin
  assert not has_table_privilege('anon', 'public.qa_outbox', 'select'), 'visitors can''t read the QA outbox';
  assert not has_table_privilege('authenticated', 'public.qa_outbox', 'select'), 'signed-in people can''t read the QA outbox';
  assert not has_table_privilege('authenticated', 'public.qa_outbox', 'insert'), 'signed-in people can''t write to the QA outbox';
  assert has_table_privilege('service_role', 'public.qa_outbox', 'insert'), 'the server saves QA emails';
  -- QA comments and replies: the same.
  assert not has_table_privilege('anon', 'public.qa_comments', 'select'), 'visitors can''t read QA comments';
  assert not has_table_privilege('authenticated', 'public.qa_comments', 'select'), 'signed-in people can''t read QA comments';
  assert not has_table_privilege('authenticated', 'public.qa_comment_replies', 'insert'), 'signed-in people can''t write QA replies';
  assert has_table_privilege('service_role', 'public.qa_comment_replies', 'insert'), 'the server saves QA replies';
  -- Site visit counts: the same, and only the server can add to them.
  assert not has_table_privilege('anon', 'public.site_metrics', 'select'), 'visitors can''t read site visit counts';
  assert not has_table_privilege('anon', 'public.site_metrics', 'insert'), 'visitors can''t write site visit counts';
  assert not has_table_privilege('authenticated', 'public.site_metrics', 'select'), 'signed-in people can''t read site visit counts';
  assert not has_function_privilege('anon', 'public.bump_site_metric(date, text, text, text, text)', 'execute'), 'visitors can''t add to the counts directly';
  assert not has_function_privilege('authenticated', 'public.bump_site_metric(date, text, text, text, text)', 'execute'), 'signed-in people can''t add to the counts directly';
  assert has_function_privilege('service_role', 'public.bump_site_metric(date, text, text, text, text)', 'execute'), 'the server adds to the counts';
end $$;
-- Counting twice adds up, in one row; a click's label keeps it apart.
select public.bump_site_metric('2026-10-24', '/', 'Google', 'view');
select public.bump_site_metric('2026-10-24', '/', 'Google', 'view');
select public.bump_site_metric('2026-10-24', '/', 'Google', 'click', 'Header: FAQ');
do $$ begin
  assert (select count from public.site_metrics where day = '2026-10-24' and path = '/' and source = 'Google' and event = 'view') = 2,
         'two visits make a count of two';
  assert (select count from public.site_metrics where day = '2026-10-24' and event = 'click' and label = 'Header: FAQ') = 1,
         'a click is counted under its label';
  begin
    perform public.bump_site_metric('2026-10-24', '/', 'Google', 'hovered');
    raise exception 'FAIL: an unknown kind of count was saved';
  exception when check_violation then null;
  end;
end $$;
delete from public.site_metrics where day = '2026-10-24';
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
do $$ begin
  begin
    perform 1 from public.qa_outbox;
    raise exception 'FAIL: a signed-in person read the QA outbox';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.qa_comments;
    raise exception 'FAIL: a signed-in person read QA comments';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.bump_site_metric('2026-10-24', '/', 'Google', 'view');
    raise exception 'FAIL: a signed-in person added to the site visit counts';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Conferences that don't ask for the child's name: none is kept, and a family
-- books one meeting per first parent's email
-- ---------------------------------------------------------------------------
reset role;
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address, ask_child_name)
values ('1c000000-0000-0000-0000-000000000001', :'org_id', 'No-Name Conferences', 'conf-no-child', 'published', 'conference', 'America/Chicago',
        current_date + 3, current_date + 3,
        ((current_date + 3) + time '09:00') at time zone 'America/Chicago',
        ((current_date + 3) + time '10:00') at time zone 'America/Chicago', '1 School Rd', false);
insert into public.conference_settings (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room)
values ('1c000000-0000-0000-0000-000000000001', 20, 0, '[]', now(), 'in_person', 'Room 5');
do $$
declare
  d  date := current_date + 3;
  s1 timestamptz := (d + time '09:00') at time zone 'America/Chicago';
  s2 timestamptz := (d + time '09:20') at time zone 'America/Chicago';
  t1 uuid;
  ok boolean := false;
begin
  t1 := public.book_conference('1c000000-0000-0000-0000-000000000001', s1, 'Should Not Keep',
          '[{"name": "Dana Reyes", "email": "Dana@Example.com"}]', null, null);
  assert (select child_name is null from public.conference_bookings where access_token = t1),
         'no child''s name is kept when the teacher doesn''t ask for it';
  begin
    perform public.book_conference('1c000000-0000-0000-0000-000000000001', s2, null, '[{"name": "Dana R", "email": "dana@example.com"}]', null, null);
  exception when sqlstate 'P0001' then ok := sqlerrm like '%already have a meeting%';
  end;
  assert ok, 'one meeting per first parent''s email';
  perform public.book_conference('1c000000-0000-0000-0000-000000000001', s2, null, '[{"name": "Lee Park", "email": "lee@example.com"}]', null, null);
  -- Asking again: the child's name is required.
  update public.events set ask_child_name = true where id = '1c000000-0000-0000-0000-000000000001';
  ok := false;
  begin
    perform public.book_conference('1c000000-0000-0000-0000-000000000001', s1 + interval '40 minutes', null, '[{"name": "Mo Li", "email": "mo@example.com"}]', null, null);
  exception when sqlstate 'P0001' then ok := sqlerrm like '%child%';
  end;
  assert ok, 'with the question on, the child''s name is required';
end $$;
delete from public.events where id = '1c000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Each event can switch the account's logo and color off (on by default)
-- ---------------------------------------------------------------------------
reset role;
insert into public.events (id, organization_id, name, slug, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_address)
values ('1b000000-0000-0000-0000-000000000001', :'org_id', 'Brand Switch', 'brand-switch', 'draft', 'volunteer', 'America/Chicago',
        current_date + 3, current_date + 3, now() + interval '3 days', now() + interval '3 days 2 hours', '1 Main St');
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"host@example.com"}';
update public.events set show_brand = false where id = '1b000000-0000-0000-0000-000000000001';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"stranger@example.com"}';
update public.events set show_brand = true where id = '1b000000-0000-0000-0000-000000000001';
reset role;
do $$
begin
  assert (select not show_brand from public.events where id = '1b000000-0000-0000-0000-000000000001'),
         'a host switches the logo off for one event, and a stranger can''t switch it back';
  assert (select show_brand from public.events where id = '10000000-0000-0000-0000-00000000000a'), 'events show it by default';
end $$;
delete from public.events where id = '1b000000-0000-0000-0000-000000000001';

\echo 'All database security tests passed.'
