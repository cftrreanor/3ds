-- =============================================================================
-- Running behind on contest day: push the rest of the schedule back.
--
-- Moves every prelims band from a chosen performance number onward (warm-up
-- and performance times) later by some minutes, along with the breaks after
-- the band before it. Finals move too only if the host asks; otherwise breaks
-- in the finals stay put. All in one step, so it never half-applies.
-- Returns the bands whose times moved, so their directors can be emailed.
-- =============================================================================

create function public.push_schedule_back(p_event_id uuid, p_from_order int, p_minutes int, p_include_finals boolean)
returns table (round text, band_id uuid)
language plpgsql security invoker set search_path = public
as $$
declare
  shift        interval := make_interval(mins => p_minutes);
  prev_at      timestamptz;
  finals_start timestamptz;
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'Only the event''s host can change the schedule' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes not between 1 and 240 then
    raise exception 'Push the schedule back between 1 and 240 minutes.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from performance_slots s where s.event_id = p_event_id and s.performance_order = p_from_order) then
    raise exception 'That performance number isn''t in the schedule.' using errcode = 'P0001';
  end if;

  -- Breaks after the band before the first one moved shift with them.
  select s.perform_at into prev_at
    from performance_slots s where s.event_id = p_event_id and s.performance_order = p_from_order - 1;
  select min(coalesce(f.warm_up_at, f.perform_at)) into finals_start
    from finals_slots f where f.event_id = p_event_id;

  update schedule_breaks b set starts_at = b.starts_at + shift
   where b.event_id = p_event_id
     and (prev_at is null or b.starts_at > prev_at)
     and (p_include_finals or finals_start is null or b.starts_at < finals_start);

  return query
    with moved as (
      update performance_slots s
         set warm_up_at = s.warm_up_at + shift, perform_at = s.perform_at + shift
       where s.event_id = p_event_id and s.performance_order >= p_from_order
         and (s.warm_up_at is not null or s.perform_at is not null)
      returning s.band_id as moved_band
    )
    select 'prelims'::text, m.moved_band from moved m;

  if p_include_finals then
    return query
      with moved as (
        update finals_slots f
           set warm_up_at = f.warm_up_at + shift, perform_at = f.perform_at + shift
         where f.event_id = p_event_id and (f.warm_up_at is not null or f.perform_at is not null)
        returning f.band_id as moved_band
      )
      select 'finals'::text, m.moved_band from moved m;
  end if;
end;
$$;
revoke execute on function public.push_schedule_back(uuid, int, int, boolean) from public, anon;
grant execute on function public.push_schedule_back(uuid, int, int, boolean) to authenticated;
