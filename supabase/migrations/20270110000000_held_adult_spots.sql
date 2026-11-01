-- =============================================================================
-- Spots held for adults.
--   * stations.min_adults: how many volunteers on each of the job's shifts must
--     be 18 or older (adults supervising teens at concessions). Blank: any mix.
--   * Those spots are held: an under-18 can't take a spot a shift still needs
--     for its adults. A 6-spot shift needing 2 adults takes at most 4 under-18s
--     until its adults sign up. Checked when signing up (book_group) and when
--     switching shifts with a volunteer's own link. An organizer adding someone
--     over capacity (walk-ups, imports) isn't held back.
--   * shift_adult_needs(): how many adults each shift of an event still needs,
--     for the sign-up page (counts only, no names) and the organizer's screens.
-- =============================================================================

alter table public.stations
  add column min_adults smallint check (min_adults between 1 and 50);
grant insert (min_adults), update (min_adults) on public.stations to authenticated;

-- How many more adults a shift needs (0 when it has enough, or its job holds no spots).
create function public.adults_still_needed(p_shift_id uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select case
           when st.min_adults is null or st.adults_only or s.adults_only then 0
           else greatest(0, st.min_adults - (
             select count(*) from volunteer_assignments a join volunteers v on v.id = a.volunteer_id
              where a.shift_id = s.id and not v.minor))::int
         end
    from shifts s join stations st on st.id = s.station_id
   where s.id = p_shift_id;
$$;
revoke execute on function public.adults_still_needed(uuid) from public, anon, authenticated;
grant execute on function public.adults_still_needed(uuid) to service_role;

-- Each shift's adults still needed, for a published event's sign-up page or its own team.
create function public.shift_adult_needs(p_event_id uuid)
returns table (shift_id uuid, adults_needed int)
language sql stable security definer set search_path = public
as $$
  select s.id, public.adults_still_needed(s.id)
    from shifts s join stations st on st.id = s.station_id
   where s.event_id = p_event_id
     and st.min_adults is not null
     and exists (select 1 from events e where e.id = p_event_id
                  and (e.status = 'published' or public.can_manage_volunteers(e.id)));
$$;
revoke execute on function public.shift_adult_needs(uuid) from public;
grant execute on function public.shift_adult_needs(uuid) to anon, authenticated, service_role;

-- Same as before, and an under-18 can't take a spot held for adults. Adults in a group are
-- placed first, so a parent and teen signing up together for the last spots both fit.
create or replace function public.book_group(p_event_id uuid, p_people uuid[], p_shift_ids uuid[], p_check_in boolean, p_over_capacity boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sh       public.shifts;
  person   uuid;
  needed   int;
  who      text;
  why      text;
  is_minor boolean;
  taken    int;
  ordered  uuid[];
begin
  select coalesce(array_agg(v.id order by v.minor, array_position(p_people, v.id)), '{}') into ordered
    from volunteers v where v.id = any (p_people);
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
    foreach person in array ordered loop
      continue when exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = person);
      select public.shift_ineligible(sh.id, v.minor, v.age), case when v.contact_id is null then 'You' else v.full_name end, v.minor
        into why, who, is_minor
        from volunteers v where v.id = person;
      if why = 'Adults only' then
        raise exception '"%" is for adults only (18+). % can''t sign up for it.', sh.title, who using errcode = 'P0005';
      elsif why is not null then
        raise exception '"%" is for ages % and up. % can''t sign up for it.', sh.title, sh.min_age, who using errcode = 'P0005';
      end if;
      -- Spots held for adults: an under-18 needs an open spot beyond the adults the shift still needs.
      if is_minor and not p_over_capacity then
        select count(*) into taken from volunteer_assignments where shift_id = sh.id;
        if sh.max_capacity - taken <= public.adults_still_needed(sh.id) then
          raise exception 'The spots left in "%" are for adults (18+). % can''t sign up for it.', sh.title, who using errcode = 'P0005';
        end if;
      end if;
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

-- Switching shifts with your own link: the same held spots.
create or replace function public.swap_shift_with_pass(
  p_assignment_id uuid, p_new_shift_id uuid, p_volunteer_tokens uuid[], p_assignment_tokens uuid[]
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a       record;
  ev      public.events;
  sh      public.shifts;
  why     text;
begin
  select va.id, va.shift_id, va.volunteer_id, v.full_name, v.minor, v.age, s.event_id into a
    from volunteer_assignments va
    join volunteers v on v.id = va.volunteer_id
    join shifts s on s.id = va.shift_id
   where va.id = p_assignment_id
     and (v.access_token = any (coalesce(p_volunteer_tokens, '{}'))
          or va.manage_token = any (coalesce(p_assignment_tokens, '{}')));
  if a.id is null then
    return false;
  end if;
  if a.shift_id = p_new_shift_id then
    return true;
  end if;
  select * into ev from events where id = a.event_id;
  if ev.status <> 'published' or not ev.volunteer_signup_open then
    raise exception 'Volunteer signup is closed, so shifts can''t be switched. Contact the organizers.' using errcode = 'P0001';
  end if;

  -- Lock both shifts in a fixed order, like book_group.
  perform 1 from shifts where id in (a.shift_id, p_new_shift_id) order by id for update;
  select * into sh from shifts where id = p_new_shift_id and event_id = a.event_id;
  if sh.id is null then
    raise exception 'That shift isn''t part of this event.' using errcode = 'P0001';
  end if;
  if exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = a.volunteer_id) then
    raise exception 'You''re already signed up for "%".', sh.title using errcode = 'P0001';
  end if;
  if sh.registered_count >= sh.max_capacity then
    raise exception 'Sorry, "%" just filled up. Please pick another shift.', sh.title using errcode = 'P0002';
  end if;
  why := public.shift_ineligible(sh.id, a.minor, a.age);
  if why is not null then
    raise exception '"%" is %.', sh.title, lower(why) using errcode = 'P0005';
  end if;
  if a.minor and sh.max_capacity - sh.registered_count <= public.adults_still_needed(sh.id) then
    raise exception 'The spots left in "%" are for adults (18+).', sh.title using errcode = 'P0005';
  end if;
  if exists (
    select 1 from volunteer_assignments x
    join shifts s2 on s2.id = x.shift_id
    where x.volunteer_id = a.volunteer_id and x.id <> a.id
      and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(sh.starts_at, sh.ends_at)
  ) then
    raise exception '"%" overlaps with another shift you signed up for.', sh.title using errcode = 'P0003';
  end if;

  update volunteer_assignments set shift_id = sh.id, checked_in_at = null, checked_in_by = null where id = a.id;
  update shifts set registered_count = registered_count - 1 where id = a.shift_id;
  update shifts set registered_count = registered_count + 1 where id = sh.id;
  insert into volunteer_changes (event_id, volunteer_id, full_name, from_shift_id, to_shift_id)
  values (a.event_id, a.volunteer_id, a.full_name, a.shift_id, sh.id);
  return true;
end;
$$;
