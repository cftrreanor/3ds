-- Volunteer jobs that are showing or hidden (the volunteer setup redesign,
-- docs/design-decisions/2026-10-30-setup-redesign-mockup-v2.md).
--
--   * stations.showing: volunteers see a job, its shifts, and its things to bring
--     only while it's showing. Every job made before this update is showing, and
--     new jobs are showing unless the app makes them hidden.
--   * A hidden job can be previewed by the event's hosts (Hosts and Co-hosts),
--     its Volunteer Leads, and that job's own Coordinator. Other Coordinators
--     don't see it.
--   * Nobody signs up for a hidden job: not through the public page, an import, a
--     walk-up, a swap, or by moving a shift with sign-ups into it. To add people,
--     show the job first (owner decision, 2026-10-30).
--   * A job can't be hidden while anyone is signed up for it, and a shift or a
--     thing to bring can't be deleted while anyone is signed up for it. (Deleting
--     a whole job with sign-ups is refused the same way.) Row locks keep a
--     sign-up and a hide from crossing.
--   * A volunteer event needs at least one showing job with a shift or a thing to
--     bring before it's published (or switched to a volunteer event while live), and
--     its last one can't be hidden, deleted, or emptied while it's live.
--   * Demo mode cleans up its sample jobs past these checks, and only signs its demo
--     volunteer up for a showing job.

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
-- walk-up, demo) inserts one of these rows. The job's row is share-locked, so it
-- can't be hidden while the sign-up is being saved.
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
  -- Only a direct database session (like the SQL Editor) can. The app's roles can't,
  -- the server's included (the public sign-up page goes through it). The role
  -- setting stays the caller's inside security-definer functions.
  if st.id is not null and not st.showing and current_setting('role', true) in ('authenticated', 'anon', 'service_role') then
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
revoke execute on function public.event_has_showing_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.event_has_showing_job(uuid, uuid) to service_role;

create trigger stations_hide_check
  before update of showing on public.stations
  for each row execute function public.stations_hide_check();

-- 5. Deleting, and moving shifts -------------------------------------------------------------
-- A shift or thing to bring with people signed up stays (so does its job), and a
-- live volunteer event keeps at least one showing job with a shift or a thing to
-- bring. When the whole event is being deleted, everything goes; demo mode's
-- clean-up (demo_leave) is let through too.
create function public.cleaning_up()
returns boolean
language sql stable set search_path = public
as $$
  select coalesce(current_setting('app.cleaning_up', true), '') = 'on';
$$;

/** Raises when removing p_station (or emptying it) would leave a live volunteer event with no showing job. */
create function public.keep_a_showing_job(p_event uuid, p_except_station uuid, p_except_shift uuid default null, p_except_item uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev events;
begin
  select * into ev from events where id = p_event for update;
  if ev.status <> 'published' or ev.event_type::text <> 'volunteer' then
    return;
  end if;
  if not exists (
    select 1 from stations s
     where s.event_id = p_event and s.showing and s.id is distinct from p_except_station
       and (exists (select 1 from shifts sh where sh.station_id = s.id and sh.id is distinct from p_except_shift)
            or exists (select 1 from station_items i where i.station_id = s.id and i.id is distinct from p_except_item))
  ) then
    raise exception 'Volunteers need at least one job they can sign up for while the event is published. Add another job first, or unpublish.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.keep_a_showing_job(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create function public.signups_block_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.cleaning_up() or not exists (select 1 from events where id = old.event_id) then
    return old;
  end if;
  if tg_table_name = 'shifts' then
    if exists (select 1 from volunteer_assignments where shift_id = old.id) then
      raise exception 'Volunteers have signed up for this shift, so it can''t be deleted. Move or remove them first.' using errcode = 'P0001';
    end if;
    perform public.keep_a_showing_job(old.event_id, null, old.id);
  elsif tg_table_name = 'station_items' then
    if exists (select 1 from item_signups where item_id = old.id) then
      raise exception 'People have signed up to bring this, so it can''t be deleted. Lower how many are needed instead.' using errcode = 'P0001';
    end if;
    perform public.keep_a_showing_job(old.event_id, null, null, old.id);
  elsif old.showing then
    -- A whole job (its shifts and things to bring are checked as they go).
    perform public.keep_a_showing_job(old.event_id, old.id);
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
create trigger stations_keep_a_showing_job
  before delete on public.stations
  for each row execute function public.signups_block_delete();

-- Moving a shift to another job: not with sign-ups into a hidden job, and not
-- taking the last shift from a live event's last showing job.
create function public.shifts_move_check()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.station_id is distinct from old.station_id then
    if exists (select 1 from stations where id = new.station_id and not showing for share)
       and exists (select 1 from volunteer_assignments where shift_id = new.id) then
      raise exception 'Volunteers have signed up for this shift, so it can''t move to a hidden job. Show that job first.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from stations where id = new.station_id and showing) then
      perform public.keep_a_showing_job(old.event_id, null, old.id);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.shifts_move_check() from public, anon, authenticated;
create trigger shifts_move_check
  before update of station_id on public.shifts
  for each row execute function public.shifts_move_check();

-- 6. Publishing a volunteer event needs a job volunteers can see ------------------------------
-- For people publishing from the app (signed in or not), like events_publish_needs_plan;
-- the server and direct database sessions aren't held to it. (The role setting
-- stays the caller's inside this security-definer function.)
create function public.events_publish_needs_job()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('role', true) in ('authenticated', 'anon')
     and new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published' or old.event_type is distinct from new.event_type)
     and new.event_type::text = 'volunteer' and not public.event_has_showing_job(new.id) then
    raise exception 'Show at least one volunteer job with a shift or a thing to bring before publishing.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.events_publish_needs_job() from public, anon, authenticated;
create trigger events_publish_volunteer_job
  before insert or update of status, event_type on public.events
  for each row execute function public.events_publish_needs_job();

-- 7. Demo mode ------------------------------------------------------------------------------------
-- demo_leave removes sample jobs past the checks above; demo_join signs its demo
-- volunteer up for a showing job only.
do $$
declare
  src text := pg_get_functiondef('public.demo_leave(uuid, uuid)'::regprocedure);
  fixed text;
begin
  fixed := replace(src, $q$  select organization_id into org from events where id = p_event;$q$,
                        $q$  select organization_id into org from events where id = p_event;
  -- Sample jobs go whole, sign-ups and all (see signups_block_delete).
  perform set_config('app.cleaning_up', 'on', true);$q$);
  if fixed = src then raise exception 'demo_leave has changed; update this migration'; end if;
  execute fixed;
  src := pg_get_functiondef('public.demo_join(uuid, uuid, uuid)'::regprocedure);
  fixed := replace(src, $q$select * into sh from shifts where event_id = p_event$q$,
                        $q$select * into sh from shifts where event_id = p_event
         and station_id in (select id from stations where event_id = p_event and showing)$q$);
  if fixed = src then raise exception 'demo_join has changed; update this migration'; end if;
  execute fixed;
end $$;
