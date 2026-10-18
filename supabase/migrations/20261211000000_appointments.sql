-- =============================================================================
-- Appointments: a kind of event for small businesses (and anyone else who
-- takes appointments). One person takes every appointment. Clients book a
-- time for a service, in person or on video, without an account.
--
--   * Free business accounts: a business signs up on its own (like a free
--     teacher account) and hosts appointments only.
--   * appointment_settings: when you're open (weekly hours, specific dates,
--     days closed, and daily breaks), how often appointments can start, the
--     gap between them, booking rules (notice and how far ahead), where you
--     meet, up to three questions for clients, and how long the client list
--     is kept.
--   * appointment_services: what clients book, each with its own length.
--   * appointment_bookings: one client's appointment. Only the person who set
--     the appointments up sees them (like conference bookings). Clients change
--     or cancel with the link in their email (access_token).
--   * appointment_open_times(slug, service, from, to): the public list of open
--     start times. Never who booked.
--   * book_appointment / change_appointment / cancel_appointment: for the
--     app's server (clients aren't signed in).
--   * purge_appointment_bookings(): bookings are deleted once they're older
--     than the business's retention period (the daily job).
--   * Publishing: free during the pilot, one published at a time per
--     account, once hours, a service and the meeting place are set up.
--   * Appointments stay appointments (no switching kinds).
--
-- Times are "HH:MM" in the event's time zone. Days of the week are 0
-- (Sunday) to 6 (Saturday), as Postgres extract(dow) gives them.
-- =============================================================================

alter type public.event_type add value if not exists 'appointments';

-- 1. Business accounts ------------------------------------------------------------
alter table public.organizations drop constraint if exists organizations_account_kind_check;
alter table public.organizations add constraint organizations_account_kind_check
  check (account_kind in ('standard', 'teacher', 'business'));

create function public.create_business_account(p_full_name text, p_business text, p_tz text)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_name text := trim(coalesce(p_full_name, ''));
  v_business text := trim(coalesce(p_business, ''));
  org public.organizations;
begin
  if me is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your name.' using errcode = 'P0001';
  end if;
  if char_length(v_business) < 2 or char_length(v_business) > 160 then
    raise exception 'Please enter your business''s name.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'Please pick your time zone.' using errcode = 'P0001';
  end if;
  -- One account per person (also stops a double tap making two).
  perform pg_advisory_xact_lock(hashtext('create_business_account'), hashtext(me::text));
  if exists (select 1 from organization_members where user_id = me) then
    raise exception 'You already have an account. Go to your dashboard to see it.' using errcode = 'P0001';
  end if;
  if (select count(*) from organizations
       where account_kind = 'business' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'We''re getting a lot of sign-ups right now. Please try again in an hour.' using errcode = 'P0001';
  end if;

  update profiles set full_name = v_name where id = me;
  insert into organizations (name, slug, default_timezone, account_kind)
  values (v_business,
          trim(both '-' from left(regexp_replace(lower(v_business), '[^a-z0-9]+', '-', 'g'), 40)) || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
          p_tz, 'business')
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, me, 'owner');
  -- Their card in the admin pipeline.
  insert into pilot_requests (name, email, organization, status, organization_id, notes)
  values (v_name, public.current_email()::text, v_business, 'new', org.id, 'Signed up for a free business account (appointments).');
  return org;
end;
$$;
revoke execute on function public.create_business_account(text, text, text) from public, anon;
grant execute on function public.create_business_account(text, text, text) to authenticated;

-- Business accounts host appointments only, whoever adds the event.
create function public.business_accounts_host_appointments()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.event_type::text, '') <> 'appointments'
     and exists (select 1 from organizations where id = new.organization_id and account_kind = 'business') then
    raise exception 'Free business accounts host appointments. Request a pilot for other kinds of events.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger business_accounts_host_appointments
  before insert or update of event_type, organization_id on public.events
  for each row execute function public.business_accounts_host_appointments();
revoke execute on function public.business_accounts_host_appointments() from public, anon, authenticated;

-- Appointments stay appointments, and nothing else becomes them.
create function public.appointments_type_is_fixed()
returns trigger
language plpgsql
as $$
begin
  if (old.event_type::text = 'appointments') <> (new.event_type::text = 'appointments') then
    raise exception 'Appointments can''t change to another kind of event, or the other way round. Create a new event instead.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger appointments_type_is_fixed
  before update of event_type on public.events
  for each row execute function public.appointments_type_is_fixed();

-- 2. Settings ---------------------------------------------------------------------
create function public.hhmm_minutes(t text)
returns integer
language sql immutable
as $$
  select case when t ~ '^([01]\d|2[0-3]):[0-5]\d$' then split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int end;
$$;

-- [{ "day": 1, "start": "09:00", "end": "17:00" }, …]: up to 21 ranges.
create function public.appointment_weekly_hours_ok(h jsonb)
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

-- [{ "date": "2026-11-02", "start": "09:00", "end": "12:00" }, { "date": "2026-11-26", "closed": true }, …]:
-- open on a specific date (instead of that day's weekly hours), or closed. Up to 120.
create function public.appointment_dates_ok(d jsonb)
returns boolean
language sql immutable
as $$
  select jsonb_typeof(d) = 'array' and jsonb_array_length(d) <= 120 and not exists (
    select 1 from jsonb_array_elements(d) x
     where jsonb_typeof(x) <> 'object'
        or coalesce(x ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
        or (coalesce(x ->> 'closed', 'false') <> 'true' and (
              public.hhmm_minutes(x ->> 'start') is null
           or public.hhmm_minutes(x ->> 'end') is null
           or public.hhmm_minutes(x ->> 'end') <= public.hhmm_minutes(x ->> 'start')))
  );
$$;

-- [{ "label": "What would you like help with?", "required": true }, …]: up to 3.
create function public.appointment_questions_ok(q jsonb)
returns boolean
language sql immutable
as $$
  select jsonb_typeof(q) = 'array' and jsonb_array_length(q) <= 3 and not exists (
    select 1 from jsonb_array_elements(q) x
     where jsonb_typeof(x) <> 'object'
        or char_length(trim(coalesce(x ->> 'label', ''))) not between 2 and 200
        or coalesce(x ->> 'required', 'false') not in ('true', 'false')
  );
$$;

create table public.appointment_settings (
  event_id                uuid primary key references public.events (id) on delete cascade,
  weekly_hours            jsonb not null default '[]'::jsonb check (public.appointment_weekly_hours_ok(weekly_hours)),
  dates                   jsonb not null default '[]'::jsonb check (public.appointment_dates_ok(dates)),
  -- Every open day: [{ "start": "12:00", "minutes": 30, "label": "Lunch" }, …]
  breaks                  jsonb not null default '[]'::jsonb
                            check (jsonb_typeof(breaks) = 'array' and jsonb_array_length(breaks) <= 8),
  -- Appointments start on the hour, half hour, and so on.
  start_every_minutes     integer not null default 30 check (start_every_minutes in (5, 10, 15, 20, 30, 60)),
  gap_minutes             integer not null default 0 check (gap_minutes between 0 and 60),
  -- Booking rules: how much notice, and how far ahead.
  min_notice_minutes      integer not null default 720 check (min_notice_minutes between 0 and 20160),
  max_days_ahead          integer not null default 60 check (max_days_ahead between 1 and 365),
  -- When step 1 (hours) was last saved.
  hours_saved_at          timestamptz,
  meeting_mode            text check (meeting_mode in ('in_person', 'video', 'either')),
  -- Where to come: an address, a suite, parking, and so on.
  place                   text check (place is null or char_length(place) <= 500),
  video_link              text check (video_link is null or (char_length(video_link) <= 500 and video_link ~ '^https://')),
  waiting_room_confirmed  boolean not null default false,
  questions               jsonb not null default '[]'::jsonb check (public.appointment_questions_ok(questions)),
  -- The client list (names, contact details, answers) is deleted this many days after each appointment.
  retention_days          integer not null default 365 check (retention_days in (30, 90, 180, 365, 730)),
  updated_at              timestamptz not null default now()
);

alter table public.appointment_settings enable row level security;
revoke all on public.appointment_settings from anon, authenticated;
grant select on public.appointment_settings to authenticated;
grant insert (event_id, weekly_hours, dates, breaks, start_every_minutes, gap_minutes, min_notice_minutes, max_days_ahead,
              hours_saved_at, meeting_mode, place, video_link, waiting_room_confirmed, questions, retention_days, updated_at)
  on public.appointment_settings to authenticated;
grant update (weekly_hours, dates, breaks, start_every_minutes, gap_minutes, min_notice_minutes, max_days_ahead,
              hours_saved_at, meeting_mode, place, video_link, waiting_room_confirmed, questions, retention_days, updated_at)
  on public.appointment_settings to authenticated;

create policy "appointment settings: hosts read" on public.appointment_settings
  for select to authenticated using (public.is_event_admin(event_id));
create policy "appointment settings: hosts add" on public.appointment_settings
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "appointment settings: hosts edit" on public.appointment_settings
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- Settings and services only belong to appointments.
create function public.appointment_rows_need_appointments()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type::text from events where id = new.event_id) is distinct from 'appointments' then
    raise exception 'Services and hours are for appointments.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.appointment_rows_need_appointments() from public, anon, authenticated;
create trigger appointment_settings_need_appointments
  before insert on public.appointment_settings
  for each row execute function public.appointment_rows_need_appointments();

-- 3. Services ---------------------------------------------------------------------
create table public.appointment_services (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 2 and 80),
  minutes     integer not null check (minutes between 5 and 480 and minutes % 5 = 0),
  description text check (description is null or char_length(description) <= 300),
  position    integer not null default 0,
  -- Hidden services stay on past bookings but can't be booked.
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.appointment_services (event_id, position);

alter table public.appointment_services enable row level security;
revoke all on public.appointment_services from anon, authenticated;
grant select, delete on public.appointment_services to authenticated;
grant insert (event_id, name, minutes, description, position, active, updated_at) on public.appointment_services to authenticated;
grant update (name, minutes, description, position, active, updated_at) on public.appointment_services to authenticated;

create policy "appointment services: hosts read" on public.appointment_services
  for select to authenticated using (public.is_event_admin(event_id));
create policy "appointment services: hosts add" on public.appointment_services
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "appointment services: hosts edit" on public.appointment_services
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "appointment services: hosts remove" on public.appointment_services
  for delete to authenticated using (public.is_event_admin(event_id));

create trigger appointment_services_need_appointments
  before insert on public.appointment_services
  for each row execute function public.appointment_rows_need_appointments();

-- Up to 12 services.
create function public.appointment_services_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('appointment-services:' || new.event_id::text));
  if (select count(*) from appointment_services where event_id = new.event_id) >= 12 then
    raise exception 'Add up to 12 services.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.appointment_services_limit() from public, anon, authenticated;
create trigger appointment_services_limit
  before insert on public.appointment_services
  for each row execute function public.appointment_services_limit();

-- 4. Bookings ---------------------------------------------------------------------
create table public.appointment_bookings (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  -- The service as it was booked (it may be renamed or removed later).
  service_id        uuid references public.appointment_services (id) on delete set null,
  service_name      text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  client_name       text not null check (char_length(trim(client_name)) between 2 and 120),
  email             text not null check (char_length(email) <= 254),
  phone             text check (phone is null or char_length(phone) <= 30),
  -- [{ "label": "What would you like help with?", "answer": "…" }, …]
  answers           jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  meeting_mode      text not null check (meeting_mode in ('in_person', 'video')),
  note              text check (note is null or char_length(note) <= 500),
  -- Secret link in the emails (change or cancel). Never readable by browsers.
  access_token      uuid not null default gen_random_uuid() unique,
  calendar_sequence integer not null default 0,
  reminded_at       timestamptz,
  outcome           text check (outcome in ('met', 'no_show')),
  outcome_at        timestamptz,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.appointment_bookings (event_id, starts_at);

alter table public.appointment_bookings enable row level security;
revoke all on public.appointment_bookings from anon, authenticated;
grant select (id, event_id, service_id, service_name, starts_at, ends_at, client_name, email, phone, answers, meeting_mode,
              note, reminded_at, outcome, outcome_at, created_at), delete
  on public.appointment_bookings to authenticated;

-- The person who set the appointments up (the event's creator). If they're
-- gone, the account's hosts, so the bookings aren't stranded.
create function public.is_appointment_host(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev) and exists (
    select 1 from events e
    where e.id = ev and e.event_type::text = 'appointments' and (e.created_by = auth.uid() or e.created_by is null)
  );
$$;
revoke execute on function public.is_appointment_host(uuid) from public, anon;
grant execute on function public.is_appointment_host(uuid) to authenticated;

create policy "appointment bookings: the host reads" on public.appointment_bookings
  for select to authenticated using (public.is_appointment_host(event_id));
create policy "appointment bookings: the host cancels" on public.appointment_bookings
  for delete to authenticated using (public.is_appointment_host(event_id));

-- How many appointments are booked from now on, for anyone who runs the event (no names).
create function public.appointment_upcoming_count(ev uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case when public.is_event_admin(ev)
    then (select count(*)::integer from appointment_bookings where event_id = ev and ends_at > now())
  end;
$$;
revoke execute on function public.appointment_upcoming_count(uuid) from public, anon;
grant execute on function public.appointment_upcoming_count(uuid) to authenticated;

-- 5. Open times -------------------------------------------------------------------
-- The hours open on one day, in minutes from midnight: that date's own hours
-- if it has any (or none if it's closed), otherwise the weekly hours, between
-- the event's first and last day.
create function public.appointment_day_hours(e events, s appointment_settings, d date)
returns table (open_min integer, close_min integer)
language sql stable
as $$
  with own as (
    select x from jsonb_array_elements(s.dates) x where x ->> 'date' = d::text
  )
  select distinct public.hhmm_minutes(x ->> 'start'), public.hhmm_minutes(x ->> 'end')
    from own
   where coalesce(x ->> 'closed', 'false') <> 'true'
  union
  select distinct public.hhmm_minutes(w ->> 'start'), public.hhmm_minutes(w ->> 'end')
    from jsonb_array_elements(s.weekly_hours) w
   where not exists (select 1 from own)
     and d between e.starts_on and e.ends_on
     and (w ->> 'day')::int = extract(dow from d)::int;
$$;
revoke execute on function public.appointment_day_hours(events, appointment_settings, date) from public, anon, authenticated;

-- Every start time for a service between two dates (inclusive): from each
-- opening, every start_every_minutes, as long as the appointment ends by
-- closing and doesn't run into a break. Booked times aren't removed here.
create function public.appointment_slot_starts(ev uuid, p_minutes integer, p_from date, p_to date)
returns setof timestamptz
language plpgsql stable security definer set search_path = public
as $$
declare
  e   events;
  s   appointment_settings;
  d   date;
  h   record;
  t   integer;
  b   record;
  hit boolean;
begin
  select * into e from events where id = ev;
  select * into s from appointment_settings where event_id = ev;
  if e.id is null or s.event_id is null or s.hours_saved_at is null or p_minutes is null or p_from > p_to then
    return;
  end if;
  d := p_from;
  while d <= p_to and d <= p_from + 400 loop
    for h in select distinct * from public.appointment_day_hours(e, s, d) order by 1 loop
      t := h.open_min;
      while t + p_minutes <= h.close_min loop
        hit := false;
        for b in
          select public.hhmm_minutes(x ->> 'start') as bs, (x ->> 'minutes')::int as bm
            from jsonb_array_elements(s.breaks) x
           where public.hhmm_minutes(x ->> 'start') is not null and coalesce((x ->> 'minutes')::int, 0) > 0
        loop
          if t < b.bs + b.bm and t + p_minutes > b.bs then
            hit := true;
            exit;
          end if;
        end loop;
        if not hit then
          return next (d + make_interval(mins => t)) at time zone e.timezone;
        end if;
        t := t + s.start_every_minutes;
      end loop;
    end loop;
    d := d + 1;
  end loop;
end;
$$;
revoke execute on function public.appointment_slot_starts(uuid, integer, date, date) from public, anon, authenticated;

-- Whether a time is free for an appointment of this length: inside the
-- booking rules and not overlapping another booking (with the gap on both
-- sides). p_ignore: the booking being changed.
create function public.appointment_time_free(ev uuid, p_start timestamptz, p_minutes integer, p_ignore uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_start >= now() + make_interval(mins => s.min_notice_minutes)
     and (p_start at time zone e.timezone)::date <= (now() at time zone e.timezone)::date + s.max_days_ahead
     and not exists (
       select 1 from appointment_bookings b
        where b.event_id = ev and b.id is distinct from p_ignore
          and p_start < b.ends_at + make_interval(mins => s.gap_minutes)
          and p_start + make_interval(mins => p_minutes + s.gap_minutes) > b.starts_at
     )
    from events e join appointment_settings s on s.event_id = e.id
   where e.id = ev;
$$;
revoke execute on function public.appointment_time_free(uuid, timestamptz, integer, uuid) from public, anon, authenticated;

-- The public list of open start times for a service (none for a draft), up to
-- 62 days at a time.
create function public.appointment_open_times(p_slug text, p_service uuid, p_from date, p_to date)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select t
    from events e
    join appointment_services v on v.event_id = e.id and v.id = p_service and v.active,
         public.appointment_slot_starts(e.id, v.minutes, p_from, least(p_to, p_from + 61)) t
   where e.slug = p_slug and e.event_type::text = 'appointments' and e.status = 'published'
     and public.appointment_time_free(e.id, t, v.minutes, null)
   order by t;
$$;
revoke execute on function public.appointment_open_times(text, uuid, date, date) from public;
grant execute on function public.appointment_open_times(text, uuid, date, date) to anon, authenticated;

-- 6. Booking, changing and canceling (the app's server, for clients) --------------
-- A real, open start time for an active service of published appointments,
-- and how they'll meet. Locks the event's bookings until the transaction ends.
create function public.appointment_booking_check(p_event uuid, p_service uuid, p_start timestamptz, p_mode text, p_ignore uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  e events;
  s appointment_settings;
  v appointment_services;
  d date;
begin
  select * into e from events where id = p_event;
  if e.id is null or e.event_type::text <> 'appointments' or e.status <> 'published' then
    raise exception 'Booking is closed.' using errcode = 'P0001';
  end if;
  select * into s from appointment_settings where event_id = p_event;
  select * into v from appointment_services where id = p_service and event_id = p_event and active;
  if v.id is null then
    raise exception 'That service isn''t available. Please pick another.' using errcode = 'P0001';
  end if;
  -- One booking at a time per business, so two clients can't take the same time.
  perform pg_advisory_xact_lock(hashtext('appointment-book:' || p_event::text));
  d := (p_start at time zone e.timezone)::date;
  if not exists (select 1 from public.appointment_slot_starts(p_event, v.minutes, d, d) t where t = p_start)
     or not public.appointment_time_free(p_event, p_start, v.minutes, p_ignore) then
    raise exception 'That time isn''t available. Please pick another.' using errcode = 'P0001';
  end if;
  if s.meeting_mode = 'either' then
    if p_mode not in ('in_person', 'video') then
      raise exception 'Choose in person or video.' using errcode = 'P0001';
    end if;
    return p_mode;
  end if;
  return s.meeting_mode;
end;
$$;
revoke execute on function public.appointment_booking_check(uuid, uuid, timestamptz, text, uuid) from public, anon, authenticated;

-- A client books. p_answers: one answer per question, in order. Returns the link token.
create function public.book_appointment(p_event uuid, p_service uuid, p_starts_at timestamptz, p_name text, p_email text,
                                        p_phone text, p_answers jsonb, p_mode text, p_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mode    text;
  token   uuid;
  s       appointment_settings;
  v       appointment_services;
  answers jsonb := '[]'::jsonb;
  q       record;
  a       text;
begin
  mode := public.appointment_booking_check(p_event, p_service, p_starts_at, p_mode, null);
  select * into s from appointment_settings where event_id = p_event;
  select * into v from appointment_services where id = p_service;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Please enter your first and last name.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(trim(p_email)) > 254 then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Please answer the questions.' using errcode = 'P0001';
  end if;
  for q in select x, n from jsonb_array_elements(s.questions) with ordinality as t(x, n) loop
    a := nullif(left(trim(coalesce(p_answers ->> (q.n::int - 1), '')), 1000), '');
    if a is null and q.x ->> 'required' = 'true' then
      raise exception 'Please answer: %', q.x ->> 'label' using errcode = 'P0001';
    end if;
    if a is not null then
      answers := answers || jsonb_build_array(jsonb_build_object('label', q.x ->> 'label', 'answer', a));
    end if;
  end loop;
  insert into appointment_bookings (event_id, service_id, service_name, starts_at, ends_at, client_name, email, phone,
                                    answers, meeting_mode, note)
  values (p_event, v.id, v.name, p_starts_at, p_starts_at + make_interval(mins => v.minutes), trim(p_name),
          lower(trim(p_email)), nullif(left(trim(coalesce(p_phone, '')), 30), ''), answers, mode,
          nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning access_token into token;
  return token;
end;
$$;

-- A client moves their appointment (same service; for client's choice, also
-- how they'll meet) from their link. Returns the event id.
create function public.change_appointment(p_token uuid, p_starts_at timestamptz, p_mode text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  b    appointment_bookings;
  mode text;
  v    appointment_services;
begin
  select * into b from appointment_bookings where access_token = p_token for update;
  if not found then
    raise exception 'This link isn''t valid. Your appointment may have been canceled.' using errcode = 'P0001';
  end if;
  if b.starts_at <= now() then
    raise exception 'This appointment has already started, so it can''t be changed.' using errcode = 'P0001';
  end if;
  if b.service_id is null then
    raise exception 'This service is no longer offered. Cancel this appointment and book another.' using errcode = 'P0001';
  end if;
  mode := public.appointment_booking_check(b.event_id, b.service_id, p_starts_at, p_mode, b.id);
  select * into v from appointment_services where id = b.service_id;
  update appointment_bookings
     set starts_at = p_starts_at, ends_at = p_starts_at + make_interval(mins => v.minutes), meeting_mode = mode,
         calendar_sequence = calendar_sequence + 1, reminded_at = null
   where id = b.id;
  return b.event_id;
end;
$$;

-- A client cancels from their link.
create function public.cancel_appointment(p_token uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from appointment_bookings where access_token = p_token;
$$;

-- Bookings older than the business's retention period. Returns how many.
create function public.purge_appointment_bookings()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from appointment_bookings b
     using appointment_settings s
     where s.event_id = b.event_id and b.ends_at < now() - make_interval(days => s.retention_days)
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, jsonb, text, text),
                           public.change_appointment(uuid, timestamptz, text),
                           public.cancel_appointment(uuid),
                           public.purge_appointment_bookings()
  from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, jsonb, text, text),
                          public.change_appointment(uuid, timestamptz, text),
                          public.cancel_appointment(uuid),
                          public.purge_appointment_bookings()
  to service_role;

-- Met / No-show, once the appointment has started: the host only.
create function public.set_appointment_outcome(p_id uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b appointment_bookings;
begin
  if p_outcome is not null and p_outcome not in ('met', 'no_show') then
    raise exception 'Choose Met or No-show' using errcode = '22023';
  end if;
  select * into b from appointment_bookings where id = p_id for update;
  if b.id is null or not coalesce(public.is_appointment_host(b.event_id), false) then
    raise exception 'You don''t have permission to do that' using errcode = '42501';
  end if;
  if p_outcome is not null and b.starts_at > now() then
    raise exception 'You can mark this once the appointment has started.' using errcode = 'P0001';
  end if;
  update appointment_bookings
     set outcome = p_outcome,
         outcome_at = case when p_outcome is null then null else now() end
   where id = p_id;
end;
$$;
revoke execute on function public.set_appointment_outcome(uuid, text) from public, anon;
grant execute on function public.set_appointment_outcome(uuid, text) to authenticated;

-- 7. Publishing -------------------------------------------------------------------
-- What's still missing before appointments can be published (null when ready).
create function public.appointments_not_ready(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when not public.is_event_admin(ev) then 'Only the event''s hosts can publish it.'
    when s.event_id is null or s.hours_saved_at is null then 'Save your hours first (step 1).'
    when jsonb_array_length(s.weekly_hours) = 0
         and not exists (select 1 from jsonb_array_elements(s.dates) x where coalesce(x ->> 'closed', 'false') <> 'true')
      then 'Add the hours or dates you''re open first (step 1).'
    when not exists (select 1 from appointment_services v where v.event_id = ev and v.active)
      then 'Add a service clients can book first (step 2).'
    when s.meeting_mode is null then 'Choose where you''ll meet first (step 3).'
    when s.meeting_mode in ('in_person', 'either') and coalesce(trim(s.place), '') = '' then 'Add where clients should come first (step 3).'
    when s.meeting_mode in ('video', 'either') and s.video_link is null then 'Add your video link first (step 3).'
    when s.meeting_mode in ('video', 'either') and not s.waiting_room_confirmed
      then 'Tick that your video meeting has a waiting room first (step 3).'
  end
  from (select ev as id) e
  left join appointment_settings s on s.event_id = e.id;
$$;
revoke execute on function public.appointments_not_ready(uuid) from public, anon;
grant execute on function public.appointments_not_ready(uuid) to authenticated;

-- The account's other published appointments, if any. Hosts of the event only.
create function public.other_published_appointments(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select o.name from events e
    join events o on o.organization_id = e.organization_id
   where e.id = ev and public.is_event_admin(ev)
     and o.event_type::text = 'appointments' and o.status = 'published' and o.id <> ev
   limit 1;
$$;
revoke execute on function public.other_published_appointments(uuid) from public, anon;
grant execute on function public.other_published_appointments(uuid) to authenticated;

-- Conferences and appointments are free (one published at a time per
-- account, set up first); everything else needs an active plan, as before.
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
      -- One at a time, even if two are published at once.
      perform pg_advisory_xact_lock(hashtext('conference-publish:' || new.organization_id::text));
      other := public.other_published_conference(new.id);
      if other is not null then
        raise exception 'You already have a published conference: %. Unpublish it first, then publish this one.', other
          using errcode = 'P0001';
      end if;
    elsif new.event_type::text = 'appointments' then
      missing_step := public.appointments_not_ready(new.id);
      if missing_step is not null then
        raise exception '%', missing_step using errcode = 'P0001';
      end if;
      perform pg_advisory_xact_lock(hashtext('appointments-publish:' || new.organization_id::text));
      other := public.other_published_appointments(new.id);
      if other is not null then
        raise exception 'You already have published appointments: %. Unpublish them first, then publish these.', other
          using errcode = 'P0001';
      end if;
    elsif not public.org_has_active_plan(new.organization_id) then
      raise exception 'Publishing needs an active Field Command Events plan' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 8. "Saved by" -------------------------------------------------------------------
create trigger appointment_settings_note_save after insert or update or delete on public.appointment_settings
  for each row execute function public.note_event_save('appointments', 'updated_at');
create trigger appointment_services_note_save after insert or update or delete on public.appointment_services
  for each row execute function public.note_event_save('appointments', 'updated_at');
