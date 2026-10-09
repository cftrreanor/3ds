-- =============================================================================
-- Group events on the day: the team taps each group in.
--   * "Arrived": the group got to the building (room_id is null).
--   * "Done" per room on the path: the group finished that room.
-- Anyone on the event's team (hosts, Volunteer Leads, Section Leads) can tap
-- any group and take a tap back. Marking a room done also marks the group
-- arrived. The team reads every group's taps; a director reads their own
-- group's.
-- =============================================================================

create table public.group_checkins (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  band_id     uuid not null references public.bands (id) on delete cascade,
  room_id     uuid references public.rooms (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  -- Shown on the Event day page ("✓ 9:05 · Lee").
  actor_name  text,
  unique nulls not distinct (band_id, room_id)
);
create index on public.group_checkins (event_id);
alter table public.group_checkins enable row level security;
create policy "group checkins: team reads" on public.group_checkins
  for select to authenticated using (public.is_event_staff(event_id));
create policy "group checkins: director reads own" on public.group_checkins
  for select to authenticated
  using (exists (select 1 from bands b where b.id = band_id and b.director_user_id = auth.uid()));
-- Written only through group_checkin().
revoke all on public.group_checkins from anon;
revoke insert, update, delete on public.group_checkins from authenticated;

-- p_room null = "Arrived". p_done false takes the tap back.
create function public.group_checkin(p_band uuid, p_room uuid, p_done boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev   uuid;
  kind text;
begin
  select b.event_id, e.event_type::text into ev, kind
    from bands b join events e on e.id = b.event_id
   where b.id = p_band;
  if ev is null then
    raise exception 'That group isn''t registered for this event.' using errcode = 'P0001';
  end if;
  if not public.is_event_staff(ev) then
    raise exception 'Only the event''s team can check groups in.' using errcode = '42501';
  end if;
  if kind is distinct from 'group_event' then
    raise exception 'Group check-in is for group events.' using errcode = 'P0001';
  end if;
  if p_room is not null and not exists (
    select 1 from rooms where id = p_room and event_id = ev and path_order is not null
  ) then
    raise exception 'That room isn''t on this event''s path.' using errcode = 'P0001';
  end if;

  if p_done then
    insert into group_checkins (event_id, band_id, room_id, created_by, actor_name)
    select ev, p_band, r, auth.uid(), public.my_display_name()
      from (select p_room as r union select null where p_room is not null) x
    on conflict do nothing;
  else
    delete from group_checkins where band_id = p_band and room_id is not distinct from p_room;
  end if;
end;
$$;
revoke execute on function public.group_checkin(uuid, uuid, boolean) from public, anon;
grant execute on function public.group_checkin(uuid, uuid, boolean) to authenticated;
