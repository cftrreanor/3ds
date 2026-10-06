-- =============================================================================
-- Adults-only stations (like Parking): no one under 18 can sign up for, or
-- be added as a walk-up to, their shifts.
-- =============================================================================

alter table public.stations add column adults_only boolean not null default false;
grant insert (adults_only), update (adults_only) on public.stations to authenticated;

-- Same as before, plus the adults-only check for each person.
create or replace function public.book_group(p_event_id uuid, p_people uuid[], p_shift_ids uuid[], p_check_in boolean, p_over_capacity boolean)
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
      if exists (select 1 from stations st, volunteers v
                  where st.id = sh.station_id and st.adults_only and v.id = person and v.minor) then
        select case when v.contact_id is null then 'You' else v.full_name end into who from volunteers v where v.id = person;
        raise exception '"%" is for adults only (18+). % can''t sign up for it.', sh.title, who using errcode = 'P0005';
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
