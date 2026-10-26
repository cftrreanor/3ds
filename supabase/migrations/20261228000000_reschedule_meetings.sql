-- =============================================================================
-- Rescheduling conferences and meetings, by the event's hosts and co-hosts.
--
--   * Bookings are seen and managed by everyone who runs the event (its hosts
--     and co-hosts), not only the person who set it up (20261209000000 kept
--     them to the creator). Families are told so in the privacy note.
--   * reschedule_conference_booking(): a host or co-host moves a meeting to an
--     open time, or to any time they type in on one of the event's days (even
--     outside the open hours), as long as it doesn't overlap another meeting.
--   * A typed-in time can sit between the usual times, so a time is now taken
--     when it overlaps any meeting (conference_time_taken), not only when it
--     starts at the same moment: families aren't offered those times.
-- No new tables.
-- =============================================================================

-- 1. Who sees and manages bookings: the event's hosts and co-hosts -------------
create or replace function public.is_conference_teacher(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev);
$$;

-- 2. A time is taken when it overlaps a meeting (other than p_except) ----------
create function public.conference_time_taken(ev uuid, t timestamptz, p_except uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from conference_bookings b
      join conference_settings s on s.event_id = b.event_id
     where b.event_id = ev
       and b.id is distinct from p_except
       and b.starts_at < t + make_interval(mins => s.meeting_minutes)
       and t < b.starts_at + make_interval(mins => s.meeting_minutes)
  );
$$;
revoke execute on function public.conference_time_taken(uuid, timestamptz, uuid) from public, anon, authenticated;

-- The times a family can book: as 20261222000000, without times that overlap a meeting.
create or replace function public.conference_open_times(p_slug text)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select t
    from events e, public.conference_slot_starts(e.id) t
   where e.slug = p_slug and e.event_type::text in ('conference', 'meeting') and e.status = 'published'
     and t > public.conference_earliest(e.id)
     and not public.conference_time_taken(e.id, t, null)
   order by t;
$$;

-- Booking and changing: as 20261222000000, and the time can't overlap another
-- meeting (p_except: the family's own meeting, when they're changing it).
create function public.conference_booking_check(p_event uuid, p_starts_at timestamptz, p_mode text, p_except uuid)
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
  if public.conference_time_taken(p_event, p_starts_at, p_except) then
    raise exception 'That time was just taken. Please pick another.' using errcode = 'P0001';
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
revoke execute on function public.conference_booking_check(uuid, timestamptz, text, uuid) from public, anon, authenticated;

-- book_conference() calls the three-argument check: a new booking has no meeting to except.
create or replace function public.conference_booking_check(p_event uuid, p_starts_at timestamptz, p_mode text)
returns text
language sql stable security definer set search_path = public
as $$
  select public.conference_booking_check(p_event, p_starts_at, p_mode, null::uuid);
$$;

-- From the family's link: as 20261222000000, and their own meeting doesn't count as a clash.
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
  mode := public.conference_booking_check(b.event_id, p_starts_at, p_mode, b.id);
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

-- 3. A host or co-host reschedules a meeting ------------------------------------
-- Any time on one of the event's days (in its time zone), in the future, that
-- doesn't overlap another meeting. Returns the event's id.
create function public.reschedule_conference_booking(p_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  b conference_bookings;
  e events;
  d date;
begin
  select * into b from conference_bookings where id = p_id for update;
  if not found or not public.is_conference_teacher(b.event_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if b.starts_at <= now() then
    raise exception 'This meeting has already started, so it can''t be moved.' using errcode = 'P0001';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'Pick a time that hasn''t passed yet.' using errcode = 'P0001';
  end if;
  if p_starts_at = b.starts_at then
    raise exception 'That''s already this meeting''s time. Pick a different one.' using errcode = 'P0001';
  end if;
  select * into e from events where id = b.event_id;
  d := (p_starts_at at time zone e.timezone)::date;
  if d < e.starts_on or d > e.ends_on then
    raise exception 'Pick a day within the event''s dates.' using errcode = 'P0001';
  end if;
  -- One reschedule at a time per event, so two can't land on overlapping times.
  perform pg_advisory_xact_lock(hashtext('conference-reschedule:' || b.event_id::text));
  if public.conference_time_taken(b.event_id, p_starts_at, b.id) then
    raise exception 'That time overlaps another meeting. Pick another.' using errcode = 'P0001';
  end if;
  begin
    update conference_bookings
       set starts_at = p_starts_at, calendar_sequence = calendar_sequence + 1, reminded_at = null
     where id = b.id;
  exception when unique_violation then
    raise exception 'That time overlaps another meeting. Pick another.' using errcode = 'P0001';
  end;
  return b.event_id;
end;
$$;
revoke execute on function public.reschedule_conference_booking(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_conference_booking(uuid, timestamptz) to authenticated;
