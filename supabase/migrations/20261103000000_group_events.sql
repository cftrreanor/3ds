-- =============================================================================
-- Group events: a fourth kind of event. Groups register like bands (same
-- table, same form, no trucks), and the day runs through several rooms at
-- one address: e.g. Warm-up Room → Main Stage → Sight-reading (Black Box).
--
--   * rooms: the event's rooms. A room is a name plus an optional note
--     ("Room 112, east hallway"); never an address. Rooms with a
--     path_order make up the path every group follows, each taking
--     `minutes`; other rooms (hospitality, etc.) are just listed.
--   * group_order: the order groups start the path, rooms a group skips,
--     and any extra break before a group (lunch).
--   * room_slots: each group's time in each room, worked out by
--     save_room_schedule() from the start time, minutes between groups and
--     passing time between rooms. Public once the schedule is posted.
-- =============================================================================

alter type public.event_type add value if not exists 'group_event';

-- How the room schedule is laid out (group events).
alter table public.events
  add column room_schedule_start   timestamptz,
  add column room_interval_minutes integer not null default 20 check (room_interval_minutes between 5 and 240),
  add column room_passing_minutes  integer not null default 5 check (room_passing_minutes between 0 and 60);

-- Groups register like bands. (event_type is compared as text so this file
-- can add the new value and use it in one go.)
create or replace function public.band_registration_is_open(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e
     where e.id = ev
       and e.event_type::text in ('band_contest', 'group_event')
       and e.status = 'published'
       and e.band_registration_open
       and (e.band_registration_deadline is null
            or (now() at time zone e.timezone)::date <= e.band_registration_deadline)
  );
$$;

create or replace function public.bands_need_band_contest()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type::text from events where id = new.event_id) not in ('band_contest', 'group_event') then
    raise exception 'This event doesn''t take band or group registrations.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Switching type: an event with registered bands or groups keeps its type.
create or replace function public.events_type_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.event_type::text in ('band_contest', 'group_event') and new.event_type::text <> old.event_type::text
     and exists (select 1 from bands where event_id = new.id) then
    raise exception 'Groups have registered for this event, so it has to stay a %.',
      case old.event_type::text when 'group_event' then 'group event' else 'band contest' end
      using errcode = 'P0001';
  end if;
  if old.event_type::text = 'band_contest' and new.event_type::text <> 'band_contest' then
    -- The band check-in path doesn't apply: those become ordinary stations.
    update stations set checkpoint_kind = null, checkpoint_order = null, due_minutes_before_warm_up = null
     where event_id = new.id and checkpoint_kind is not null;
  end if;
  if new.event_type::text not in ('band_contest', 'group_event') then
    new.band_registration_open := false;
  end if;
  if old.event_type::text = 'school_visit' and new.event_type::text <> 'school_visit'
     and exists (select 1 from parent_registrations where event_id = new.id) then
    raise exception 'Parents have registered for this event, so it has to stay a school visitor event.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rooms
-- -----------------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  note        text check (note is null or length(note) <= 200),
  -- Position on every group's path (1 = first stop); null = not on the path.
  path_order  integer check (path_order is null or path_order between 1 and 20),
  minutes     integer not null default 20 check (minutes between 5 and 240),
  created_at  timestamptz not null default now(),
  unique (event_id, path_order) deferrable initially deferred
);
create index on public.rooms (event_id);

-- The order groups go through the path.
create table public.group_order (
  band_id               uuid primary key references public.bands (id) on delete cascade,
  event_id              uuid not null references public.events (id) on delete cascade,
  position              integer not null check (position > 0),
  -- Rooms on the path this group doesn't visit.
  skipped_room_ids      uuid[] not null default '{}',
  -- A break before this group starts (pushes it and everyone after it later).
  extra_minutes_before  integer not null default 0 check (extra_minutes_before between 0 and 600),
  unique (event_id, position) deferrable initially deferred
);
create index on public.group_order (event_id);

-- Each group's time in each room it visits.
create table public.room_slots (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  band_id    uuid not null references public.bands (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  primary key (room_id, band_id)
);
create index on public.room_slots (event_id, starts_at);
create index on public.room_slots (band_id);

alter table public.rooms enable row level security;
alter table public.group_order enable row level security;
alter table public.room_slots enable row level security;
revoke all on public.rooms, public.group_order, public.room_slots from anon, authenticated;

-- Room names are public once the event is; the team always sees them.
grant select on public.rooms to anon, authenticated;
create policy "rooms: public read" on public.rooms
  for select to anon, authenticated
  using (exists (select 1 from events e where e.id = event_id and e.status = 'published'));
create policy "rooms: team read" on public.rooms
  for select to authenticated using (public.is_event_staff(event_id));
-- Hosts write through save_rooms(); nothing else writes.

-- The order is the hosts' working copy.
grant select on public.group_order to authenticated;
create policy "group order: hosts read" on public.group_order
  for select to authenticated using (public.is_event_admin(event_id));

-- Times: hosts and the team always; a director sees their own group's once
-- posted. (Everyone else reads the posted schedule through public_room_schedule().)
grant select on public.room_slots to authenticated;
create policy "room slots: team read" on public.room_slots
  for select to authenticated using (public.is_event_staff(event_id));
create policy "room slots: director reads own when posted" on public.room_slots
  for select to authenticated
  using (exists (select 1 from bands b join events e on e.id = b.event_id
                  where b.id = band_id and b.director_user_id = auth.uid()
                    and e.status = 'published' and e.performance_order_published));

-- -----------------------------------------------------------------------------
-- Work out every group's times from the order and the rooms.
-- -----------------------------------------------------------------------------
create function public.rebuild_room_slots(p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev       events;
  ch       record;
  rm       record;
  base     timestamptz;
  breaks   integer := 0;
  offset_m integer;
begin
  select * into ev from events where id = p_event;
  delete from room_slots where event_id = p_event;
  if ev.room_schedule_start is null then
    return;
  end if;
  for ch in select * from group_order where event_id = p_event order by position loop
    breaks := breaks + ch.extra_minutes_before;
    base := ev.room_schedule_start
            + make_interval(mins => (ch.position - 1) * ev.room_interval_minutes + breaks);
    offset_m := 0;
    for rm in select * from rooms where event_id = p_event and path_order is not null order by path_order loop
      -- A skipped room keeps its place in time, so rooms never double-book.
      if not (rm.id = any (ch.skipped_room_ids)) then
        insert into room_slots (room_id, band_id, event_id, starts_at, ends_at)
        values (rm.id, ch.band_id, p_event,
                base + make_interval(mins => offset_m),
                base + make_interval(mins => offset_m + rm.minutes));
      end if;
      offset_m := offset_m + rm.minutes + ev.room_passing_minutes;
    end loop;
  end loop;
  update events set schedule_updated_at = now() where id = p_event and performance_order_published;
end;
$$;

-- Rooms: the whole list at once. p_rooms: [{id?, name, note, on_path, minutes}, …]
-- in the order they should appear; rooms on the path are numbered in that order.
create function public.save_rooms(p_event uuid, p_rooms jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r      jsonb;
  keep   uuid[] := '{}';
  rid    uuid;
  stop   integer := 0;
begin
  if not public.is_event_admin(p_event) then
    raise exception 'Only the event''s host can change rooms.' using errcode = '42501';
  end if;
  if (select event_type::text from events where id = p_event) <> 'group_event' then
    raise exception 'Rooms are for group events.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) > 30 then
    raise exception 'Up to 30 rooms.' using errcode = 'P0001';
  end if;
  for r in select * from jsonb_array_elements(p_rooms) loop
    if length(trim(coalesce(r ->> 'name', ''))) not between 1 and 80 then
      raise exception 'Every room needs a name.' using errcode = 'P0001';
    end if;
    if coalesce((r ->> 'on_path')::boolean, false) then
      stop := stop + 1;
    end if;
    rid := nullif(r ->> 'id', '')::uuid;
    if rid is not null and exists (select 1 from rooms where id = rid and event_id = p_event) then
      update rooms
         set name = trim(r ->> 'name'),
             note = nullif(trim(coalesce(r ->> 'note', '')), ''),
             path_order = case when coalesce((r ->> 'on_path')::boolean, false) then stop end,
             minutes = coalesce((r ->> 'minutes')::integer, 20)
       where id = rid;
    else
      insert into rooms (event_id, name, note, path_order, minutes)
      values (p_event, trim(r ->> 'name'), nullif(trim(coalesce(r ->> 'note', '')), ''),
              case when coalesce((r ->> 'on_path')::boolean, false) then stop end,
              coalesce((r ->> 'minutes')::integer, 20))
      returning id into rid;
    end if;
    keep := keep || rid;
  end loop;
  delete from rooms where event_id = p_event and not (id = any (keep));
  perform public.rebuild_room_slots(p_event);
end;
$$;

-- The schedule: start time, spacing, and the groups in order.
-- p_order: [{band_id, skipped_room_ids: [...], extra_minutes_before}, …]
create function public.save_room_schedule(p_event uuid, p_start timestamptz, p_interval integer, p_passing integer, p_order jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  o    jsonb;
  pos  integer := 0;
begin
  if not public.is_event_admin(p_event) then
    raise exception 'Only the event''s host can change the schedule.' using errcode = '42501';
  end if;
  if (select event_type::text from events where id = p_event) <> 'group_event' then
    raise exception 'Room schedules are for group events.' using errcode = 'P0001';
  end if;
  update events
     set room_schedule_start = p_start, room_interval_minutes = p_interval, room_passing_minutes = p_passing
   where id = p_event;
  delete from group_order where event_id = p_event;
  for o in select * from jsonb_array_elements(coalesce(p_order, '[]')) loop
    if not exists (select 1 from bands where id = (o ->> 'band_id')::uuid and event_id = p_event) then
      raise exception 'That group isn''t registered for this event.' using errcode = 'P0001';
    end if;
    pos := pos + 1;
    insert into group_order (band_id, event_id, position, skipped_room_ids, extra_minutes_before)
    values ((o ->> 'band_id')::uuid, p_event, pos,
            coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(o -> 'skipped_room_ids') x), '{}'),
            coalesce((o ->> 'extra_minutes_before')::integer, 0));
  end loop;
  perform public.rebuild_room_slots(p_event);
end;
$$;

-- The posted schedule, for the public page and the team.
create function public.public_room_schedule(p_slug text)
returns table (
  room_id      uuid,
  room_name    text,
  room_note    text,
  path_order   integer,
  starts_at    timestamptz,
  ends_at      timestamptz,
  school_name  text,
  band_name    text,
  classification text
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.name, r.note, r.path_order, s.starts_at, s.ends_at, b.school_name, b.band_name, b.classification
    from events e
    join room_slots s on s.event_id = e.id
    join rooms r on r.id = s.room_id
    join bands b on b.id = s.band_id
   where e.slug = p_slug and e.status = 'published' and e.performance_order_published
   order by s.starts_at, r.path_order;
$$;

revoke execute on function public.rebuild_room_slots(uuid) from public, anon, authenticated;
revoke execute on function public.save_rooms(uuid, jsonb), public.save_room_schedule(uuid, timestamptz, integer, integer, jsonb)
  from public, anon;
grant execute on function public.save_rooms(uuid, jsonb), public.save_room_schedule(uuid, timestamptz, integer, integer, jsonb)
  to authenticated;
grant execute on function public.public_room_schedule(text) to anon, authenticated;
