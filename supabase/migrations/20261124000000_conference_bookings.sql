-- =============================================================================
-- Parent-teacher conferences, part 2: families book a meeting.
--
--   * conference_bookings: one meeting time, one child, the parents who'll
--     come (each emailed), in person or video, and an optional note. A time
--     holds one family; a child has one meeting. Families change or cancel
--     with the link in their email (access_token).
--   * conference_slot_starts(ev): the meeting times, worked out from the
--     conference's hours, meeting length, gap and breaks (the same as
--     lib/conferences.ts meetingStarts).
--   * conference_open_times(slug): the public list: future, unbooked times of
--     a published conference. Never who booked.
--   * book_conference / change_conference_booking / cancel_conference_booking:
--     used by the app's server (service role) for families, who aren't signed
--     in. Bookings go straight through.
--   * The event's hosts and team read the bookings; hosts can cancel one.
--   * purge_conference_bookings(): children's names and notes go 30 days
--     after the conference (the daily job).
-- =============================================================================

create table public.conference_bookings (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  starts_at         timestamptz not null,
  child_name        text not null check (char_length(trim(child_name)) between 2 and 120),
  -- [{ "name": "Maria Lopez", "email": "maria@example.com", "phone": "+15125550101" }, …]
  parents           jsonb not null check (jsonb_typeof(parents) = 'array' and jsonb_array_length(parents) between 1 and 4),
  meeting_mode      text not null check (meeting_mode in ('in_person', 'video')),
  note              text check (note is null or char_length(note) <= 500),
  -- Secret link in the emails (change or cancel). Never readable by browsers.
  access_token      uuid not null default gen_random_uuid() unique,
  calendar_sequence integer not null default 0,
  reminded_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (event_id, starts_at)
);
create unique index conference_bookings_one_per_child on public.conference_bookings (event_id, lower(trim(child_name)));

alter table public.conference_bookings enable row level security;
revoke all on public.conference_bookings from anon, authenticated;
grant select (id, event_id, starts_at, child_name, parents, meeting_mode, note, reminded_at, created_at), delete
  on public.conference_bookings to authenticated;

create policy "bookings: event team reads" on public.conference_bookings
  for select to authenticated using (public.is_event_admin(event_id) or public.is_event_staff(event_id));
create policy "bookings: hosts cancel" on public.conference_bookings
  for delete to authenticated using (public.is_event_admin(event_id));

-- Every meeting time, in order: back to back (plus the gap), skipping any that
-- would run into a break. Matches meetingStarts() in lib/conferences.ts.
create function public.conference_slot_starts(ev uuid)
returns setof timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  e        events;
  s        conference_settings;
  t        integer;
  finish   integer;
  len      integer;
  b        record;
  clash    integer;
  n        integer := 0;
begin
  select * into e from events where id = ev;
  select * into s from conference_settings where event_id = ev;
  if e.id is null or s.event_id is null or s.times_saved_at is null then
    return;
  end if;
  len := s.meeting_minutes;
  t := extract(hour from (e.window_start at time zone e.timezone))::int * 60
     + extract(minute from (e.window_start at time zone e.timezone))::int;
  finish := extract(hour from (e.window_end at time zone e.timezone))::int * 60
          + extract(minute from (e.window_end at time zone e.timezone))::int;
  while t + len <= finish and n < 200 loop
    clash := null;
    for b in
      select (split_part(x ->> 'start', ':', 1)::int * 60 + split_part(x ->> 'start', ':', 2)::int) as bs,
             (x ->> 'minutes')::int as bm
        from jsonb_array_elements(s.breaks) x
       where coalesce(x ->> 'start', '') ~ '^\d{2}:\d{2}$' and coalesce((x ->> 'minutes')::int, 0) > 0
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
    return next (e.starts_on + make_interval(mins => t)) at time zone e.timezone;
    n := n + 1;
    t := t + len + s.gap_minutes;
  end loop;
end;
$$;
revoke execute on function public.conference_slot_starts(uuid) from public, anon, authenticated;

-- The public list of times a family can still book (none for a draft).
create function public.conference_open_times(p_slug text)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select t
    from events e, public.conference_slot_starts(e.id) t
   where e.slug = p_slug and e.event_type::text = 'conference' and e.status = 'published'
     and t > now()
     and not exists (select 1 from conference_bookings b where b.event_id = e.id and b.starts_at = t)
   order by t;
$$;
revoke execute on function public.conference_open_times(text) from public;
grant execute on function public.conference_open_times(text) to anon, authenticated;

-- Shared checks for booking and changing: a real, future meeting time of a
-- published conference, and how they'll meet.
create function public.conference_booking_check(p_event uuid, p_starts_at timestamptz, p_mode text)
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
  if p_starts_at <= now() or not exists (select 1 from public.conference_slot_starts(p_event) t where t = p_starts_at) then
    raise exception 'That time isn''t available. Please pick another.' using errcode = 'P0001';
  end if;
  -- Parent's choice: the family picks; otherwise it's the teacher's way.
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

-- A family books a meeting. Returns the booking's link token.
create function public.book_conference(p_event uuid, p_starts_at timestamptz, p_child text, p_parents jsonb, p_mode text, p_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mode  text;
  token uuid;
  p     jsonb;
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
  begin
    insert into conference_bookings (event_id, starts_at, child_name, parents, meeting_mode, note)
    values (p_event, p_starts_at, trim(p_child),
            (select jsonb_agg(jsonb_build_object('name', trim(x ->> 'name'), 'email', lower(trim(x ->> 'email')),
                                                 'phone', nullif(trim(coalesce(x ->> 'phone', '')), '')))
               from jsonb_array_elements(p_parents) x),
            mode, nullif(left(trim(coalesce(p_note, '')), 500), ''))
    returning access_token into token;
  exception when unique_violation then
    if exists (select 1 from conference_bookings where event_id = p_event and starts_at = p_starts_at) then
      raise exception 'That time was just taken. Please pick another.' using errcode = 'P0001';
    end if;
    raise exception '% already has a meeting booked. Use the link in your confirmation email to change it.', trim(p_child)
      using errcode = 'P0001';
  end;
  return token;
end;
$$;

-- A family moves their meeting (and, for parent's choice, how they'll meet)
-- from their link. Returns the event id.
create function public.change_conference_booking(p_token uuid, p_starts_at timestamptz, p_mode text)
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

-- A family cancels from their link.
create function public.cancel_conference_booking(p_token uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from conference_bookings where access_token = p_token;
$$;

-- Children's names and notes go 30 days after the conference. Returns how many.
create function public.purge_conference_bookings()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from conference_bookings b using events e
     where e.id = b.event_id and e.ends_on < current_date - 30
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text),
                           public.change_conference_booking(uuid, timestamptz, text),
                           public.cancel_conference_booking(uuid),
                           public.purge_conference_bookings()
  from public, anon, authenticated;
grant execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text),
                          public.change_conference_booking(uuid, timestamptz, text),
                          public.cancel_conference_booking(uuid),
                          public.purge_conference_bookings()
  to service_role;
