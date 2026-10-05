-- =============================================================================
-- Add test data to one event: 12 bands and 40 volunteers signed up for shifts.
--
-- HOW TO USE (Supabase -> SQL Editor -> + New query):
--   1. Paste this whole file.
--   2. On the line below, replace my-test-event with your event's link name
--      (the part after /e/ in its public link).
--   3. Click Run. The last result shows what was added.
--
-- Every fake email is a Resend test address (delivered+...@resend.dev). Emails
-- the app sends to them show up as "Delivered" in Resend, but nobody receives
-- them, and they don't hurt the domain's sending reputation.
-- The fake bands are listed under your own account, so you can also open them
-- as their director would.
-- Undo everything with remove-test-data.sql.
-- =============================================================================
select set_config('test_data.event_slug', 'my-test-event', false);

do $$
declare
  ev        public.events;
  owner_id  uuid;
  st_id     uuid;
  sh        record;
  vol_ids   uuid[] := '{}';
  v_id      uuid;
  n         int := 0;
  target    int;
  i         int;
  first_names text[] := array['Avery','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Quinn','Drew','Reese',
                                'Parker','Rowan','Hayden','Emerson','Sawyer','Finley','Logan','Peyton','Cameron','Dakota'];
  last_names  text[] := array['Garcia','Nguyen','Johnson','Patel','Williams','Martinez','Brown','Kim','Davis','Lopez',
                                'Wilson','Anderson','Thomas','Moore','Jackson','Lee','Harris','Clark','Lewis','Young'];
  schools     text[] := array['Cedar Ridge HS','Lakeview HS','Pine Hollow HS','Westfield HS','Riverbend HS','Oak Creek HS',
                                'Summit HS','Brookside HS','Eastlake HS','Granite Falls HS','Meadowbrook HS','Highland Park HS'];
  band_names  text[] := array['Raider Regiment','Pride of Lakeview','Marching Pines','Westfield Brigade','River Sound',
                                'Oak Creek Cavaliers','Summit Sound Machine','Brookside Blue Brigade','Eastlake Thunder',
                                'Granite Guard','Meadowbrook Marching Mustangs','Highland Scots'];
begin
  select * into ev from public.events where slug = current_setting('test_data.event_slug');
  if ev.id is null then
    raise exception 'No event has the link name "%". Check step 2 at the top of this file.',
      current_setting('test_data.event_slug');
  end if;
  if exists (select 1 from public.volunteers where event_id = ev.id and email like '%@resend.dev')
     or exists (select 1 from public.bands where event_id = ev.id and contact_email like '%@resend.dev') then
    raise exception 'This event already has test data. Run remove-test-data.sql first if you want a fresh set.';
  end if;

  owner_id := coalesce(ev.created_by,
    (select user_id from public.organization_members where organization_id = ev.organization_id order by created_at limit 1));

  -- Stations and shifts, only if the event has none yet.
  if not exists (select 1 from public.shifts where event_id = ev.id) then
    foreach st_id in array array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()] loop
      n := n + 1;
      insert into public.stations (id, event_id, name, sort_order)
      values (st_id, ev.id, (array['Concessions (test)','Parking (test)','Gate & tickets (test)'])[n], 100 + n);
      for i in 0..2 loop
        insert into public.shifts (station_id, event_id, title, starts_at, ends_at, max_capacity)
        values (st_id, ev.id,
                (array['Morning','Midday','Evening'])[i + 1],
                (ev.starts_on + make_time(7 + i * 4, 0, 0)) at time zone ev.timezone,
                (ev.starts_on + make_time(11 + i * 4, 0, 0)) at time zone ev.timezone,
                (array[6, 8, 4])[n]);
      end loop;
    end loop;
  end if;

  -- 40 volunteers.
  for i in 1..40 loop
    insert into public.volunteers (event_id, full_name, email, phone)
    values (ev.id,
            first_names[1 + (i - 1) % 20] || ' ' || last_names[1 + (i * 7) % 20],
            format('delivered+vol%s@resend.dev', lpad(i::text, 2, '0')),
            format('+1512555%s', lpad((100 + i)::text, 4, '0')))
    returning id into v_id;
    vol_ids := vol_ids || v_id;
  end loop;

  -- Sign them up: the first shift is filled completely, the rest about 60%, so
  -- there's room left to test signing up yourself.
  n := 0;
  for sh in select s.* from public.shifts s join public.stations st on st.id = s.station_id
             where s.event_id = ev.id order by st.sort_order, s.starts_at loop
    target := case when n = 0 then sh.max_capacity else ceil(sh.max_capacity * 0.6)::int end;
    i := 0;
    while i < target - sh.registered_count loop
      insert into public.volunteer_assignments (shift_id, volunteer_id)
      values (sh.id, vol_ids[1 + ((n * 5 + i) % 40)])
      on conflict do nothing;
      if found then
        update public.shifts set registered_count = registered_count + 1 where id = sh.id;
      end if;
      i := i + 1;
    end loop;
    n := n + 1;
  end loop;

  -- 12 bands.
  for i in 1..12 loop
    insert into public.bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                              contact_email, head_director_name, head_director_email, head_director_phone,
                              assistant_directors, student_count, chaperone_count, bus_count, box_truck_count,
                              truck_trailer_count, semi_truck_count, contest_day_conflicts, special_needs)
    values (ev.id, owner_id, schools[i], band_names[i],
            ev.classifications[1 + (i - 1) % cardinality(ev.classifications)],
            format('%s School Rd, Austin, TX 787%s', 100 + i * 37, lpad(i::text, 2, '0')),
            format('delivered+band%s@resend.dev', lpad(i::text, 2, '0')),
            first_names[1 + (i * 3) % 20] || ' ' || last_names[1 + (i * 11) % 20],
            format('delivered+director%s@resend.dev', lpad(i::text, 2, '0')),
            format('+1512555%s', lpad((200 + i)::text, 4, '0')),
            case when i % 3 = 0 then array[first_names[1 + i % 20] || ' ' || last_names[1 + (i + 4) % 20]] else '{}' end,
            40 + (i * 23) % 180,
            least(ev.chaperone_limit, 5 + (i * 7) % 20),
            1 + i % 4, i % 2, (i + 1) % 2, case when i % 4 = 0 then 1 else 0 end,
            case i when 2 then 'ACT testing until 11:30 AM' when 5 then 'Football game the night before; arriving late morning'
                   when 9 then 'Must leave by 6 PM for homecoming' end,
            case i when 4 then 'Two students use wheelchairs; need a ramp to the stands' when 7 then 'Needs power for electronics in the pit' end);
  end loop;
end $$;

select
  (select count(*) from public.bands b join public.events e on e.id = b.event_id
    where e.slug = current_setting('test_data.event_slug') and b.contact_email like '%@resend.dev') as test_bands,
  (select count(*) from public.volunteers v join public.events e on e.id = v.event_id
    where e.slug = current_setting('test_data.event_slug') and v.email like '%@resend.dev') as test_volunteers,
  (select count(*) from public.volunteer_assignments a join public.volunteers v on v.id = a.volunteer_id
     join public.events e on e.id = v.event_id
    where e.slug = current_setting('test_data.event_slug') and v.email like '%@resend.dev') as test_signups;
