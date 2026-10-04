-- =============================================================================
-- Volunteer passes and calendar invites.
--
-- Volunteers shouldn't need to log in to see or cancel their shifts:
--   * Each signup gets a private manage_token. The browser that made the
--     signup keeps it in a cookie ("remember this device"), so it can see
--     and cancel exactly the shifts it booked, and nothing else.
--   * Each volunteer gets a private access_token. It's only ever sent to their
--     email address, so opening that link proves they own the inbox, and it
--     shows all of their shifts for that event.
-- Both are checked by the functions below, which only the server can call.
-- =============================================================================

alter table public.volunteers
  add column access_token uuid not null default gen_random_uuid() unique,
  add column link_sent_at timestamptz;

alter table public.volunteer_assignments
  add column manage_token uuid not null default gen_random_uuid() unique,
  -- iCalendar SEQUENCE: bumped each time we send an update for this shift.
  add column calendar_sequence int not null default 0;

-- Tokens are secrets: browsers may read every column except these.
revoke select on public.volunteers from anon, authenticated;
grant select (id, event_id, full_name, email, phone, created_at) on public.volunteers to authenticated;
revoke select on public.volunteer_assignments from anon, authenticated;
grant select (id, shift_id, volunteer_id, checked_in_at, checked_in_by, created_at)
  on public.volunteer_assignments to authenticated;

create or replace function public.register_volunteer(
  p_event_id   uuid,
  p_full_name  text,
  p_email      text,
  p_phone      text,
  p_shift_ids  uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev        public.events;
  vol_id    uuid;
  sh        public.shifts;
begin
  select * into ev from events where id = p_event_id;
  if ev.id is null or ev.status <> 'published' or not ev.volunteer_signup_open then
    raise exception 'Volunteer signup is not open for this event' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 then
    raise exception 'Pick at least one shift' using errcode = 'P0001';
  end if;

  insert into volunteers (event_id, full_name, email, phone)
  values (p_event_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone))
  -- An existing volunteer's name and phone are kept: the public form can't
  -- prove who is typing, so it mustn't overwrite someone else's details.
  on conflict (event_id, email)
    do update set email = volunteers.email
  returning id into vol_id;

  for sh in
    select * from shifts
    where id = any (p_shift_ids) and event_id = p_event_id
    order by id
    for update
  loop
    if exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = vol_id) then
      continue; -- already booked; signing up twice is harmless
    end if;
    if sh.registered_count >= sh.max_capacity then
      raise exception 'Sorry, "%" just filled up. Please pick another shift.', sh.title
        using errcode = 'P0002';
    end if;
    if exists (
      select 1 from volunteer_assignments a
      join shifts s2 on s2.id = a.shift_id
      where a.volunteer_id = vol_id
        and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(sh.starts_at, sh.ends_at)
    ) then
      raise exception '"%" overlaps with another shift you signed up for.', sh.title
        using errcode = 'P0003';
    end if;

    insert into volunteer_assignments (shift_id, volunteer_id) values (sh.id, vol_id);
    update shifts set registered_count = registered_count + 1 where id = sh.id;
  end loop;

  if (select count(*) from shifts where id = any (p_shift_ids) and event_id = p_event_id)
     <> cardinality(array(select distinct unnest(p_shift_ids))) then
    raise exception 'One of the selected shifts does not exist' using errcode = 'P0001';
  end if;

  return vol_id;
end;
$$;

-- Shifts visible to whoever holds these tokens (from the device cookie or the
-- emailed link). Events that ended over a week ago drop off.
create or replace function public.pass_agenda(p_volunteer_tokens uuid[], p_assignment_tokens uuid[])
returns table (
  assignment_id     uuid,
  manage_token      uuid,
  event_id          uuid,
  event_name        text,
  timezone          text,
  venue_name        text,
  venue_address     text,
  station_name      text,
  station_location  text,
  instructions      text,
  shift_title       text,
  shift_description text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  lead_name         text,
  lead_phone        text,
  lead_email        text,
  checked_in_at     timestamptz,
  volunteer_email   text
)
language sql stable security definer set search_path = public
as $$
  select va.id, va.manage_token, e.id, e.name, e.timezone, e.venue_name, e.venue_address,
         st.name, st.location, st.instructions, s.title, s.description, s.starts_at, s.ends_at,
         p.full_name, p.phone, p.email::text, va.checked_in_at, v.email::text
    from volunteer_assignments va
    join volunteers v on v.id = va.volunteer_id
    join shifts s on s.id = va.shift_id
    join stations st on st.id = s.station_id
    join events e on e.id = v.event_id
    left join profiles p on p.id = st.lead_user_id
   where (v.access_token = any (coalesce(p_volunteer_tokens, '{}'))
          or va.manage_token = any (coalesce(p_assignment_tokens, '{}')))
     and s.ends_at > now() - interval '7 days'
   order by s.starts_at;
$$;

-- Cancel a shift using a pass. Returns false if the tokens don't cover it.
create or replace function public.cancel_with_pass(
  p_assignment_id uuid, p_volunteer_tokens uuid[], p_assignment_tokens uuid[]
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a record;
begin
  select va.id, va.shift_id into a
    from volunteer_assignments va
    join volunteers v on v.id = va.volunteer_id
   where va.id = p_assignment_id
     and (v.access_token = any (coalesce(p_volunteer_tokens, '{}'))
          or va.manage_token = any (coalesce(p_assignment_tokens, '{}')));
  if a.id is null then
    return false;
  end if;
  perform 1 from shifts where id = a.shift_id for update;
  delete from volunteer_assignments where id = a.id;
  update shifts set registered_count = registered_count - 1 where id = a.shift_id;
  return true;
end;
$$;

-- Everything needed to write a calendar invite for each assignment. With
-- p_bump, the SEQUENCE goes up first (an update to an invite already sent).
create or replace function public.calendar_entries(p_assignment_ids uuid[], p_bump boolean default false)
returns table (
  assignment_id     uuid,
  manage_token      uuid,
  access_token      uuid,
  calendar_sequence int,
  volunteer_name    text,
  volunteer_email   text,
  event_name        text,
  timezone          text,
  venue_name        text,
  venue_address     text,
  station_name      text,
  station_location  text,
  instructions      text,
  shift_title       text,
  shift_description text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  lead_name         text,
  lead_phone        text
)
language plpgsql security definer set search_path = public
as $$
begin
  if p_bump then
    update volunteer_assignments va set calendar_sequence = va.calendar_sequence + 1
     where va.id = any (p_assignment_ids);
  end if;
  return query
    select va.id, va.manage_token, v.access_token, va.calendar_sequence, v.full_name, v.email::text,
           e.name, e.timezone, e.venue_name, e.venue_address, st.name, st.location, st.instructions,
           s.title, s.description, s.starts_at, s.ends_at, p.full_name, p.phone
      from volunteer_assignments va
      join volunteers v on v.id = va.volunteer_id
      join shifts s on s.id = va.shift_id
      join stations st on st.id = s.station_id
      join events e on e.id = v.event_id
      left join profiles p on p.id = st.lead_user_id
     where va.id = any (p_assignment_ids)
     order by s.starts_at;
end;
$$;

-- The signed-in agenda now also carries the event's time zone and each
-- signup's manage token (for "Add to calendar" links).
drop function if exists public.my_agenda();
create function public.my_agenda()
returns table (
  assignment_id     uuid,
  manage_token      uuid,
  event_id          uuid,
  event_name        text,
  timezone          text,
  venue_name        text,
  venue_address     text,
  station_name      text,
  station_location  text,
  instructions      text,
  shift_title       text,
  shift_description text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  lead_name         text,
  lead_phone        text,
  lead_email        text,
  checked_in_at     timestamptz,
  volunteer_email   text
)
language sql stable security definer set search_path = public
as $$
  select va.id, va.manage_token, e.id, e.name, e.timezone, e.venue_name, e.venue_address,
         st.name, st.location, st.instructions, s.title, s.description, s.starts_at, s.ends_at,
         p.full_name, p.phone, p.email::text, va.checked_in_at, v.email::text
    from volunteers v
    join volunteer_assignments va on va.volunteer_id = v.id
    join shifts s on s.id = va.shift_id
    join stations st on st.id = s.station_id
    join events e on e.id = v.event_id
    left join profiles p on p.id = st.lead_user_id
   where v.email = public.current_email()
   order by s.starts_at;
$$;

revoke execute on function public.pass_agenda(uuid[], uuid[]),
                           public.cancel_with_pass(uuid, uuid[], uuid[]),
                           public.calendar_entries(uuid[], boolean),
                           public.my_agenda()
  from public, anon, authenticated;
grant execute on function public.pass_agenda(uuid[], uuid[]),
                          public.cancel_with_pass(uuid, uuid[], uuid[]),
                          public.calendar_entries(uuid[], boolean)
  to service_role;
grant execute on function public.my_agenda() to authenticated;
