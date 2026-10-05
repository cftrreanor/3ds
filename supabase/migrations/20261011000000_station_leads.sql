-- =============================================================================
-- More than one Section Lead per station (a backup if someone is sick or can't
-- be there all day). station_leads is the list; stations.lead_user_id is kept
-- as the station's first lead, filled in automatically, so the volunteer-facing
-- "your lead" contact keeps working.
-- =============================================================================

create table public.station_leads (
  station_id  uuid not null references public.stations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (station_id, user_id)
);
create index on public.station_leads (user_id);
create index on public.station_leads (event_id);

-- Everyone already leading a station keeps doing so.
insert into public.station_leads (station_id, user_id, event_id)
select id, lead_user_id, event_id from public.stations where lead_user_id is not null;

-- A lead must be on the event's team (or be one of the hosts); event_id
-- always comes from the station.
create or replace function public.station_leads_validate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select event_id into new.event_id from stations where id = new.station_id;
  if not exists (select 1 from event_staff where event_id = new.event_id and user_id = new.user_id)
     and not exists (
       select 1 from events e join organization_members m on m.organization_id = e.organization_id
        where e.id = new.event_id and m.user_id = new.user_id
     ) then
    raise exception 'Only people on this event''s team can lead a station' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger station_leads_validate
  before insert or update on public.station_leads
  for each row execute function public.station_leads_validate();

-- Keep stations.lead_user_id = the station's first lead.
create or replace function public.station_leads_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  st uuid := coalesce(new.station_id, old.station_id);
begin
  update stations
     set lead_user_id = (select user_id from station_leads where station_id = st order by created_at, user_id limit 1)
   where id = st;
  return null;
end;
$$;
create trigger station_leads_sync
  after insert or update or delete on public.station_leads
  for each row execute function public.station_leads_sync();

alter table public.station_leads enable row level security;
create policy "station leads: team read" on public.station_leads
  for select to authenticated using (public.is_event_staff(event_id));
create policy "station leads: managers write" on public.station_leads
  for all to authenticated
  using (public.can_manage_volunteers(event_id)) with check (public.can_manage_volunteers(event_id));
revoke all on public.station_leads from anon;

-- The lead column is now derived: nobody sets it directly. (A column-level
-- revoke does nothing under a table-wide grant, so grant the other columns.)
revoke insert, update on public.stations from anon, authenticated;
grant insert (id, event_id, name, station_type, location, instructions, sort_order) on public.stations to authenticated;
grant update (name, station_type, location, instructions, sort_order) on public.stations to authenticated;

-- Every lead of a station gets the lead's access (roster, contest-day contacts).
create or replace function public.leads_station(st uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from station_leads where station_id = st and user_id = auth.uid());
$$;

-- Any lead of an active checkpoint can move bands along.
create or replace function public.set_band_status(p_band_id uuid, p_status public.band_status)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev_id uuid;
begin
  select event_id into ev_id from bands where id = p_band_id;
  if ev_id is null then
    raise exception 'Band not found' using errcode = 'P0001';
  end if;
  if not (
    public.can_manage_volunteers(ev_id)
    or exists (select 1 from station_leads sl join stations s on s.id = sl.station_id
                where sl.event_id = ev_id and sl.user_id = auth.uid() and s.station_type = 'active_checkpoint')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update bands set status = p_status, status_updated_at = now() where id = p_band_id;
end;
$$;

-- Accepting a Section Lead invitation adds them to the station's leads
-- (alongside anyone already leading it).
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  inv invitations;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first' using errcode = '42501';
  end if;
  select * into inv from invitations where token = p_token for update;
  if inv.id is null then
    raise exception 'This invitation link isn''t valid' using errcode = 'P0001';
  end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = auth.uid() then
      return inv.event_id;
    end if;
    raise exception 'This invitation has already been used' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask for a new one.' using errcode = 'P0001';
  end if;
  if inv.email <> public.current_email() then
    raise exception 'This invitation was sent to %. Sign in with that email to accept it.', inv.email
      using errcode = 'P0001';
  end if;

  insert into event_staff (event_id, user_id, role)
  values (inv.event_id, auth.uid(), inv.role)
  on conflict do nothing;

  if inv.station_id is not null then
    insert into station_leads (station_id, user_id, event_id)
    values (inv.station_id, auth.uid(), inv.event_id)
    on conflict do nothing;
  end if;

  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.event_id;
end;
$$;

-- Removing someone from the team also takes them off every station they lead.
create or replace function public.event_staff_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from event_staff where event_id = old.event_id and user_id = old.user_id) then
    delete from station_leads where event_id = old.event_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;

revoke execute on function public.station_leads_validate(), public.station_leads_sync() from public, anon, authenticated;
