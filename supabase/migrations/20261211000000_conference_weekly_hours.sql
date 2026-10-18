-- =============================================================================
-- Parent-teacher conferences: weekly hours and phone calls.
--
--   * schedule: 'one_day' (as before: one day's block of time) or 'weekly':
--     the same times every week (for example, Tuesdays and Thursdays 3:30 to
--     4:30) between the event's first and last day, skipping closed dates.
--     For weekly hours, families book at least min_notice_hours ahead and up
--     to max_days_ahead days ahead.
--   * Weekly hours are a premium feature: publishing them needs an active
--     plan. A free account still publishes one conference day at a time;
--     accounts with a plan aren't limited to one.
--   * Phone calls: the teacher calls the family at the number the family
--     gives (call_phone). The teacher's own number is never asked for.
--   * One upcoming meeting per child: with weekly hours a family can book
--     again once their meeting is past. A conference day stays one per child.
--   * Children's details from weekly hours are deleted 30 days after each
--     meeting (a conference day: 30 days after the day, as before).
--   * Weekly hours don't move when the event's dates change (only a
--     conference day's meetings follow its day).
-- =============================================================================

-- 1. Settings ---------------------------------------------------------------------
create function public.hhmm_minutes(t text)
returns integer
language sql immutable
as $$
  select case when t ~ '^([01]\d|2[0-3]):[0-5]\d$' then split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int end;
$$;

-- [{ "day": 2, "start": "15:30", "end": "16:30" }, …]: up to 21 ranges. Days are
-- 0 (Sunday) to 6 (Saturday), as Postgres extract(dow) gives them.
create function public.weekly_hours_ok(h jsonb)
returns boolean
language sql immutable
as $$
  select jsonb_typeof(h) = 'array' and jsonb_array_length(h) <= 21 and not exists (
    select 1 from jsonb_array_elements(h) x
     where jsonb_typeof(x) <> 'object'
        or coalesce(x ->> 'day', '') !~ '^[0-6]$'
        or public.hhmm_minutes(x ->> 'start') is null
        or public.hhmm_minutes(x ->> 'end') is null
        or public.hhmm_minutes(x ->> 'end') <= public.hhmm_minutes(x ->> 'start')
  );
$$;

-- ["2026-11-26", …]: up to 60 days off.
create function public.date_list_ok(d jsonb)
returns boolean
language sql immutable
as $$
  select jsonb_typeof(d) = 'array' and jsonb_array_length(d) <= 60 and not exists (
    select 1 from jsonb_array_elements(d) x
     where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$'
  );
$$;

alter table public.conference_settings
  add column schedule         text not null default 'one_day' check (schedule in ('one_day', 'weekly')),
  add column weekly_hours     jsonb not null default '[]'::jsonb check (public.weekly_hours_ok(weekly_hours)),
  add column closed_dates     jsonb not null default '[]'::jsonb check (public.date_list_ok(closed_dates)),
  add column min_notice_hours integer not null default 24 check (min_notice_hours between 0 and 336),
  add column max_days_ahead   integer not null default 14 check (max_days_ahead between 1 and 120);
grant insert (schedule, weekly_hours, closed_dates, min_notice_hours, max_days_ahead),
      update (schedule, weekly_hours, closed_dates, min_notice_hours, max_days_ahead)
  on public.conference_settings to authenticated;

alter table public.conference_settings drop constraint conference_settings_meeting_mode_check;
alter table public.conference_settings add constraint conference_settings_meeting_mode_check
  check (meeting_mode in ('in_person', 'video', 'either', 'phone'));

-- 2. Bookings ---------------------------------------------------------------------
alter table public.conference_bookings drop constraint conference_bookings_meeting_mode_check;
alter table public.conference_bookings add constraint conference_bookings_meeting_mode_check
  check (meeting_mode in ('in_person', 'video', 'phone'));
-- The number the teacher calls, for phone calls: "+15125550101".
alter table public.conference_bookings
  add column call_phone text check (call_phone is null or call_phone ~ '^\+?[0-9]{7,15}$');
grant select (call_phone) on public.conference_bookings to authenticated;

-- One per child is now checked when booking (one upcoming meeting for weekly hours).
drop index public.conference_bookings_one_per_child;
create index on public.conference_bookings (event_id, lower(trim(child_name)));

-- 3. Days -------------------------------------------------------------------------
-- A conference day is one day; weekly hours run between the first and last day.
create or replace function public.conferences_are_one_day()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.event_type::text = 'conference' and new.ends_on <> new.starts_on
     and not exists (select 1 from conference_settings where event_id = new.id and schedule = 'weekly') then
    raise exception 'Conferences are one day. Pick the same start and end date.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.conferences_are_one_day() from public, anon, authenticated;

-- Switching back to a conference day needs the event to be one day first.
create function public.conference_schedule_fits_days()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.schedule = 'one_day'
     and exists (select 1 from events where id = new.event_id and ends_on <> starts_on) then
    raise exception 'Pick one day for your conference first.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.conference_schedule_fits_days() from public, anon, authenticated;
create trigger conference_schedule_fits_days
  before insert or update of schedule on public.conference_settings
  for each row execute function public.conference_schedule_fits_days();

-- Only a conference day's meetings follow its day (20261210000000).
create or replace function public.move_conference_bookings(ev uuid, from_tz text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  e     events;
  moved integer;
begin
  select * into e from events where id = ev;
  if e.id is null or e.event_type::text <> 'conference'
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
revoke execute on function public.move_conference_bookings(uuid, text) from public, anon, authenticated;

-- 4. Meeting times ----------------------------------------------------------------
-- Every meeting time, in order. A conference day: back to back (plus the gap)
-- through its hours, skipping any that would run into a break. Weekly hours:
-- the same, for each week's ranges, from today through the last day or as
-- far ahead as families can book, skipping closed dates. Matches
-- meetingStarts() in lib/conferences.ts for one day.
create or replace function public.conference_slot_starts(ev uuid)
returns setof timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  e      events;
  s      conference_settings;
  len    integer;
  d      date;
  last_d date;
  r      record;
  t      integer;
  b      record;
  clash  integer;
  n      integer := 0;
begin
  select * into e from events where id = ev;
  select * into s from conference_settings where event_id = ev;
  if e.id is null or s.event_id is null or s.times_saved_at is null then
    return;
  end if;
  len := s.meeting_minutes;
  if s.schedule = 'weekly' then
    d := greatest(e.starts_on, (now() at time zone e.timezone)::date);
    last_d := least(e.ends_on, (now() at time zone e.timezone)::date + s.max_days_ahead);
  else
    d := e.starts_on;
    last_d := e.starts_on;
  end if;
  while d <= last_d loop
    for r in
      select distinct o, c from (
        -- A conference day: its hours.
        select extract(hour from (e.window_start at time zone e.timezone))::int * 60
             + extract(minute from (e.window_start at time zone e.timezone))::int as o,
               extract(hour from (e.window_end at time zone e.timezone))::int * 60
             + extract(minute from (e.window_end at time zone e.timezone))::int as c
         where s.schedule = 'one_day'
        union all
        -- Weekly hours: this weekday's ranges, unless the day is closed.
        select public.hhmm_minutes(w ->> 'start'), public.hhmm_minutes(w ->> 'end')
          from jsonb_array_elements(s.weekly_hours) w
         where s.schedule = 'weekly'
           and (w ->> 'day')::int = extract(dow from d)::int
           and not s.closed_dates ? d::text
      ) ranges
      order by o
    loop
      t := r.o;
      while t + len <= r.c and n < 2000 loop
        clash := null;
        for b in
          select public.hhmm_minutes(x ->> 'start') as bs, (x ->> 'minutes')::int as bm
            from jsonb_array_elements(s.breaks) x
           where public.hhmm_minutes(x ->> 'start') is not null and coalesce((x ->> 'minutes')::int, 0) > 0
           order by 1
        loop
          if t < b.bs + b.bm and t + len > b.bs then
            clash := b.bs + b.bm;
            exit;
          end if;
        end loop;
        if clash is not null then
          t := clash;
          continue;
        end if;
        return next (d + make_interval(mins => t)) at time zone e.timezone;
        n := n + 1;
        t := t + len + s.gap_minutes;
      end loop;
    end loop;
    d := d + 1;
  end loop;
end;
$$;
revoke execute on function public.conference_slot_starts(uuid) from public, anon, authenticated;

-- The earliest a family can book: now, or with weekly hours, the notice.
create function public.conference_earliest(ev uuid)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select now() + case when s.schedule = 'weekly' then make_interval(hours => s.min_notice_hours) else interval '0' end
    from conference_settings s where s.event_id = ev;
$$;
revoke execute on function public.conference_earliest(uuid) from public, anon, authenticated;

-- The public list of times a family can still book (none for a draft).
create or replace function public.conference_open_times(p_slug text)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select t
    from events e, public.conference_slot_starts(e.id) t
   where e.slug = p_slug and e.event_type::text = 'conference' and e.status = 'published'
     and t > public.conference_earliest(e.id)
     and not exists (select 1 from conference_bookings b where b.event_id = e.id and b.starts_at = t)
   order by t;
$$;

-- 5. Booking ----------------------------------------------------------------------
-- Shared checks for booking and changing: a real, open meeting time of a
-- published conference, and how they'll meet.
create or replace function public.conference_booking_check(p_event uuid, p_starts_at timestamptz, p_mode text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  e events;
  s conference_settings;
begin
  select * into e from events where id = p_event;
  if e.id is null or e.event_type::text <> 'conference' or e.status <> 'published' then
    raise exception 'Booking for these conferences is closed.' using errcode = 'P0001';
  end if;
  select * into s from conference_settings where event_id = p_event;
  if p_starts_at <= public.conference_earliest(p_event)
     or not exists (select 1 from public.conference_slot_starts(p_event) t where t = p_starts_at) then
    raise exception 'That time isn''t available. Please pick another.' using errcode = 'P0001';
  end if;
  -- Parent's choice: the family picks in person or video; otherwise it's the teacher's way.
  if s.meeting_mode = 'either' then
    if p_mode not in ('in_person', 'video') then
      raise exception 'Choose in person or video.' using errcode = 'P0001';
    end if;
    return p_mode;
  end if;
  return s.meeting_mode;
end;
$$;
revoke execute on function public.conference_booking_check(uuid, timestamptz, text) from public, anon, authenticated;

-- A family books a meeting. Returns the booking's link token. p_call_phone:
-- the number the teacher calls, for phone calls.
drop function public.book_conference(uuid, timestamptz, text, jsonb, text, text);
create function public.book_conference(p_event uuid, p_starts_at timestamptz, p_child text, p_parents jsonb, p_mode text,
                                       p_note text, p_call_phone text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mode   text;
  token  uuid;
  p      jsonb;
  weekly boolean;
  phone  text := nullif(regexp_replace(coalesce(p_call_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  mode := public.conference_booking_check(p_event, p_starts_at, p_mode);
  if char_length(trim(coalesce(p_child, ''))) not between 2 and 120 then
    raise exception 'Please enter your child''s first and last name.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_parents) <> 'array' or jsonb_array_length(p_parents) not between 1 and 4 then
    raise exception 'Add one to four parents or guardians.' using errcode = 'P0001';
  end if;
  for p in select * from jsonb_array_elements(p_parents) loop
    if char_length(trim(coalesce(p ->> 'name', ''))) not between 2 and 120
       or coalesce(p ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p ->> 'email') > 254 then
      raise exception 'Please enter each parent''s name and email address.' using errcode = 'P0001';
    end if;
  end loop;
  if mode = 'phone' and (phone is null or phone !~ '^\+?[0-9]{7,15}$') then
    raise exception 'Please enter the phone number your teacher should call.' using errcode = 'P0001';
  end if;
  -- One meeting per child (with weekly hours, one upcoming meeting), even if two are booked at once.
  perform pg_advisory_xact_lock(hashtext('conference-child:' || p_event::text), hashtext(lower(trim(p_child))));
  weekly := exists (select 1 from conference_settings where event_id = p_event and schedule = 'weekly');
  if exists (select 1 from conference_bookings
              where event_id = p_event and lower(trim(child_name)) = lower(trim(p_child))
                and (not weekly or starts_at > now())) then
    raise exception '% already has a meeting booked. Use the link in your confirmation email to change it.', trim(p_child)
      using errcode = 'P0001';
  end if;
  begin
    insert into conference_bookings (event_id, starts_at, child_name, parents, meeting_mode, note, call_phone)
    values (p_event, p_starts_at, trim(p_child),
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

-- A family moves their meeting from their link. Returns the event id.
create or replace function public.change_conference_booking(p_token uuid, p_starts_at timestamptz, p_mode text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  b    conference_bookings;
  mode text;
begin
  select * into b from conference_bookings where access_token = p_token for update;
  if not found then
    raise exception 'This link isn''t valid. Your meeting may have been canceled.' using errcode = 'P0001';
  end if;
  if b.starts_at <= now() then
    raise exception 'This meeting has already started, so it can''t be changed.' using errcode = 'P0001';
  end if;
  mode := public.conference_booking_check(b.event_id, p_starts_at, p_mode);
  if mode = 'phone' and b.call_phone is null then
    raise exception 'Your teacher now meets by phone. Cancel this meeting and book again to give a number to call.' using errcode = 'P0001';
  end if;
  begin
    update conference_bookings
       set starts_at = p_starts_at, meeting_mode = mode, calendar_sequence = calendar_sequence + 1, reminded_at = null
     where id = b.id;
  exception when unique_violation then
    raise exception 'That time was just taken. Please pick another.' using errcode = 'P0001';
  end;
  return b.event_id;
end;
$$;

revoke execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text, text) to service_role;

-- Children's names and notes: 30 days after a conference day, or with weekly
-- hours, 30 days after each meeting, in the event's own time zone.
create or replace function public.purge_conference_bookings()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from conference_bookings b using events e
     where e.id = b.event_id
       and (
         (now() at time zone e.timezone)::date > e.ends_on + 30
         or (exists (select 1 from conference_settings s where s.event_id = e.id and s.schedule = 'weekly')
             and (now() at time zone e.timezone)::date > (b.starts_at at time zone e.timezone)::date + 30)
       )
    returning 1
  )
  select count(*)::int from gone;
$$;

-- 6. Publishing -------------------------------------------------------------------
create or replace function public.conference_not_ready(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when not public.is_event_admin(ev) then 'Only the event''s hosts can publish it.'
    when s.event_id is null or s.times_saved_at is null then 'Save your meeting times first (step 1).'
    when s.schedule = 'weekly' and jsonb_array_length(s.weekly_hours) = 0 then 'Add your weekly hours first (step 1).'
    when s.meeting_mode is null then 'Choose where you''ll meet first (step 2).'
    when s.meeting_mode in ('in_person', 'either') and coalesce(trim(e.venue_address), '') = ''
      then 'Add your school''s address first (step 2).'
    when s.meeting_mode in ('in_person', 'either') and coalesce(trim(s.room), '') = '' then 'Add your room and directions first (step 2).'
    when s.meeting_mode in ('video', 'either') and not s.own_link and s.video_link is null then 'Add your meeting link first (step 2).'
    when s.meeting_mode in ('video', 'either') and not s.own_link and not s.waiting_room_confirmed
      then 'Tick that your meeting has a waiting room and runs the whole time (step 2).'
  end
  from events e
  left join conference_settings s on s.event_id = e.id
  where e.id = ev;
$$;

-- Conferences: set up first. Weekly hours need an active plan (premium). Without
-- a plan, an account publishes one conference day at a time. Everything else
-- needs an active plan, as before.
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
    elsif not public.org_has_active_plan(new.organization_id) then
      raise exception 'Publishing needs an active Field Command Events plan' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
