-- Finals can have their own ready position (minutes before performing),
-- separate from the preliminaries.
alter table public.events
  add column finals_ready_minutes_before int not null default 5
    check (finals_ready_minutes_before between 0 and 60);

-- Same as save_schedule, plus the finals ready position. The older version
-- stays so the app keeps working until this update is deployed.
create or replace function public.save_schedule(
  p_event_id uuid, p_ready_minutes int, p_finals_ready_minutes int, p_slots jsonb, p_breaks jsonb, p_finals jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'Only the event''s host can set the schedule' using errcode = '42501';
  end if;
  update events set finals_ready_minutes_before = p_finals_ready_minutes where id = p_event_id;
  perform public.save_schedule(p_event_id, p_ready_minutes, p_slots, p_breaks, p_finals);
end;
$$;

revoke execute on function public.save_schedule(uuid, int, int, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_schedule(uuid, int, int, jsonb, jsonb, jsonb) to authenticated;
