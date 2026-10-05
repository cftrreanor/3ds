-- =============================================================================
-- Schedule breaks and a finals round.
-- =============================================================================

-- Spectators and finalists see the finals once the host publishes them.
alter table public.events add column finals_published boolean not null default false;

-- Breaks in the performance day (lunch, judges' break, awards...). Spectators
-- see them once the order or the finals are published.
create table public.schedule_breaks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  starts_at   timestamptz not null,
  minutes     int not null check (minutes between 5 and 480),
  label       text not null check (length(label) between 1 and 80),
  created_at  timestamptz not null default now()
);
create index on public.schedule_breaks (event_id, starts_at);
alter table public.schedule_breaks enable row level security;

create policy "breaks: read when published" on public.schedule_breaks
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_id and e.status = 'published'
                   and (e.performance_order_published or e.finals_published)));
create policy "breaks: staff read" on public.schedule_breaks
  for select to authenticated using (public.is_event_staff(event_id));
create policy "breaks: hosts write" on public.schedule_breaks
  for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- Finals: numbered slots with times. The band is filled in once finalists are
-- announced; until then the slot is a placeholder ("Finalist 3").
create table public.finals_slots (
  event_id          uuid not null references public.events (id) on delete cascade,
  slot_number       int not null check (slot_number between 1 and 50),
  band_id           uuid references public.bands (id) on delete set null,
  warm_up_at        timestamptz,
  warm_up_minutes   int check (warm_up_minutes is null or (warm_up_minutes between 15 and 240 and warm_up_minutes % 15 = 0)),
  perform_at        timestamptz,
  warm_up_location  text,
  primary key (event_id, slot_number),
  unique (event_id, band_id)
);
create index on public.finals_slots (band_id);
alter table public.finals_slots enable row level security;

create policy "finals: read when published" on public.finals_slots
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_id and e.status = 'published' and e.finals_published));
create policy "finals: staff read" on public.finals_slots
  for select to authenticated using (public.is_event_staff(event_id));
create policy "finals: hosts write" on public.finals_slots
  for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- A finalist must be a band registered for the same event.
create or replace function public.finals_slots_validate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.band_id is not null
     and not exists (select 1 from bands where id = new.band_id and event_id = new.event_id) then
    raise exception 'That band is registered for a different event' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger finals_slots_validate
  before insert or update on public.finals_slots
  for each row execute function public.finals_slots_validate();

-- Save the whole schedule in one go (all or nothing): ready position, running
-- order, breaks and finals. Runs as the caller, so only the host can do it.
--   p_slots:  as save_performance_order
--   p_breaks: [{"starts_at": "...", "minutes": 30, "label": "Lunch"}, ...]
--   p_finals: [{"band_id": "..." | null, "warm_up_at", "warm_up_minutes", "perform_at", "warm_up_location"}, ...]
--             in slot order
create or replace function public.save_schedule(
  p_event_id uuid, p_ready_minutes int, p_slots jsonb, p_breaks jsonb, p_finals jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'Only the event''s host can set the schedule' using errcode = '42501';
  end if;
  update events set ready_minutes_before = p_ready_minutes where id = p_event_id;
  perform public.save_performance_order(p_event_id, p_slots);

  delete from schedule_breaks where event_id = p_event_id;
  insert into schedule_breaks (event_id, starts_at, minutes, label)
  select p_event_id, (b ->> 'starts_at')::timestamptz, (b ->> 'minutes')::int, b ->> 'label'
    from jsonb_array_elements(p_breaks) as b;

  delete from finals_slots where event_id = p_event_id;
  insert into finals_slots (event_id, slot_number, band_id, warm_up_at, warm_up_minutes, perform_at, warm_up_location)
  select p_event_id,
         s.ordinality::int,
         nullif(s.value ->> 'band_id', '')::uuid,
         nullif(s.value ->> 'warm_up_at', '')::timestamptz,
         nullif(s.value ->> 'warm_up_minutes', '')::int,
         nullif(s.value ->> 'perform_at', '')::timestamptz,
         nullif(s.value ->> 'warm_up_location', '')
    from jsonb_array_elements(p_finals) with ordinality as s(value, ordinality);
end;
$$;

-- Public views: only what spectators should see, and only once published.
create or replace function public.public_breaks(p_slug text)
returns table (starts_at timestamptz, minutes int, label text)
language sql stable security definer set search_path = public
as $$
  select b.starts_at, b.minutes, b.label
    from events e
    join schedule_breaks b on b.event_id = e.id
   where e.slug = p_slug
     and e.status = 'published'
     and (e.performance_order_published or e.finals_published)
   order by b.starts_at;
$$;

create or replace function public.public_finals(p_slug text)
returns table (
  slot_number     int,
  perform_at      timestamptz,
  school_name     text,
  band_name       text,
  classification  text
)
language sql stable security definer set search_path = public
as $$
  select f.slot_number, f.perform_at, b.school_name, b.band_name, b.classification
    from events e
    join finals_slots f on f.event_id = e.id
    left join bands b on b.id = f.band_id
   where e.slug = p_slug
     and e.status = 'published'
     and e.finals_published
   order by f.slot_number;
$$;

revoke execute on function public.save_schedule(uuid, int, jsonb, jsonb, jsonb),
                           public.finals_slots_validate(),
                           public.public_breaks(text),
                           public.public_finals(text)
  from public, anon;
grant execute on function public.save_schedule(uuid, int, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.public_breaks(text), public.public_finals(text) to anon, authenticated;
