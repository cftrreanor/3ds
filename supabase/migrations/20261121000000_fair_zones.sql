-- =============================================================================
-- Fair zones you create first: Booths & Partners now starts with "1. Zones"
-- (Game Zone, Marketplace...), and booths are then added into them.
--
--   * fair_zones: a fair's zones, in the order they were made. Booths and
--     stations still carry their zone by name, so nothing else changes.
--   * rename_fair_zone / delete_fair_zone: rename or remove a zone and carry
--     its booths and stations along (deleting leaves them with no zone).
--   * Zones already used by booths or stations are copied in.
--
-- The host and Volunteer Leads manage zones, like booths; the event team reads.
-- =============================================================================

create table public.fair_zones (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);
create index on public.fair_zones (event_id, created_at);

alter table public.fair_zones enable row level security;
revoke all on public.fair_zones from anon, authenticated;
grant select, delete on public.fair_zones to authenticated;
grant insert (event_id, name) on public.fair_zones to authenticated;

create policy "zones: event team reads" on public.fair_zones
  for select to authenticated using (public.is_event_staff(event_id) or public.is_event_admin(event_id));
create policy "zones: managers add" on public.fair_zones
  for insert to authenticated with check (public.can_manage_volunteers(event_id));
create policy "zones: managers remove" on public.fair_zones
  for delete to authenticated using (public.can_manage_volunteers(event_id));

-- Zones only belong to fairs (same check as booths).
create trigger fair_zones_need_fair
  before insert on public.fair_zones
  for each row execute function public.fair_booths_need_fair();

-- Rename a zone, and move its booths and stations with it.
create function public.rename_fair_zone(p_event uuid, p_old text, p_new text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  nm text := trim(coalesce(p_new, ''));
begin
  if not public.can_manage_volunteers(p_event) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(nm) not between 1 and 60 then
    raise exception 'Give the zone a name (60 characters at most).' using errcode = 'P0001';
  end if;
  if nm = p_old then
    return;
  end if;
  -- Renaming onto a zone that already exists merges the two.
  if exists (select 1 from fair_zones where event_id = p_event and name = nm) then
    delete from fair_zones where event_id = p_event and name = p_old;
  elsif exists (select 1 from fair_zones where event_id = p_event and name = p_old) then
    update fair_zones set name = nm where event_id = p_event and name = p_old;
  else
    insert into fair_zones (event_id, name) values (p_event, nm);
  end if;
  update fair_booths set zone = nm where event_id = p_event and zone = p_old;
  update stations set zone = nm where event_id = p_event and zone = p_old;
end;
$$;
revoke execute on function public.rename_fair_zone(uuid, text, text) from public, anon;
grant execute on function public.rename_fair_zone(uuid, text, text) to authenticated;

-- Remove a zone; its booths and stations stay, with no zone.
create function public.delete_fair_zone(p_event uuid, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_manage_volunteers(p_event) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from fair_zones where event_id = p_event and name = p_name;
  update fair_booths set zone = null where event_id = p_event and zone = p_name;
  update stations set zone = null where event_id = p_event and zone = p_name;
end;
$$;
revoke execute on function public.delete_fair_zone(uuid, text) from public, anon;
grant execute on function public.delete_fair_zone(uuid, text) to authenticated;

-- Copy in the zones fairs already use.
insert into public.fair_zones (event_id, name)
select distinct z.event_id, z.zone
  from (
    select event_id, zone from public.fair_booths where zone is not null
    union
    select s.event_id, s.zone from public.stations s join public.events e on e.id = s.event_id
     where s.zone is not null and e.event_type::text = 'fair'
  ) z
on conflict (event_id, name) do nothing;
