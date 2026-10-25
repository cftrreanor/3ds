-- =============================================================================
-- Meetings: a new kind of event that works like parent-teacher conferences
-- (meeting times, in person / video / phone, a day or weekly hours, emailed
-- invites, a link to change or cancel, reminders, the Meetings page), for
-- anyone booking time, without a child.
--
--   * events.event_type 'meeting'. It shares conference_settings and
--     conference_bookings with conferences.
--   * A meeting never asks for a child, whatever events.ask_child_name says
--     (20261219000000): child_name stays empty, the person booking and up to
--     three others are in `parents` (the first is the main contact), and
--     there's one upcoming meeting per main contact's email.
--   * Publishing needs an active plan, like every kind but teacher
--     conferences (teacher accounts stay conferences-only).
--   * Pilot requests can ask for meetings.
-- =============================================================================

alter type public.event_type add value if not exists 'meeting';

-- Meeting times are for conferences and meetings.
create or replace function public.conference_settings_need_conference()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type::text from events where id = new.event_id) not in ('conference', 'meeting') then
    raise exception 'Meeting times are for conferences and meetings.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Conferences and meetings keep their kind (their bookings and settings depend on it).
create or replace function public.conference_type_is_fixed()
returns trigger
language plpgsql
as $$
begin
  if old.event_type::text is distinct from new.event_type::text
     and (old.event_type::text in ('conference', 'meeting') or new.event_type::text in ('conference', 'meeting')) then
    raise exception 'Conferences and meetings can''t change to another kind of event, or the other way round. Create a new event instead.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.conferences_are_one_day()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.event_type::text in ('conference', 'meeting') and new.ends_on <> new.starts_on
     and not exists (select 1 from conference_settings where event_id = new.id and schedule = 'weekly') then
    raise exception 'A day of meetings is one day. Pick the same start and end date.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.conference_open_times(p_slug text)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select t
    from events e, public.conference_slot_starts(e.id) t
   where e.slug = p_slug and e.event_type::text in ('conference', 'meeting') and e.status = 'published'
     and t > public.conference_earliest(e.id)
     and not exists (select 1 from conference_bookings b where b.event_id = e.id and b.starts_at = t)
   order by t;
$$;

create or replace function public.conference_booking_check(p_event uuid, p_starts_at timestamptz, p_mode text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  e     events;
  s     conference_settings;
  modes text[];
begin
  select * into e from events where id = p_event;
  if e.id is null or e.event_type::text not in ('conference', 'meeting') or e.status <> 'published' then
    raise exception 'Booking is closed.' using errcode = 'P0001';
  end if;
  select * into s from conference_settings where event_id = p_event;
  if p_starts_at <= public.conference_earliest(p_event)
     or not exists (select 1 from public.conference_slot_starts(p_event) t where t = p_starts_at) then
    raise exception 'That time isn''t available. Please pick another.' using errcode = 'P0001';
  end if;
  modes := coalesce(s.meeting_modes, public.meeting_modes_from(s.meeting_mode));
  if cardinality(modes) > 1 then
    if p_mode is null or not (p_mode = any (modes)) then
      raise exception 'Choose how you''d like to meet.' using errcode = 'P0001';
    end if;
    return p_mode;
  end if;
  return modes[1];
end;
$$;

-- Booking: as 20261219000000, and a meeting never takes a child's name (one
-- upcoming meeting per main contact's email).
create or replace function public.book_conference(p_event uuid, p_starts_at timestamptz, p_child text, p_parents jsonb, p_mode text,
                                                  p_note text, p_call_phone text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mode   text;
  token  uuid;
  p      jsonb;
  weekly boolean;
  ask    boolean;
  who    text;
  phone  text := nullif(regexp_replace(coalesce(p_call_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  mode := public.conference_booking_check(p_event, p_starts_at, p_mode);
  -- Meetings never ask for a child; conferences do unless the teacher turned it off.
  ask := coalesce((select ask_child_name and event_type::text <> 'meeting' from events where id = p_event), true);
  if ask and char_length(trim(coalesce(p_child, ''))) not between 2 and 120 then
    raise exception 'Please enter your child''s first and last name.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_parents) <> 'array' or jsonb_array_length(p_parents) not between 1 and 4 then
    raise exception '%', case when ask then 'Add one to four parents or guardians.' else 'Add yourself and up to three others.' end
      using errcode = 'P0001';
  end if;
  for p in select * from jsonb_array_elements(p_parents) loop
    if char_length(trim(coalesce(p ->> 'name', ''))) not between 2 and 120
       or coalesce(p ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p ->> 'email') > 254 then
      raise exception '%', case when ask then 'Please enter each parent''s name and email address.'
                                else 'Please enter each person''s name and email address.' end
        using errcode = 'P0001';
    end if;
  end loop;
  if mode = 'phone' and (phone is null or phone !~ '^\+?[0-9]{7,15}$') then
    raise exception 'Please enter the phone number to call.' using errcode = 'P0001';
  end if;
  weekly := exists (select 1 from conference_settings where event_id = p_event and schedule = 'weekly');
  if ask then
    -- One meeting per child (with weekly hours, one upcoming meeting), even if two are booked at once.
    perform pg_advisory_xact_lock(hashtext('conference-child:' || p_event::text), hashtext(lower(trim(p_child))));
    if exists (select 1 from conference_bookings
                where event_id = p_event and lower(trim(child_name)) = lower(trim(p_child))
                  and (not weekly or starts_at > now())) then
      raise exception '% already has a meeting booked. Use the link in your confirmation email to change it.', trim(p_child)
        using errcode = 'P0001';
    end if;
  else
    -- No child's name (always, for meetings): one meeting per first contact's email instead.
    who := lower(trim(p_parents -> 0 ->> 'email'));
    perform pg_advisory_xact_lock(hashtext('conference-contact:' || p_event::text), hashtext(who));
    if exists (select 1 from conference_bookings
                where event_id = p_event and lower(parents -> 0 ->> 'email') = who
                  and (not weekly or starts_at > now())) then
      raise exception 'You already have a meeting booked. Use the link in your confirmation email to change it.'
        using errcode = 'P0001';
    end if;
  end if;
  begin
    insert into conference_bookings (event_id, starts_at, child_name, parents, meeting_mode, note, call_phone)
    values (p_event, p_starts_at, case when ask then trim(p_child) end,
            (select jsonb_agg(jsonb_build_object('name', trim(x ->> 'name'), 'email', lower(trim(x ->> 'email')),
                                                 'phone', nullif(trim(coalesce(x ->> 'phone', '')), '')))
               from jsonb_array_elements(p_parents) x),
            mode, nullif(left(trim(coalesce(p_note, '')), 500), ''),
            case when mode = 'phone' then phone end)
    returning access_token into token;
  exception when unique_violation then
    raise exception 'That time was just taken. Please pick another.' using errcode = 'P0001';
  end;
  return token;
end;
$$;
revoke execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text, text) to service_role;

create or replace function public.change_conference_booking(p_token uuid, p_starts_at timestamptz, p_mode text, p_call_phone text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  b     conference_bookings;
  mode  text;
  phone text := nullif(regexp_replace(coalesce(p_call_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  select * into b from conference_bookings where access_token = p_token for update;
  if not found then
    raise exception 'This link isn''t valid. Your meeting may have been canceled.' using errcode = 'P0001';
  end if;
  if b.starts_at <= now() then
    raise exception 'This meeting has already started, so it can''t be changed.' using errcode = 'P0001';
  end if;
  mode := public.conference_booking_check(b.event_id, p_starts_at, p_mode);
  phone := coalesce(phone, b.call_phone);
  if mode = 'phone' and (phone is null or phone !~ '^\+?[0-9]{7,15}$') then
    raise exception 'Please enter the phone number to call.' using errcode = 'P0001';
  end if;
  begin
    update conference_bookings
       set starts_at = p_starts_at, meeting_mode = mode,
           call_phone = case when mode = 'phone' then phone end,
           calendar_sequence = calendar_sequence + 1, reminded_at = null
     where id = b.id;
  exception when unique_violation then
    raise exception 'That time was just taken. Please pick another.' using errcode = 'P0001';
  end;
  return b.event_id;
end;
$$;

-- A day of meetings follows its day, like a conference day.
create or replace function public.move_conference_bookings(ev uuid, from_tz text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  e     events;
  moved integer;
begin
  select * into e from events where id = ev;
  if e.id is null or e.event_type::text not in ('conference', 'meeting')
     or exists (select 1 from conference_settings where event_id = ev and schedule = 'weekly') then
    return 0;
  end if;
  with target as (
    select b.id, (e.starts_on + (b.starts_at at time zone from_tz)::time) at time zone e.timezone as new_start
      from conference_bookings b
     where b.event_id = ev
  )
  update conference_bookings b
     set starts_at = t.new_start,
         calendar_sequence = b.calendar_sequence + 1,
         reminded_at = null
    from target t
   where t.id = b.id
     and t.new_start <> b.starts_at
     and not exists (select 1 from conference_bookings o where o.event_id = ev and o.starts_at = t.new_start);
  get diagnostics moved = row_count;
  return moved;
end;
$$;

drop trigger if exists conference_bookings_follow_day on public.events;
create trigger conference_bookings_follow_day
  after update of starts_on, timezone on public.events
  for each row
  when (new.event_type::text in ('conference', 'meeting')
        and (old.starts_on is distinct from new.starts_on or old.timezone is distinct from new.timezone))
  execute function public.conference_bookings_follow_day();

create or replace function public.conference_not_ready(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when not public.is_event_admin(ev) then 'Only the event''s hosts can publish it.'
    when s.event_id is null or s.times_saved_at is null then 'Save your meeting times first (step 1).'
    when s.schedule = 'weekly' and jsonb_array_length(s.weekly_hours) = 0 then 'Add your weekly hours first (step 1).'
    when s.meeting_modes is null then 'Choose where you''ll meet first (step 2).'
    when 'in_person' = any (s.meeting_modes) and coalesce(trim(e.venue_address), '') = ''
      then case when e.event_type::text = 'meeting' then 'Add the address first (step 2).' else 'Add your school''s address first (step 2).' end
    when 'in_person' = any (s.meeting_modes) and coalesce(trim(s.room), '') = '' then 'Add your room and directions first (step 2).'
    when 'video' = any (s.meeting_modes) and not s.own_link and s.video_link is null then 'Add your meeting link first (step 2).'
    when 'video' = any (s.meeting_modes) and not s.own_link and not s.waiting_room_confirmed
      then 'Tick that your meeting has a waiting room and runs the whole time (step 2).'
  end
  from events e
  left join conference_settings s on s.event_id = e.id
  where e.id = ev;
$$;

-- Publishing a meeting: its setup must be done, and it needs an active plan.
create or replace function public.events_publish_needs_plan()
returns trigger
language plpgsql
as $$
declare
  missing_step text;
  other text;
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'published' and old.status is distinct from 'published' then
    if new.event_type::text = 'conference' then
      missing_step := public.conference_not_ready(new.id);
      if missing_step is not null then
        raise exception '%', missing_step using errcode = 'P0001';
      end if;
      if public.org_has_active_plan(new.organization_id) then
        return new;
      end if;
      if exists (select 1 from public.conference_settings where event_id = new.id and schedule = 'weekly') then
        raise exception 'Weekly hours are a premium feature. Write to us to add them to your account.' using errcode = '42501';
      end if;
      -- One at a time, even if two are published at once.
      perform pg_advisory_xact_lock(hashtext('conference-publish:' || new.organization_id::text));
      other := public.other_published_conference(new.id);
      if other is not null then
        raise exception 'You already have a published conference: %. Unpublish it first, then publish this one.', other
          using errcode = 'P0001';
      end if;
    elsif new.event_type::text = 'meeting' then
      missing_step := public.conference_not_ready(new.id);
      if missing_step is not null then
        raise exception '%', missing_step using errcode = 'P0001';
      end if;
      if not public.org_has_active_plan(new.organization_id) then
        raise exception 'Publishing needs an active Field Command Events plan' using errcode = '42501';
      end if;
    elsif not public.org_has_active_plan(new.organization_id) then
      raise exception 'Publishing needs an active Field Command Events plan' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- The pilot form can ask for meetings.
alter table public.pilot_requests drop constraint if exists pilot_requests_event_types_check;
alter table public.pilot_requests add constraint pilot_requests_event_types_check
  check (event_types <@ array['band_contest', 'group_event', 'fair', 'volunteer', 'school_visit', 'conference', 'meeting', 'other']::text[]
         and cardinality(event_types) <= 8);

-- Demo mode: meetings get sample bookings like a conference, with no child.
create or replace function public.demo_seed_conference(p_owner uuid, p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  slots    timestamptz[];
  i        int;
  n        int := 0;
  s        conference_settings;
  mode     text;
  new_id   uuid;
  -- Meetings: sample people with no child, and adult notes.
  meeting  boolean := (select event_type::text = 'meeting' from events where id = p_event);
  children text[] := array['Ava Lopez', 'Liam Carter', 'Mia Patel', 'Noah Nguyen', 'Zoe Brooks', 'Ethan Kim',
                           'Chloe Green', 'Lucas Johnson'];
  parents  text[] := array['Maria Lopez', 'James Carter', 'Priya Patel', 'Tom Nguyen', 'Angela Brooks', 'David Kim',
                           'Rachel Green', 'Marcus Johnson'];
  partners text[] := array['Jo Lopez', null, 'Raj Patel', null, null, 'Grace Kim', null, 'Tasha Johnson'];
  notes    text[] := array['Reading progress', null, 'How is she doing with friends?', null, 'Math homework',
                           null, null, 'Moving up to the advanced group'];
begin
  if meeting then
    notes := array['Quarterly check-in', null, 'Planning the spring schedule', null, 'A few budget questions', null, null, 'Next steps'];
  end if;
  -- Meeting times to book into (sample ones if the teacher hasn't set any).
  select * into s from conference_settings where event_id = p_event;
  if s.event_id is null then
    insert into conference_settings (event_id, meeting_minutes, gap_minutes, times_saved_at, meeting_mode, room, own_link)
    values (p_event, 15, 0, now(), 'either', case when meeting then 'Suite 200, second floor' else 'Room 214, purple hallway' end, true)
    returning * into s;
    insert into demo_samples values (p_owner, p_event, 'conference', p_event);
  elsif s.times_saved_at is null then
    update conference_settings set times_saved_at = now() where event_id = p_event returning * into s;
  end if;

  select array_agg(t order by t) into slots from public.conference_slot_starts(p_event) t;
  if slots is null then
    return;
  end if;

  -- About two of every three times, up to eight families.
  for i in 1..array_length(slots, 1) loop
    exit when n >= 8;
    continue when i % 3 = 0;
    continue when exists (select 1 from conference_bookings where event_id = p_event and starts_at = slots[i]);
    n := n + 1;
    mode := case coalesce(s.meeting_mode, 'either')
              when 'either' then (array['in_person', 'video'])[1 + n % 2]
              else s.meeting_mode end;
    new_id := null;
    insert into conference_bookings (event_id, starts_at, child_name, parents, meeting_mode, note)
    values (p_event, slots[i], case when meeting then null else children[n] end,
            jsonb_build_array(jsonb_build_object('name', parents[n],
                                                 'email', case when meeting then 'sample-person' else 'sample-family' end || n || '@demo.fieldcommandevents.com',
                                                 'phone', '+1512555' || lpad((500 + n)::text, 4, '0')))
              || case when partners[n] is null then '[]'::jsonb
                      else jsonb_build_array(jsonb_build_object('name', partners[n],
                                                                'email', case when meeting then 'sample-person' else 'sample-family' end || n || 'b@demo.fieldcommandevents.com',
                                                                'phone', null)) end,
            mode, notes[n])
    on conflict do nothing
    returning id into new_id;
    if new_id is not null then
      insert into demo_samples values (p_owner, p_event, 'booking', new_id);
    end if;
  end loop;
end;
$$;

create or replace function public.demo_seed(p_owner uuid, p_event uuid, p_director uuid)
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

  -- A teacher's conference (or someone's meetings) has no volunteers: it gets sample bookings instead.
  if kind in ('conference', 'meeting') then
    perform public.demo_seed_conference(p_owner, p_event);
    return;
  end if;

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
