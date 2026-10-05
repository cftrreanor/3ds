-- Warm-up length per band, in 15-minute steps. The warm-up end time and the
-- ready position (5 minutes before performing) are calculated from the times.
alter table public.performance_slots
  add column warm_up_minutes int
    check (warm_up_minutes is null or (warm_up_minutes between 15 and 240 and warm_up_minutes % 15 = 0));

create or replace function public.save_performance_order(p_event_id uuid, p_slots jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'Only the event''s host can set the performance order' using errcode = '42501';
  end if;
  delete from performance_slots where event_id = p_event_id;
  insert into performance_slots
    (band_id, event_id, performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location)
  select (s.value ->> 'band_id')::uuid,
         p_event_id,
         s.ordinality::int,
         nullif(s.value ->> 'warm_up_at', '')::timestamptz,
         nullif(s.value ->> 'warm_up_minutes', '')::int,
         nullif(s.value ->> 'perform_at', '')::timestamptz,
         nullif(s.value ->> 'warm_up_location', '')
    from jsonb_array_elements(p_slots) with ordinality as s(value, ordinality);
end;
$$;
