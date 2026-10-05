-- =============================================================================
-- Contest day: where every band is, tapped in by the Section Leads of the
-- stations that handle each step.
--
--   Parking   buses here · equipment here (gets the next free spot) ·
--             away (keeps the spot) · back · left for the day (frees it)
--   Check-in  checked in
--   Warm-up   warming up · sent to the gate        (prelims and finals apart)
--   Gate      on the field · done                  (prelims and finals apart)
--   Hosts and Volunteer Leads can do all of these, and scratch a band.
--
-- Every tap is logged (who and when) and the latest one per band can be
-- undone. Team members can leave notes on a band.
-- This replaces the single bands.status and set_band_status().
-- =============================================================================

-- Which steps a station handles. A station with any is a band checkpoint.
create type public.checkpoint_duty as enum ('parking', 'check_in', 'warm_up', 'gate');
alter table public.stations add column duties public.checkpoint_duty[] not null default '{}';
-- Existing checkpoints could move bands through every step; keep that.
update public.stations set duties = '{parking,check_in,warm_up,gate}' where station_type = 'active_checkpoint';
grant insert (duties), update (duties) on public.stations to authenticated;

-- How many equipment spots the lot has (optional; for "12 of 20 used").
alter table public.events add column equipment_spots int check (equipment_spots between 1 and 500);

-- Where each band is. Written only through band_action() / undo_band_action().
create type public.round_step as enum ('warming_up', 'at_gate', 'on_field', 'performed');
alter table public.bands
  add column buses_at        timestamptz,
  add column equipment_at    timestamptz,
  add column equipment_spot  int check (equipment_spot > 0),
  add column away_at         timestamptz,
  add column left_at         timestamptz,
  add column checked_in_at   timestamptz,
  add column scratched_at    timestamptz,
  add column prelims_step    public.round_step,
  add column finals_step     public.round_step;
create unique index bands_one_band_per_spot on public.bands (event_id, equipment_spot) where equipment_spot is not null;

-- The old single status goes (it never had a screen).
drop function public.set_band_status(uuid, public.band_status);
drop function public.event_bands(uuid);
drop function public.public_schedule(text);
alter table public.bands drop column status, drop column status_updated_at;
drop type public.band_status;

create function public.public_schedule(p_slug text)
returns table (
  performance_order int,
  perform_at        timestamptz,
  school_name       text,
  band_name         text,
  classification    text
)
language sql stable security definer set search_path = public
as $$
  select ps.performance_order, ps.perform_at, b.school_name, b.band_name, b.classification
    from events e
    join performance_slots ps on ps.event_id = e.id
    join bands b on b.id = ps.band_id
   where e.slug = p_slug
     and e.status = 'published'
     and e.performance_order_published
   order by ps.performance_order;
$$;
revoke execute on function public.public_schedule(text) from public;
grant execute on function public.public_schedule(text) to anon, authenticated;

-- Activity log and notes -----------------------------------------------------
create table public.band_activity (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references public.events (id) on delete cascade,
  band_id     uuid not null references public.bands (id) on delete cascade,
  action      text not null,
  round       text check (round in ('prelims', 'finals')),
  detail      text,
  -- The band's contest-day fields before this tap, for undo.
  before      jsonb not null,
  created_by  uuid references public.profiles (id) on delete set null,
  -- Shown on the contest-day screens ("Spot 4 · Lee, 9:05").
  actor_name  text,
  created_at  timestamptz not null default now(),
  undone_at   timestamptz,
  undone_by   uuid references public.profiles (id) on delete set null
);
create index on public.band_activity (band_id, id desc);
create index on public.band_activity (event_id, created_at desc);
alter table public.band_activity enable row level security;
create policy "band activity: team reads" on public.band_activity
  for select to authenticated using (public.is_event_staff(event_id));
revoke insert, update, delete on public.band_activity from anon, authenticated;

create table public.band_notes (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  band_id     uuid not null references public.bands (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 500),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_name text,
  created_at  timestamptz not null default now()
);
create index on public.band_notes (band_id, created_at desc);
alter table public.band_notes enable row level security;
create policy "band notes: team reads" on public.band_notes
  for select to authenticated using (public.is_event_staff(event_id));
create policy "band notes: team writes" on public.band_notes
  for insert to authenticated with check (created_by = auth.uid() and public.is_event_staff(event_id));
create policy "band notes: author or manager deletes" on public.band_notes
  for delete to authenticated using (created_by = auth.uid() or public.can_manage_volunteers(event_id));
revoke insert, update, delete on public.band_notes from anon, authenticated;
grant insert (band_id, event_id, body) on public.band_notes to authenticated;
grant delete on public.band_notes to authenticated;

-- A note's event always matches its band's, and it carries its author's name.
create function public.band_notes_set_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select event_id into new.event_id from bands where id = new.band_id;
  if new.event_id is null then
    raise exception 'Band not found' using errcode = 'P0001';
  end if;
  new.author_name := public.my_display_name();
  return new;
end;
$$;
create trigger band_notes_set_event before insert on public.band_notes
  for each row execute function public.band_notes_set_event();

-- The signed-in person's name for notes and the activity log.
create function public.my_display_name()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(nullif(trim(full_name), ''), email::text) from profiles where id = auth.uid();
$$;

-- Who may tap what -------------------------------------------------------------
create function public.has_band_duty(ev uuid, d public.checkpoint_duty)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_manage_volunteers(ev) or exists (
    select 1 from station_leads sl join stations s on s.id = sl.station_id
     where sl.event_id = ev and sl.user_id = auth.uid() and d = any (s.duties)
  );
$$;

create function public.band_day_snapshot(b public.bands)
returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'buses_at', b.buses_at, 'equipment_at', b.equipment_at, 'equipment_spot', b.equipment_spot,
    'away_at', b.away_at, 'left_at', b.left_at, 'checked_in_at', b.checked_in_at,
    'scratched_at', b.scratched_at, 'prelims_step', b.prelims_step, 'finals_step', b.finals_step);
$$;

-- One tap. Repeating a tap that's already done changes nothing.
create function public.band_action(p_band_id uuid, p_action text, p_round text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b       bands;
  duty    checkpoint_duty;
  step    round_step;
  spot    int;
  detail  text;
  snap    jsonb;
begin
  select * into b from bands where id = p_band_id;
  if b.id is null then
    raise exception 'Band not found' using errcode = 'P0001';
  end if;

  duty := case
    when p_action in ('buses_here', 'equipment_here', 'away', 'back', 'left') then 'parking'
    when p_action = 'checked_in' then 'check_in'
    when p_action in ('warming_up', 'at_gate') then 'warm_up'
    when p_action in ('on_field', 'performed') then 'gate'
  end;
  if duty is null and p_action not in ('scratched', 'unscratched') then
    raise exception 'Unknown action' using errcode = 'P0001';
  end if;
  if (duty is null and not public.can_manage_volunteers(b.event_id))
     or (duty is not null and not public.has_band_duty(b.event_id, duty)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_action in ('warming_up', 'at_gate', 'on_field', 'performed') then
    if p_round is null or p_round not in ('prelims', 'finals') then
      raise exception 'Prelims or finals?' using errcode = 'P0001';
    end if;
    step := p_action::round_step;
  else
    p_round := null;
  end if;

  -- One tap at a time per event, so two leads never get the same spot.
  perform 1 from events where id = b.event_id for update;
  select * into b from bands where id = p_band_id for update;
  snap := public.band_day_snapshot(b);

  case p_action
    when 'buses_here' then
      if b.buses_at is not null then return; end if;
      update bands set buses_at = now() where id = b.id;
    when 'equipment_here' then
      if b.equipment_at is not null then return; end if;
      select min(n) into spot
        from generate_series(1, (select count(*)::int + 1 from bands where event_id = b.event_id)) n
       where not exists (select 1 from bands o where o.event_id = b.event_id and o.equipment_spot = n);
      update bands set equipment_at = now(), equipment_spot = spot, left_at = null where id = b.id;
      detail := 'Spot ' || spot;
    when 'away' then
      if b.away_at is not null or b.left_at is not null then return; end if;
      update bands set away_at = now() where id = b.id;
    when 'back' then
      if b.away_at is null then return; end if;
      update bands set away_at = null where id = b.id;
    when 'left' then
      if b.left_at is not null then return; end if;
      update bands set left_at = now(), away_at = null, equipment_spot = null where id = b.id;
      detail := case when b.equipment_spot is not null then 'Spot ' || b.equipment_spot || ' is free' end;
    when 'checked_in' then
      if b.checked_in_at is not null then return; end if;
      update bands set checked_in_at = now() where id = b.id;
    when 'scratched' then
      if b.scratched_at is not null then return; end if;
      update bands set scratched_at = now() where id = b.id;
    when 'unscratched' then
      if b.scratched_at is null then return; end if;
      update bands set scratched_at = null where id = b.id;
    else
      if p_round = 'prelims' then
        if b.prelims_step is not distinct from step then return; end if;
        update bands set prelims_step = step where id = b.id;
      else
        if b.finals_step is not distinct from step then return; end if;
        update bands set finals_step = step where id = b.id;
      end if;
  end case;

  insert into band_activity (event_id, band_id, action, round, detail, before, created_by, actor_name)
  values (b.event_id, b.id, p_action, p_round, detail, snap, auth.uid(), public.my_display_name());
end;
$$;

-- Undo the band's latest tap: by the person who made it, or a host / Volunteer Lead.
create function public.undo_band_action(p_band_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b      bands;
  a      band_activity;
  s      jsonb;
  spot   int;
  holder text;
begin
  select * into b from bands where id = p_band_id;
  if b.id is null then
    raise exception 'Band not found' using errcode = 'P0001';
  end if;
  perform 1 from events where id = b.event_id for update;
  select * into a from band_activity
   where band_id = p_band_id and undone_at is null order by id desc limit 1 for update;
  if a.id is null then
    raise exception 'Nothing to undo' using errcode = 'P0001';
  end if;
  if not (a.created_by = auth.uid() or public.can_manage_volunteers(b.event_id)) then
    raise exception 'Only the person who tapped this, or a host or Volunteer Lead, can undo it' using errcode = '42501';
  end if;

  s := a.before;
  spot := (s ->> 'equipment_spot')::int;
  if spot is not null then
    select band_name into holder from bands
     where event_id = b.event_id and equipment_spot = spot and id <> b.id;
    if holder is not null then
      raise exception 'Can''t undo: spot % has since gone to %.', spot, holder using errcode = 'P0001';
    end if;
  end if;

  update bands set
    buses_at       = (s ->> 'buses_at')::timestamptz,
    equipment_at   = (s ->> 'equipment_at')::timestamptz,
    equipment_spot = spot,
    away_at        = (s ->> 'away_at')::timestamptz,
    left_at        = (s ->> 'left_at')::timestamptz,
    checked_in_at  = (s ->> 'checked_in_at')::timestamptz,
    scratched_at   = (s ->> 'scratched_at')::timestamptz,
    prelims_step   = (s ->> 'prelims_step')::round_step,
    finals_step    = (s ->> 'finals_step')::round_step
   where id = b.id;
  update band_activity set undone_at = now(), undone_by = auth.uid() where id = a.id;
end;
$$;

-- What the team sees about each band ------------------------------------------
-- No contact details. Headcounts for hosts and Volunteer Leads; vehicles and
-- the director's scheduling conflicts for the whole team (parking and
-- check-in need them); accessibility needs for hosts only.
create function public.event_bands(ev uuid)
returns table (
  id                     uuid,
  band_name              text,
  school_name            text,
  classification         text,
  student_count          int,
  chaperone_count        int,
  bus_count              int,
  box_truck_count        int,
  truck_trailer_count    int,
  semi_truck_count       int,
  contest_day_conflicts  text,
  special_needs          text,
  buses_at               timestamptz,
  equipment_at           timestamptz,
  equipment_spot         int,
  away_at                timestamptz,
  left_at                timestamptz,
  checked_in_at          timestamptz,
  scratched_at           timestamptz,
  prelims_step           public.round_step,
  finals_step            public.round_step
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select public.is_event_staff(ev) as staff, public.can_manage_volunteers(ev) as manager,
           public.is_event_admin(ev) as host
  )
  select b.id, b.band_name, b.school_name, b.classification,
         case when me.manager then b.student_count end,
         case when me.manager then b.chaperone_count end,
         b.bus_count, b.box_truck_count, b.truck_trailer_count, b.semi_truck_count,
         b.contest_day_conflicts,
         case when me.host then b.special_needs end,
         b.buses_at, b.equipment_at, b.equipment_spot, b.away_at, b.left_at,
         b.checked_in_at, b.scratched_at, b.prelims_step, b.finals_step
    from bands b, me
   where b.event_id = ev and me.staff
   order by b.band_name;
$$;

revoke execute on function public.event_bands(uuid), public.band_action(uuid, text, text),
                           public.undo_band_action(uuid), public.has_band_duty(uuid, public.checkpoint_duty),
                           public.band_day_snapshot(public.bands), public.band_notes_set_event(),
                           public.my_display_name()
  from public, anon;
grant execute on function public.event_bands(uuid), public.band_action(uuid, text, text),
                          public.undo_band_action(uuid), public.has_band_duty(uuid, public.checkpoint_duty)
  to authenticated;
revoke execute on function public.band_notes_set_event(), public.my_display_name(), public.band_day_snapshot(public.bands)
  from authenticated;
