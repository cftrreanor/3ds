-- =============================================================================
-- Team invitations, station leads, and editing an event's schedule.
--
-- The host is always allowed to run volunteers themself (can_manage_volunteers
-- includes hosts). A separate Volunteer Director is optional, for larger clubs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
-- An invitation is a link the host (or director) sends. Whoever opens it signs
-- in with the invited email and accepts; only then do they get access.
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  email         citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role          public.event_staff_role not null,
  station_id    uuid references public.stations (id) on delete set null,
  token         uuid not null unique default gen_random_uuid(),
  invited_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days',
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles (id) on delete set null,
  check (station_id is null or role = 'section_lead')
);
create index on public.invitations (event_id);
-- One open invitation per person, role and event.
create unique index invitations_one_open
  on public.invitations (event_id, email, role)
  where accepted_at is null;

alter table public.invitations enable row level security;

create policy "invitations: managers read" on public.invitations
  for select to authenticated using (public.can_manage_volunteers(event_id));
create policy "invitations: hosts invite anyone" on public.invitations
  for insert to authenticated
  with check (invited_by = auth.uid() and public.is_event_admin(event_id));
create policy "invitations: directors invite leads" on public.invitations
  for insert to authenticated
  with check (invited_by = auth.uid() and role = 'section_lead' and public.can_manage_volunteers(event_id));
create policy "invitations: hosts cancel" on public.invitations
  for delete to authenticated using (accepted_at is null and public.is_event_admin(event_id));
create policy "invitations: directors cancel lead invites" on public.invitations
  for delete to authenticated
  using (accepted_at is null and role = 'section_lead' and public.can_manage_volunteers(event_id));
revoke update on public.invitations from anon, authenticated;
revoke insert on public.invitations from anon, authenticated;
grant insert (event_id, email, role, station_id, invited_by) on public.invitations to authenticated;

-- The station must belong to the same event.
create or replace function public.invitations_validate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.station_id is not null
     and not exists (select 1 from stations where id = new.station_id and event_id = new.event_id) then
    raise exception 'That station belongs to a different event' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger invitations_validate
  before insert on public.invitations
  for each row execute function public.invitations_validate();

-- What the invite page shows. Anyone holding the link may see it.
create or replace function public.get_invitation(p_token uuid)
returns table (
  email           text,
  role            public.event_staff_role,
  event_id        uuid,
  event_name      text,
  starts_on       date,
  ends_on         date,
  organization    text,
  station_name    text,
  expired         boolean,
  accepted        boolean
)
language sql stable security definer set search_path = public
as $$
  select i.email::text, i.role, e.id, e.name, e.starts_on, e.ends_on, o.name, s.name,
         i.expires_at < now(), i.accepted_at is not null
    from invitations i
    join events e on e.id = i.event_id
    join organizations o on o.id = e.organization_id
    left join stations s on s.id = i.station_id
   where i.token = p_token;
$$;

-- Accept: the signed-in email must match the invitation.
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
    update stations set lead_user_id = auth.uid() where id = inv.station_id;
  end if;

  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.event_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Station leads and staff removal
-- -----------------------------------------------------------------------------
-- A station's lead must be on the event's team (or be a host).
create or replace function public.stations_validate_lead()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.lead_user_id is not null
     and not exists (select 1 from event_staff where event_id = new.event_id and user_id = new.lead_user_id)
     and not exists (
       select 1 from events e join organization_members m on m.organization_id = e.organization_id
        where e.id = new.event_id and m.user_id = new.lead_user_id
     ) then
    raise exception 'Only people on this event''s team can lead a station' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger stations_validate_lead
  before insert or update of lead_user_id on public.stations
  for each row execute function public.stations_validate_lead();

-- Directors can remove Section Leads (hosts can already remove anyone).
create policy "staff: directors remove section leads" on public.event_staff
  for delete to authenticated
  using (role = 'section_lead' and public.can_manage_volunteers(event_id));

-- Removing a lead from the team also takes them off their stations.
create or replace function public.event_staff_cleanup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from event_staff where event_id = old.event_id and user_id = old.user_id) then
    update stations set lead_user_id = null where event_id = old.event_id and lead_user_id = old.user_id;
  end if;
  return old;
end;
$$;
create trigger event_staff_cleanup
  after delete on public.event_staff
  for each row execute function public.event_staff_cleanup();

-- Hosts and directors can see the names and contact details of their own
-- event's team (not volunteers: those stay behind station_roster()).
create policy "profiles: managers read event staff" on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.event_staff es
     where es.user_id = profiles.id and public.can_manage_volunteers(es.event_id)
  ));

-- -----------------------------------------------------------------------------
-- Editing the schedule
-- -----------------------------------------------------------------------------
-- Change an event's dates, hours or time zone. Existing shifts move with it,
-- keeping their wall-clock times: a 7 AM shift is still 7 AM on the new day.
-- Runs as the caller, so normal permissions apply.
create or replace function public.reschedule_event(
  p_event_id      uuid,
  p_starts_on     date,
  p_ends_on       date,
  p_window_start  timestamptz,
  p_window_end    timestamptz,
  p_timezone      text
)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  old_starts_on date;
  old_tz        text;
  day_shift     int;
begin
  select starts_on, timezone into old_starts_on, old_tz from events where id = p_event_id;
  if old_starts_on is null then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;
  day_shift := p_starts_on - old_starts_on;

  update events
     set starts_on = p_starts_on, ends_on = p_ends_on,
         window_start = p_window_start, window_end = p_window_end, timezone = p_timezone
   where id = p_event_id;
  if not found then
    raise exception 'You don''t have permission to change this event' using errcode = '42501';
  end if;

  if day_shift <> 0 or old_tz <> p_timezone then
    update shifts
       set starts_at = ((starts_at at time zone old_tz) + make_interval(days => day_shift)) at time zone p_timezone,
           ends_at   = ((ends_at   at time zone old_tz) + make_interval(days => day_shift)) at time zone p_timezone
     where event_id = p_event_id;
  end if;
end;
$$;

revoke execute on function public.get_invitation(uuid),
                           public.accept_invitation(uuid),
                           public.reschedule_event(uuid, date, date, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.get_invitation(uuid),
                          public.accept_invitation(uuid),
                          public.reschedule_event(uuid, date, date, timestamptz, timestamptz, text)
  to authenticated;
-- The invite page works before the invitee has signed in.
grant execute on function public.get_invitation(uuid) to anon;
