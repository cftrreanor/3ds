-- =============================================================================
-- Signing up more than one person, and minors.
--   * One person can sign up themselves plus up to 4 others (a spouse, their
--     student). Each is their own line on the volunteer sheet, on the same
--     shifts, sharing the signer's cell number. contact_id points at the
--     person who signed them up.
--   * Anyone can be marked as a minor (under 18 / a student). For minors we
--     only ever store first name + last initial ("Emma R."), and their phone
--     is shown as their guardian's.
--   * A group signs up for a shift together or not at all.
--   * Walk-ups: phone is optional, and the desk can add a group too.
-- =============================================================================

alter table public.volunteers alter column phone drop not null;
alter table public.volunteers
  add column minor boolean not null default false,
  add column contact_id uuid references public.volunteers (id) on delete cascade;
create index on public.volunteers (contact_id);
grant select (minor, contact_id) on public.volunteers to authenticated;

-- "Emma Rodriguez" -> "Emma R.", "Mary Ann Smith" -> "Mary Ann S.", "Emma" -> "Emma".
create function public.minor_name(p text)
returns text
language sql immutable
as $$
  select case
           when position(' ' in t) = 0 then t
           else regexp_replace(t, ' \S+$', '') || ' ' || upper(left(regexp_replace(t, '^.* ', ''), 1)) || '.'
         end
    from (select regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g') as t) x;
$$;

-- Make sure no minor's full last name is ever stored.
update public.volunteers set full_name = public.minor_name(full_name) where minor;
alter table public.volunteers
  add constraint volunteers_minor_initial check (not minor or full_name = public.minor_name(full_name));

-- The people in a signup besides the signer: [{"name": "...", "minor": true}, ...].
create function public.signup_companions(
  p_event_id    uuid,
  p_contact_id  uuid,
  p_phone       text,
  p_companions  jsonb,
  p_walk_up     boolean
)
returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  c       jsonb;
  nm      text;
  is_min  boolean;
  c_id    uuid;
  ids     uuid[] := '{}';
begin
  if jsonb_typeof(coalesce(p_companions, '[]')) <> 'array' then
    raise exception 'Something went wrong. Please try again.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_companions, '[]')) > 4 then
    raise exception 'You can add up to 4 other people.' using errcode = 'P0001';
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_companions, '[]'))
  loop
    is_min := coalesce((c ->> 'minor')::boolean, false);
    nm := regexp_replace(trim(coalesce(c ->> 'name', '')), '\s+', ' ', 'g');
    if is_min then
      nm := public.minor_name(nm);
    end if;
    if length(nm) not between 1 and 200 then
      raise exception 'Please enter a name for everyone you''re adding.' using errcode = 'P0001';
    end if;
    -- Signing up again with the same people reuses them.
    select id into c_id from volunteers
     where contact_id = p_contact_id and lower(full_name) = lower(nm)
     limit 1;
    if c_id is null then
      insert into volunteers (event_id, full_name, email, phone, minor, contact_id, walk_up)
      values (p_event_id, nm, null, p_phone, is_min, p_contact_id, p_walk_up)
      returning id into c_id;
    end if;
    if c_id = any (ids) then
      raise exception 'You added % twice.', nm using errcode = 'P0001';
    end if;
    ids := ids || c_id;
  end loop;
  return ids;
end;
$$;
revoke execute on function public.signup_companions(uuid, uuid, text, jsonb, boolean) from public, anon, authenticated;

-- Book everyone on the shifts: all together, or not at all.
create function public.book_group(p_event_id uuid, p_people uuid[], p_shift_ids uuid[], p_check_in boolean, p_over_capacity boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sh       public.shifts;
  person   uuid;
  needed   int;
  who      text;
begin
  for sh in
    select * from shifts
    where id = any (p_shift_ids) and event_id = p_event_id
    order by id
    for update
  loop
    select count(*) into needed from unnest(p_people) p
     where not exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = p);
    continue when needed = 0; -- already booked; signing up twice is harmless
    if sh.registered_count + needed > sh.max_capacity then
      if p_over_capacity then
        update shifts set max_capacity = registered_count + needed where id = sh.id;
      elsif sh.registered_count >= sh.max_capacity then
        raise exception 'Sorry, "%" just filled up. Please pick another shift.', sh.title using errcode = 'P0002';
      else
        raise exception 'Only % left in "%" for your group of %. Please pick another shift.',
          case when sh.max_capacity - sh.registered_count = 1 then '1 spot' else (sh.max_capacity - sh.registered_count) || ' spots' end,
          sh.title, needed
          using errcode = 'P0002';
      end if;
    end if;
    foreach person in array p_people loop
      continue when exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = person);
      if exists (
        select 1 from volunteer_assignments a
        join shifts s2 on s2.id = a.shift_id
        where a.volunteer_id = person
          and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(sh.starts_at, sh.ends_at)
      ) then
        select case when v.contact_id is null then 'you' else v.full_name end into who from volunteers v where v.id = person;
        raise exception '"%" overlaps with another shift % signed up for.', sh.title, who using errcode = 'P0003';
      end if;
      insert into volunteer_assignments (shift_id, volunteer_id, checked_in_at, checked_in_by)
      values (sh.id, person, case when p_check_in then now() end, case when p_check_in then auth.uid() end);
    end loop;
    update shifts set registered_count = registered_count + needed where id = sh.id;
  end loop;

  if (select count(*) from shifts where id = any (p_shift_ids) and event_id = p_event_id)
     <> cardinality(array(select distinct unnest(p_shift_ids))) then
    raise exception 'One of the selected shifts does not exist' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.book_group(uuid, uuid[], uuid[], boolean, boolean) from public, anon, authenticated;

-- Public signup (called by our server): the signer plus anyone they add.
drop function public.register_volunteer(uuid, text, text, text, uuid[]);
create function public.register_volunteer(
  p_event_id    uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text,
  p_shift_ids   uuid[],
  p_minor       boolean default false,
  p_companions  jsonb default '[]'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev        public.events;
  vol_id    uuid;
  vol_phone text;
begin
  select * into ev from events where id = p_event_id;
  if ev.id is null or ev.status <> 'published' or not ev.volunteer_signup_open then
    raise exception 'Volunteer signup is not open for this event' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 then
    raise exception 'Pick at least one shift' using errcode = 'P0001';
  end if;

  insert into volunteers (event_id, full_name, email, phone, minor)
  values (p_event_id,
          case when p_minor then public.minor_name(p_full_name) else trim(p_full_name) end,
          lower(trim(p_email)), trim(p_phone), coalesce(p_minor, false))
  -- An existing volunteer's name and phone are kept: the public form can't
  -- prove who is typing, so it mustn't overwrite someone else's details.
  on conflict (event_id, email)
    do update set email = volunteers.email
  returning id, phone into vol_id, vol_phone;

  perform public.book_group(
    p_event_id,
    array[vol_id] || public.signup_companions(p_event_id, vol_id, vol_phone, p_companions, false),
    p_shift_ids, false, false);
  return vol_id;
end;
$$;
revoke execute on function public.register_volunteer(uuid, text, text, text, uuid[], boolean, jsonb) from public, anon, authenticated;
grant execute on function public.register_volunteer(uuid, text, text, text, uuid[], boolean, jsonb) to service_role;

-- Walk-ups: name only (phone optional), and the people with them.
drop function public.add_walk_up(uuid, text, text, boolean);
create function public.add_walk_up(
  p_shift_id       uuid,
  p_full_name      text,
  p_phone          text default null,
  p_over_capacity  boolean default false,
  p_minor          boolean default false,
  p_companions     jsonb default '[]'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  sh      shifts;
  nm      text;
  ph      text := nullif(trim(coalesce(p_phone, '')), '');
  vol_id  uuid;
  people  uuid[];
  needed  int;
begin
  select * into sh from shifts where id = p_shift_id;
  if sh.id is null or not public.can_manage_volunteers(sh.event_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  nm := case when p_minor then public.minor_name(p_full_name) else regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g') end;
  if length(nm) not between 1 and 200 then
    raise exception 'Please enter their name.' using errcode = 'P0001';
  end if;

  -- The same walk-up helping with a second shift is one person (when we know their phone).
  if ph is not null then
    select id into vol_id from volunteers
     where event_id = sh.event_id and walk_up and contact_id is null and phone = ph and lower(full_name) = lower(nm)
     limit 1;
  end if;
  if vol_id is null then
    insert into volunteers (event_id, full_name, email, phone, walk_up, minor)
    values (sh.event_id, nm, null, ph, true, coalesce(p_minor, false))
    returning id into vol_id;
  end if;
  people := array[vol_id] || public.signup_companions(sh.event_id, vol_id, ph, p_companions, true);
  select count(*) into needed from unnest(people) p
   where exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = p);
  if needed = cardinality(people) then
    raise exception 'They''re already on this shift.' using errcode = 'P0001';
  end if;
  if sh.registered_count + cardinality(people) - needed > sh.max_capacity and not p_over_capacity then
    raise exception 'This shift is full.' using errcode = 'P0004';
  end if;
  perform public.book_group(sh.event_id, people, array[sh.id], true, p_over_capacity);
  return vol_id;
end;
$$;
revoke execute on function public.add_walk_up(uuid, text, text, boolean, boolean, jsonb) from public, anon;
grant execute on function public.add_walk_up(uuid, text, text, boolean, boolean, jsonb) to authenticated;

-- Station rosters say who's a minor (their phone is a guardian's) and who
-- signed someone up.
drop function public.station_roster(uuid);
create function public.station_roster(p_station_id uuid)
returns table (
  assignment_id   uuid,
  shift_id        uuid,
  shift_title     text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  volunteer_name  text,
  email           text,
  phone           text,
  checked_in_at   timestamptz,
  contact_locked  boolean,
  minor           boolean,
  signed_up_by    text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  ev_id       uuid;
  show_pii    boolean;
begin
  select event_id into ev_id from stations where id = p_station_id;
  if ev_id is null then
    raise exception 'Station not found' using errcode = 'P0001';
  end if;

  if public.can_manage_volunteers(ev_id) then
    show_pii := true;
  elsif public.leads_station(p_station_id) then
    show_pii := public.is_event_day(ev_id);
  else
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    select va.id, s.id, s.title, s.starts_at, s.ends_at, v.full_name,
           case when show_pii then v.email::text end,
           case when show_pii then v.phone end,
           va.checked_in_at,
           not show_pii,
           v.minor,
           c.full_name
      from shifts s
      join volunteer_assignments va on va.shift_id = s.id
      join volunteers v on v.id = va.volunteer_id
      left join volunteers c on c.id = v.contact_id
     where s.station_id = p_station_id
     order by s.starts_at, v.full_name;
end;
$$;
revoke execute on function public.station_roster(uuid) from public, anon;
grant execute on function public.station_roster(uuid) to authenticated;
