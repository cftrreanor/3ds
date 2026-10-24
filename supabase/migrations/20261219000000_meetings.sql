-- =============================================================================
-- Meetings: a new kind of event that works like parent-teacher conferences
-- (meeting times, in person / video / phone, a day or weekly hours, emailed
-- invites, a link to change or cancel, reminders, the Meetings page), for
-- anyone booking time, without a child.
--
--   * events.event_type 'meeting'. It shares conference_settings and
--     conference_bookings with conferences.
--   * A meeting booking has no child: child_name is empty for meetings, and
--     still required for conferences (book_conference checks). The person
--     booking and up to three others are in `parents` (the first is the main
--     contact). One upcoming meeting per main contact's email.
--   * Publishing needs an active plan, like every kind but teacher
--     conferences (teacher accounts stay conferences-only).
--   * Pilot requests can ask for meetings.
-- =============================================================================

alter type public.event_type add value if not exists 'meeting';

-- A booking for a meeting has no child.
alter table public.conference_bookings alter column child_name drop not null;
alter table public.conference_bookings drop constraint if exists conference_bookings_child_name_check;
alter table public.conference_bookings add constraint conference_bookings_child_name_check
  check (child_name is null or char_length(trim(child_name)) between 2 and 120);

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

-- Booking: a conference names the child (one meeting per child); a meeting
-- has none (one meeting per main contact's email). With weekly hours, one
-- upcoming meeting.
create or replace function public.book_conference(p_event uuid, p_starts_at timestamptz, p_child text, p_parents jsonb, p_mode text,
                                                  p_note text, p_call_phone text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mode    text;
  token   uuid;
  p       jsonb;
  weekly  boolean;
  meeting boolean;
  who     text;
  phone   text := nullif(regexp_replace(coalesce(p_call_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  mode := public.conference_booking_check(p_event, p_starts_at, p_mode);
  meeting := (select event_type::text = 'meeting' from events where id = p_event);
  if not meeting and char_length(trim(coalesce(p_child, ''))) not between 2 and 120 then
    raise exception 'Please enter your child''s first and last name.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_parents) <> 'array' or jsonb_array_length(p_parents) not between 1 and 4 then
    raise exception '%', case when meeting then 'Add yourself and up to three others.' else 'Add one to four parents or guardians.' end
      using errcode = 'P0001';
  end if;
  for p in select * from jsonb_array_elements(p_parents) loop
    if char_length(trim(coalesce(p ->> 'name', ''))) not between 2 and 120
       or coalesce(p ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p ->> 'email') > 254 then
      raise exception '%', case when meeting then 'Please enter each person''s name and email address.'
                                else 'Please enter each parent''s name and email address.' end
        using errcode = 'P0001';
    end if;
  end loop;
  if mode = 'phone' and (phone is null or phone !~ '^\+?[0-9]{7,15}$') then
    raise exception 'Please enter the phone number to call.' using errcode = 'P0001';
  end if;
  weekly := exists (select 1 from conference_settings where event_id = p_event and schedule = 'weekly');
  if meeting then
    -- One meeting per main contact (with weekly hours, one upcoming meeting), even if two are booked at once.
    who := lower(trim(p_parents -> 0 ->> 'email'));
    perform pg_advisory_xact_lock(hashtext('meeting-contact:' || p_event::text), hashtext(who));
    if exists (select 1 from conference_bookings
                where event_id = p_event and lower(parents -> 0 ->> 'email') = who
                  and (not weekly or starts_at > now())) then
      raise exception 'You already have a meeting booked. Use the link in your confirmation email to change it.'
        using errcode = 'P0001';
    end if;
  else
    -- One meeting per child (with weekly hours, one upcoming meeting), even if two are booked at once.
    perform pg_advisory_xact_lock(hashtext('conference-child:' || p_event::text), hashtext(lower(trim(p_child))));
    if exists (select 1 from conference_bookings
                where event_id = p_event and lower(trim(child_name)) = lower(trim(p_child))
                  and (not weekly or starts_at > now())) then
      raise exception '% already has a meeting booked. Use the link in your confirmation email to change it.', trim(p_child)
        using errcode = 'P0001';
    end if;
  end if;
  begin
    insert into conference_bookings (event_id, starts_at, child_name, parents, meeting_mode, note, call_phone)
    values (p_event, p_starts_at, case when meeting then null else trim(p_child) end,
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
