-- =============================================================================
-- School visitor events: parents register ahead (each child's name, teacher's
-- last name and grade), are reminded to bring a government-issued photo ID,
-- and are checked off at the door by the team.
--
-- Privacy: this is the one place FieldCommand holds students' names. They're
--   * visible only to the event's hosts and team (never browsers otherwise),
--   * hidden 30 days after the event ends, and erased by a daily clean-up
--     (purge_parent_registrations, called by the app's daily job).
-- =============================================================================

alter type public.event_type add value if not exists 'school_visit';

alter table public.events add column parent_registration_open boolean not null default true;

create table public.parent_registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  parent_name    text not null check (length(parent_name) between 2 and 200),
  email          citext not null,
  phone          text,
  -- [{ "name": "Ava Lopez", "teacher": "Smith", "grade": "3rd" }, …]
  children       jsonb not null check (jsonb_typeof(children) = 'array' and jsonb_array_length(children) between 1 and 8),
  -- Secret link in the confirmation email (view or cancel). Never readable by browsers.
  access_token   uuid not null default gen_random_uuid() unique,
  checked_in_at  timestamptz,
  checked_in_by  uuid references public.profiles (id) on delete set null,
  reminded_at    timestamptz,
  -- The calendar invite's version: re-registering sends an update (higher number).
  calendar_sequence integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (event_id, email)
);
create index on public.parent_registrations (event_id);

-- Hosts and the event's team (Volunteer Leads, Section Leads) work the door.
create function public.can_check_in_parents(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_staff(ev);
$$;

-- Children's details are kept for 30 days after the event ends.
create function public.parent_data_kept(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from events where id = ev and ends_on >= current_date - 30);
$$;

alter table public.parent_registrations enable row level security;
revoke all on public.parent_registrations from anon, authenticated;
grant select (id, event_id, parent_name, email, phone, children, checked_in_at, checked_in_by, reminded_at, created_at)
  on public.parent_registrations to authenticated;
create policy "parent registrations: team reads" on public.parent_registrations
  for select to authenticated
  using (public.can_check_in_parents(event_id) and public.parent_data_kept(event_id));

-- Public registration (called by the server). Registering again with the same
-- email updates the earlier registration. Returns its secret link token.
create function public.register_parents(p_event uuid, p_name text, p_email text, p_phone text, p_children jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev    events;
  kid   jsonb;
  token uuid;
begin
  select * into ev from events where id = p_event;
  if not found or ev.event_type::text <> 'school_visit' or ev.status <> 'published' or not ev.parent_registration_open
     or (now() at time zone ev.timezone)::date > ev.ends_on then
    raise exception 'Registration for this event is closed.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) not between 1 and 8 then
    raise exception 'Add between 1 and 8 children.' using errcode = 'P0001';
  end if;
  for kid in select * from jsonb_array_elements(p_children) loop
    if length(trim(coalesce(kid ->> 'name', ''))) not between 1 and 120
       or length(trim(coalesce(kid ->> 'teacher', ''))) not between 1 and 80
       or length(trim(coalesce(kid ->> 'grade', ''))) not between 1 and 20 then
      raise exception 'Please fill in each child''s name, teacher and grade.' using errcode = 'P0001';
    end if;
  end loop;

  insert into parent_registrations (event_id, parent_name, email, phone, children)
  values (p_event, trim(p_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''),
          (select jsonb_agg(jsonb_build_object('name', trim(k ->> 'name'), 'teacher', trim(k ->> 'teacher'), 'grade', trim(k ->> 'grade')))
             from jsonb_array_elements(p_children) k))
  on conflict (event_id, email) do update
    set parent_name = excluded.parent_name, phone = excluded.phone, children = excluded.children,
        calendar_sequence = parent_registrations.calendar_sequence + 1
  returning access_token into token;
  return token;
end;
$$;

-- The parent's own link: cancel. Returns the event's id, or null if the link is unknown.
create function public.cancel_parent_registration(p_token uuid)
returns uuid
language sql security definer set search_path = public
as $$
  delete from parent_registrations where access_token = p_token returning event_id;
$$;

-- The door: check a parent in (after looking at their ID), or undo it.
create function public.set_parent_checked_in(p_id uuid, p_in boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev uuid;
begin
  select event_id into ev from parent_registrations where id = p_id;
  if ev is null or not public.can_check_in_parents(ev) or not public.parent_data_kept(ev) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update parent_registrations
     set checked_in_at = case when p_in then coalesce(checked_in_at, now()) end,
         checked_in_by = case when p_in then coalesce(checked_in_by, auth.uid()) end
   where id = p_id;
end;
$$;

-- Erase registrations 30 days after their event ended. Returns how many.
create function public.purge_parent_registrations()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from parent_registrations r using events e
     where e.id = r.event_id and e.ends_on < current_date - 30
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.can_check_in_parents(uuid), public.parent_data_kept(uuid),
                           public.register_parents(uuid, text, text, text, jsonb),
                           public.cancel_parent_registration(uuid), public.set_parent_checked_in(uuid, boolean),
                           public.purge_parent_registrations()
  from public, anon, authenticated;
grant execute on function public.can_check_in_parents(uuid), public.parent_data_kept(uuid),
                          public.set_parent_checked_in(uuid, boolean)
  to authenticated;
grant execute on function public.register_parents(uuid, text, text, text, jsonb),
                          public.cancel_parent_registration(uuid), public.purge_parent_registrations()
  to service_role;

-- Event types, now three: bands only on band contests; a school visitor event
-- keeps its type once parents have registered.
create or replace function public.events_type_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.event_type::text = 'band_contest' and new.event_type::text <> 'band_contest' then
    if exists (select 1 from bands where event_id = new.id) then
      raise exception 'Bands have registered for this event, so it has to stay a band contest.' using errcode = 'P0001';
    end if;
    -- The band check-in path doesn't apply: those become ordinary stations.
    update stations set checkpoint_kind = null, checkpoint_order = null, due_minutes_before_warm_up = null
     where event_id = new.id and checkpoint_kind is not null;
    new.band_registration_open := false;
  end if;
  if old.event_type::text = 'school_visit' and new.event_type::text <> 'school_visit'
     and exists (select 1 from parent_registrations where event_id = new.id) then
    raise exception 'Parents have registered for this event, so it has to stay a school visitor event.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.bands_need_band_contest()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type::text from events where id = new.event_id) <> 'band_contest' then
    raise exception 'This event doesn''t take band registrations.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.checkpoints_need_band_contest()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.checkpoint_kind is not null and (select event_type::text from events where id = new.event_id) <> 'band_contest' then
    raise exception 'Band check-in stations are only for band contests.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
