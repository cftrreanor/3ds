-- =============================================================================
-- Demo sample data: when a Field Command Events admin turns on demo mode for
-- an event, the event fills up with sample people for its type, so every
-- page has something to show:
--
--   * every event: three stations with two shifts each, a dozen volunteers
--     on them (including two under-18 helpers signed up by a parent);
--   * band contests: six bands; group events: five groups and three rooms;
--   * school visitor events: eight parent registrations;
--   * school fairs: eight booths across four zones, two partners arrived.
--
-- Sample people are never emailed (their addresses are on the demo domain)
-- and demo_samples records each row, so demo_leave() takes them all back off.
-- Server-only, like the rest of demo mode.
-- =============================================================================

create table public.demo_samples (
  owner_id  uuid not null references public.profiles (id) on delete cascade,
  event_id  uuid not null references public.events (id) on delete cascade,
  kind      text not null check (kind in ('station', 'volunteer', 'band', 'room', 'parent', 'booth')),
  row_id    uuid not null,
  primary key (kind, row_id)
);
create index on public.demo_samples (owner_id, event_id);
alter table public.demo_samples enable row level security;
revoke all on public.demo_samples from anon, authenticated;

-- Fills an event with sample data for its type (once; later calls do nothing).
-- p_director: the admin's demo director, who "registered" the sample bands.
create function public.demo_seed(p_owner uuid, p_event uuid, p_director uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev        public.events;
  kind      text;
  base      timestamptz;
  st_names  text[];
  zones     text[] := array[null, null, null];
  st_id     uuid;
  sh_ids    uuid[] := '{}';
  sh_id     uuid;
  vol_id    uuid;
  guardian  uuid;
  i         int;
  people    text[] := array['Maria Lopez', 'James Carter', 'Priya Patel', 'Tom Nguyen', 'Angela Brooks', 'David Kim',
                            'Rachel Green', 'Marcus Johnson', 'Linda Alvarez', 'Chris Walker', 'Sofia Rossi', 'Ben Taylor'];
  schools   text[] := array['Cedar Ridge High School', 'Lakeview High School', 'Summit High School',
                            'Riverside High School', 'Oak Hollow High School', 'Westfield High School'];
  groups    text[] := array['Cedar Ridge Varsity Choir', 'Lakeview Chamber Singers', 'Summit Treble Choir',
                            'Riverside Orchestra', 'Oak Hollow Jazz Choir'];
  bandnames text[] := array['Cedar Ridge Marching Band', 'Lakeview Regiment', 'Summit Spirit of Gold',
                            'Riverside Pride', 'Oak Hollow Thunder', 'Westfield Blue Brigade'];
  slug      text;
  new_id    uuid;
begin
  if not exists (select 1 from demo_events where owner_id = p_owner and event_id = p_event) then
    raise exception 'Demo mode is not on for this event' using errcode = 'P0001';
  end if;
  if exists (select 1 from demo_samples where owner_id = p_owner and event_id = p_event) then
    return;
  end if;
  select * into ev from events where id = p_event;
  kind := ev.event_type::text;
  base := ev.window_start;

  -- Stations and shifts.
  st_names := case kind
    when 'fair' then array['Ticket Booth', 'Face Painting', 'Bake Sale']
    when 'band_contest' then array['Parking', 'Concessions', 'Hospitality']
    when 'group_event' then array['Welcome Table', 'Room Monitors', 'Concessions']
    when 'school_visit' then array['Front Door Check-in', 'Hallway Guides', 'Cafeteria Helpers']
    else array['Parking', 'Concessions', 'Setup & Cleanup'] end;
  if kind = 'fair' then
    zones := array['Game Zone', 'Activity Stations', 'Marketplace'];
  end if;
  for i in 1..3 loop
    insert into stations (event_id, name, location, instructions, sort_order, zone)
    values (p_event, st_names[i], 'Sample location ' || i, 'Sample instructions: check in at the volunteer desk first.',
            100 + i, zones[i])
    returning id into st_id;
    insert into demo_samples values (p_owner, p_event, 'station', st_id);
    insert into shifts (station_id, event_id, title, starts_at, ends_at, max_capacity)
    values (st_id, p_event, 'Morning', base, base + interval '2 hours', 4)
    returning id into sh_id;
    sh_ids := sh_ids || sh_id;
    insert into shifts (station_id, event_id, title, starts_at, ends_at, max_capacity)
    values (st_id, p_event, 'Afternoon', base + interval '2 hours', base + interval '4 hours', 4)
    returning id into sh_id;
    sh_ids := sh_ids || sh_id;
  end loop;

  -- Volunteers: one per shift slot, round-robin, plus two students with a parent.
  for i in 1..array_length(people, 1) loop
    insert into volunteers (event_id, full_name, email, phone)
    values (p_event, people[i],
            'sample-' || replace(lower(people[i]), ' ', '.') || '@demo.fieldcommandevents.com',
            '+1512555' || lpad((100 + i)::text, 4, '0'))
    returning id into vol_id;
    insert into demo_samples values (p_owner, p_event, 'volunteer', vol_id);
    sh_id := sh_ids[1 + (i - 1) % array_length(sh_ids, 1)];
    insert into volunteer_assignments (shift_id, volunteer_id) values (sh_id, vol_id);
    update shifts set registered_count = registered_count + 1 where id = sh_id;
    if i = 1 then guardian := vol_id; end if;
  end loop;
  foreach slug in array array['Emma L.', 'Noah L.'] loop
    insert into volunteers (event_id, full_name, email, phone, minor, contact_id)
    values (p_event, slug, null, '+15125550101', true, guardian)
    returning id into vol_id;
    insert into demo_samples values (p_owner, p_event, 'volunteer', vol_id);
    insert into volunteer_assignments (shift_id, volunteer_id) values (sh_ids[1], vol_id);
    update shifts set registered_count = registered_count + 1,
                      max_capacity = greatest(max_capacity, registered_count + 1)
     where id = sh_ids[1];
  end loop;

  -- Bands (band contests) or groups (group events).
  if kind in ('band_contest', 'group_event') and p_director is not null and cardinality(ev.classifications) > 0 then
    for i in 1..(case when kind = 'band_contest' then 6 else 5 end) loop
      insert into bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                         contact_email, head_director_name, head_director_email, head_director_phone,
                         student_count, chaperone_count, bus_count, box_truck_count)
      values (p_event, p_director, schools[i],
              case when kind = 'band_contest' then bandnames[i] else groups[i] end,
              ev.classifications[1 + (i - 1) % cardinality(ev.classifications)],
              (100 * i) || ' School Way',
              'sample-director' || i || '@demo.fieldcommandevents.com', people[i],
              'sample-director' || i || '@demo.fieldcommandevents.com', '+1512555' || lpad((200 + i)::text, 4, '0'),
              30 + 15 * i, least(2 + i % 3, ev.chaperone_limit),
              case when kind = 'band_contest' then 2 else 1 end, case when kind = 'band_contest' then 1 else 0 end)
      returning id into new_id;
      insert into demo_samples values (p_owner, p_event, 'band', new_id);
    end loop;
  end if;

  -- Rooms (group events without any yet).
  if kind = 'group_event' and not exists (select 1 from rooms where event_id = p_event) then
    for i in 1..3 loop
      insert into rooms (event_id, name, note, path_order, minutes)
      values (p_event, (array['Performance Hall', 'Clinic Room', 'Sight-Reading'])[i],
              (array['Main stage', 'Room 112', 'Library'])[i], i, (array[20, 20, 15])[i])
      returning id into new_id;
      insert into demo_samples values (p_owner, p_event, 'room', new_id);
    end loop;
  end if;

  -- Parent registrations (school visitor events).
  if kind = 'school_visit' then
    for i in 1..8 loop
      insert into parent_registrations (event_id, parent_name, email, phone, children, other_adults)
      values (p_event, people[i],
              'sample-parent' || i || '@demo.fieldcommandevents.com',
              '+1512555' || lpad((300 + i)::text, 4, '0'),
              jsonb_build_array(jsonb_build_object(
                'name', split_part(people[i + 4 - 4 * ((i + 3) / 12)], ' ', 1) || ' ' || split_part(people[i], ' ', 2),
                'teacher', (array['Smith', 'Garcia', 'Lee', 'Brown'])[1 + i % 4],
                'grade', (array['K', '1st', '2nd', '3rd', '4th', '5th'])[1 + i % 6])),
              case when i % 3 = 0
                   then jsonb_build_array(jsonb_build_object('name', 'Grandparent of ' || people[i],
                                                             'checked_in_at', null, 'checked_in_by', null))
                   else '[]'::jsonb end)
      returning id into new_id;
      insert into demo_samples values (p_owner, p_event, 'parent', new_id);
    end loop;
  end if;

  -- Booths (school fairs).
  if kind = 'fair' then
    for i in 1..8 loop
      insert into fair_booths (event_id, title, host_name, zone, location, description,
                               contact_name, contact_email, contact_phone, show_publicly, arrived_at)
      values (p_event,
              (array['Dunk Tank', 'Ring Toss', 'Face Painting', 'Hair Tinsel', 'Bake Sale', '3D-Printed Treasures',
                     'Student Art Show', 'Robotics Demo'])[i],
              (array['Verizon', 'Rotary Club', 'City Church youth', 'Varsity Cheer', 'PTO', 'Maker Mom Co.',
                     null, 'Robotics Club'])[i],
              (array['Game Zone', 'Game Zone', 'Activity Stations', 'Activity Stations', 'Marketplace', 'Marketplace',
                     'Showcase', 'Showcase'])[i],
              'Sample spot ' || i,
              (array[null, null, null, null, 'Cookies, brownies and cupcakes', 'Keychains, fidgets and toys',
                     'Artwork from every grade', 'Watch the robots compete'])[i],
              people[i], 'sample-partner' || i || '@demo.fieldcommandevents.com',
              '+1512555' || lpad((400 + i)::text, 4, '0'), true,
              case when i <= 2 then now() end)
      returning id into new_id;
      insert into demo_samples values (p_owner, p_event, 'booth', new_id);
    end loop;
  end if;
end;
$$;

-- demo_leave now also takes the sample data back off.
create or replace function public.demo_leave(p_owner uuid, p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  org uuid;
begin
  select organization_id into org from events where id = p_event;

  -- Sample data (stations take their shifts and sign-ups with them).
  delete from volunteers where id in (select row_id from demo_samples where owner_id = p_owner and event_id = p_event and kind = 'volunteer');
  delete from stations where id in (select row_id from demo_samples where owner_id = p_owner and event_id = p_event and kind = 'station');
  delete from bands where id in (select row_id from demo_samples where owner_id = p_owner and event_id = p_event and kind = 'band');
  delete from rooms where id in (select row_id from demo_samples where owner_id = p_owner and event_id = p_event and kind = 'room');
  delete from parent_registrations where id in (select row_id from demo_samples where owner_id = p_owner and event_id = p_event and kind = 'parent');
  delete from fair_booths where id in (select row_id from demo_samples where owner_id = p_owner and event_id = p_event and kind = 'booth');
  delete from demo_samples where owner_id = p_owner and event_id = p_event;

  -- Free the demo volunteer's shift spots.
  update shifts s set registered_count = greatest(0, s.registered_count - n.cnt)
    from (
      select va.shift_id, count(*) as cnt
        from volunteer_assignments va
        join volunteers v on v.id = va.volunteer_id
        join profiles p on p.email = v.email
        join demo_accounts d on d.user_id = p.id and d.owner_id = p_owner
       where v.event_id = p_event
       group by va.shift_id
    ) n
   where s.id = n.shift_id;
  delete from volunteers v using profiles p, demo_accounts d
   where v.event_id = p_event and p.email = v.email and d.user_id = p.id and d.owner_id = p_owner;

  delete from bands b using demo_accounts d
   where b.event_id = p_event and b.director_user_id = d.user_id and d.owner_id = p_owner;
  delete from station_leads l using demo_accounts d
   where l.event_id = p_event and l.user_id = d.user_id and d.owner_id = p_owner;
  delete from event_staff s using demo_accounts d
   where s.event_id = p_event and s.user_id = d.user_id and d.owner_id = p_owner;
  -- The demo host leaves the organization unless it's demoing another of its events.
  delete from organization_members m using demo_accounts d
   where m.organization_id = org and m.user_id = d.user_id and d.owner_id = p_owner
     and not exists (
       select 1 from demo_events de join events e on e.id = de.event_id
        where de.owner_id = p_owner and de.event_id <> p_event and e.organization_id = org
     );

  -- Demo people don't linger on the Team page's "Removed" tab.
  delete from team_removals t using demo_accounts d
   where t.organization_id = org and t.user_id = d.user_id and d.owner_id = p_owner;

  delete from demo_events where owner_id = p_owner and event_id = p_event;
end;
$$;

revoke execute on function public.demo_seed(uuid, uuid, uuid), public.demo_leave(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.demo_seed(uuid, uuid, uuid), public.demo_leave(uuid, uuid) to service_role;
