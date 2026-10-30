-- Volunteer jobs that are showing or hidden (the volunteer setup redesign,
-- docs/design-decisions/2026-10-30-setup-redesign-mockup-v2.md).
--
--   * stations.showing: volunteers see a job, its shifts, and its things to bring
--     only while it's showing. Every job made before this update is showing, and
--     new jobs are showing unless the app makes them hidden.
--   * A hidden job can be previewed by the event's hosts (Hosts and Co-hosts),
--     its Volunteer Leads, and that job's own Coordinator. Other Coordinators
--     don't see it.
--   * Nobody signs up for a hidden job, through the public page or the server.
--     (Hosts and Volunteer Leads can still add people, as they can see it; so can
--     its Coordinator at the check-in desk.)
--   * A job can't be hidden while anyone is signed up for it, and a shift or a
--     thing to bring can't be deleted while anyone is signed up for it. (Deleting
--     a whole job with sign-ups is refused the same way.) Row locks keep a
--     sign-up and a hide from crossing.
--   * A volunteer event needs at least one showing job with a shift or a thing to
--     bring before it's published, and its last one can't be hidden while it's live.

-- 1. The setting ----------------------------------------------------------------------
alter table public.stations add column showing boolean not null default true;
grant insert (showing), update (showing) on public.stations to authenticated;

-- Who can see a hidden job: the event's managers and that job's own Coordinator.
create function public.can_preview_station(p_station uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from stations s
     where s.id = p_station
       and (public.can_manage_volunteers(s.event_id) or public.leads_station(s.id))
  );
$$;
revoke execute on function public.can_preview_station(uuid) from public, anon;
grant execute on function public.can_preview_station(uuid) to authenticated, service_role;

-- 2. Who reads what -----------------------------------------------------------------------
drop policy "stations: public read" on public.stations;
create policy "stations: public read" on public.stations
  for select to anon, authenticated
  using (showing and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
drop policy "stations: staff read" on public.stations;
create policy "stations: staff read" on public.stations
  for select to authenticated
  using (public.is_event_staff(event_id) and (showing or public.can_manage_volunteers(event_id) or public.leads_station(id)));

drop policy "shifts: public read" on public.shifts;
create policy "shifts: public read" on public.shifts
  for select to anon, authenticated
  using (exists (select 1 from public.events e join public.stations s on s.event_id = e.id
                  where e.id = event_id and s.id = station_id and e.status = 'published' and s.showing));
drop policy "shifts: staff read" on public.shifts;
create policy "shifts: staff read" on public.shifts
  for select to authenticated
  using (public.is_event_staff(event_id)
         and (public.can_manage_volunteers(event_id) or public.leads_station(station_id)
              or exists (select 1 from public.stations s where s.id = station_id and s.showing)));

drop policy "station items: public read" on public.station_items;
create policy "station items: public read" on public.station_items
  for select to anon, authenticated
  using (exists (select 1 from public.events e join public.stations s on s.event_id = e.id
                  where e.id = event_id and s.id = station_id and e.status = 'published' and s.showing));
drop policy "station items: staff read" on public.station_items;
create policy "station items: staff read" on public.station_items
  for select to authenticated
  using (public.is_event_staff(event_id)
         and (public.can_manage_volunteers(event_id) or public.leads_station(station_id)
              or exists (select 1 from public.stations s where s.id = station_id and s.showing)));

-- 3. No sign-ups for a hidden job ------------------------------------------------------------
-- Every way onto a shift or a thing to bring (sign-up, group sign-up, swap, import,
-- walk-up) inserts one of these rows. The job's row is share-locked, so it can't
-- be hidden while the sign-up is being saved.
create function public.signup_needs_showing_job()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  st stations;
begin
  if tg_table_name = 'volunteer_assignments' then
    select s.* into st from stations s join shifts sh on sh.station_id = s.id where sh.id = new.shift_id for share of s;
  else
    select s.* into st from stations s join station_items i on i.station_id = s.id where i.id = new.item_id for share of s;
  end if;
  if st.id is not null and not st.showing
     -- The sign-up functions run as their owner, so ask who's signed in. The public
     -- sign-up page calls them through the server, so the server isn't trusted here:
     -- only someone who can preview the job (or a direct database session) adds people.
     and not (auth.jwt() is null or public.can_preview_station(st.id)) then
    raise exception 'That volunteer job isn''t open for sign-up yet.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.signup_needs_showing_job() from public, anon, authenticated;
create trigger volunteer_assignments_need_showing_job
  before insert or update of shift_id on public.volunteer_assignments
  for each row execute function public.signup_needs_showing_job();
create trigger item_signups_need_showing_job
  before insert or update of item_id on public.item_signups
  for each row execute function public.signup_needs_showing_job();

-- 4. Hiding a job ----------------------------------------------------------------------------
create function public.stations_hide_check()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ev events;
begin
  if old.showing and not new.showing then
    if exists (select 1 from volunteer_assignments a join shifts sh on sh.id = a.shift_id where sh.station_id = new.id)
       or exists (select 1 from item_signups i join station_items si on si.id = i.item_id where si.station_id = new.id) then
      raise exception 'People are signed up for this job, so it can''t be hidden. Move or remove them first.' using errcode = 'P0001';
    end if;
    select * into ev from events where id = new.event_id for update;
    if ev.status = 'published' and ev.event_type::text = 'volunteer' and not public.event_has_showing_job(new.event_id, new.id) then
      raise exception 'This is the last job volunteers can see, so it can''t be hidden while the event is published.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.stations_hide_check() from public, anon, authenticated;

/** A showing job with at least one shift or thing to bring (not counting p_except). */
create function public.event_has_showing_job(p_event uuid, p_except uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from stations s
     where s.event_id = p_event and s.showing and s.id is distinct from p_except
       and (exists (select 1 from shifts sh where sh.station_id = s.id)
            or exists (select 1 from station_items i where i.station_id = s.id))
  );
$$;
revoke execute on function public.event_has_showing_job(uuid, uuid) from public, anon;
grant execute on function public.event_has_showing_job(uuid, uuid) to authenticated, service_role;

create trigger stations_hide_check
  before update of showing on public.stations
  for each row execute function public.stations_hide_check();

-- 5. Deleting with sign-ups ---------------------------------------------------------------------
-- A shift or thing to bring with people signed up stays (so does its job). When
-- the whole event is being deleted, everything goes.
create function public.signups_block_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from events where id = old.event_id) then
    return old;
  end if;
  if tg_table_name = 'shifts' and exists (select 1 from volunteer_assignments where shift_id = old.id) then
    raise exception 'Volunteers have signed up for this shift, so it can''t be deleted. Move or remove them first.' using errcode = 'P0001';
  end if;
  if tg_table_name = 'station_items' and exists (select 1 from item_signups where item_id = old.id) then
    raise exception 'People have signed up to bring this, so it can''t be deleted. Lower how many are needed instead.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
revoke execute on function public.signups_block_delete() from public, anon, authenticated;
create trigger shifts_signups_block_delete
  before delete on public.shifts
  for each row execute function public.signups_block_delete();
create trigger station_items_signups_block_delete
  before delete on public.station_items
  for each row execute function public.signups_block_delete();

-- 6. Publishing a volunteer event needs a job volunteers can see ------------------------------
-- Runs as the person publishing (not security definer), like events_publish_needs_plan.
create function public.events_publish_needs_job()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.event_type::text = 'volunteer' and not public.event_has_showing_job(new.id) then
    raise exception 'Show at least one volunteer job with a shift or a thing to bring before publishing.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.events_publish_needs_job() from public, anon, authenticated;
create trigger events_publish_volunteer_job
  before insert or update of status on public.events
  for each row execute function public.events_publish_needs_job();
