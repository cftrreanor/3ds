-- =============================================================================
-- Teachers offer any mix of in person, video, and phone calls.
--
-- Before, a conference had one way to meet (meeting_mode), or "either" for a
-- family's pick of in person or video. Now meeting_modes lists every way the
-- teacher offers (one to three of in_person, video, phone); with more than one,
-- each family picks when they book (a booking still has one way to meet).
--
-- meeting_mode stays, kept in step by a trigger, so the app from before this
-- update keeps working until the new one is live: setting either column sets
-- the other (a mix the old column can't say is stored as its first way).
--
-- Changing a booking can now switch it to a phone call: change_conference_booking
-- takes the number to call (p_call_phone), and drops the number when a meeting
-- is no longer a call.
-- =============================================================================

create function public.meeting_modes_ok(m text[])
returns boolean
language sql immutable
as $$
  select m is null or (
    cardinality(m) between 1 and 3
    and m <@ array['in_person', 'video', 'phone']
    and cardinality(m) = (select count(distinct x) from unnest(m) x)
  );
$$;

-- The ways a single old meeting_mode stands for.
create function public.meeting_modes_from(mode text)
returns text[]
language sql immutable
as $$
  select case mode
    when 'either' then array['in_person', 'video']
    when 'in_person' then array['in_person']
    when 'video' then array['video']
    when 'phone' then array['phone']
  end;
$$;

-- The old meeting_mode for a list of ways (in a fixed order: in person, video, phone).
create function public.meeting_mode_for(m text[])
returns text
language sql immutable
as $$
  select case
    when m is null or cardinality(m) = 0 then null
    when m @> array['in_person', 'video'] and cardinality(m) = 2 then 'either'
    when 'in_person' = any (m) then 'in_person'
    when 'video' = any (m) then 'video'
    else 'phone'
  end;
$$;

alter table public.conference_settings
  add column meeting_modes text[] check (public.meeting_modes_ok(meeting_modes));
update public.conference_settings set meeting_modes = public.meeting_modes_from(meeting_mode) where meeting_mode is not null;
grant insert (meeting_modes), update (meeting_modes) on public.conference_settings to authenticated;

create function public.conference_settings_sync_modes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.meeting_modes is null and new.meeting_mode is not null then
      new.meeting_modes := public.meeting_modes_from(new.meeting_mode);
    else
      new.meeting_mode := public.meeting_mode_for(new.meeting_modes);
    end if;
  elsif new.meeting_modes is distinct from old.meeting_modes then
    new.meeting_mode := public.meeting_mode_for(new.meeting_modes);
  elsif new.meeting_mode is distinct from old.meeting_mode then
    new.meeting_modes := public.meeting_modes_from(new.meeting_mode);
  end if;
  return new;
end;
$$;

create trigger conference_settings_sync_modes
  before insert or update on public.conference_settings
  for each row execute function public.conference_settings_sync_modes();

-- A family's booking: the time must be open; with more than one way to meet,
-- the family's pick must be one the teacher offers.
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
  if e.id is null or e.event_type::text <> 'conference' or e.status <> 'published' then
    raise exception 'Booking for these conferences is closed.' using errcode = 'P0001';
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
revoke execute on function public.conference_booking_check(uuid, timestamptz, text) from public, anon, authenticated;

-- A family moves their meeting (or changes how they meet) from their link.
-- Returns the event id. Switching to a phone call needs the number to call.
drop function public.change_conference_booking(uuid, timestamptz, text);
create function public.change_conference_booking(p_token uuid, p_starts_at timestamptz, p_mode text, p_call_phone text default null)
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
    raise exception 'Please enter the phone number your teacher should call.' using errcode = 'P0001';
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
revoke execute on function public.change_conference_booking(uuid, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.change_conference_booking(uuid, timestamptz, text, text) to service_role;

-- Publishing: each way the teacher offers needs its details.
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
      then 'Add your school''s address first (step 2).'
    when 'in_person' = any (s.meeting_modes) and coalesce(trim(s.room), '') = '' then 'Add your room and directions first (step 2).'
    when 'video' = any (s.meeting_modes) and not s.own_link and s.video_link is null then 'Add your meeting link first (step 2).'
    when 'video' = any (s.meeting_modes) and not s.own_link and not s.waiting_room_confirmed
      then 'Tick that your meeting has a waiting room and runs the whole time (step 2).'
  end
  from events e
  left join conference_settings s on s.event_id = e.id
  where e.id = ev;
$$;
