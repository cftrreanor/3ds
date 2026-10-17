-- "Saved by": who last saved each part of an event, and when, so hosts,
-- co-hosts, and Volunteer Leads working on the same event can see what
-- someone else already did. Only the latest save per part is kept (no
-- history). Recorded by triggers, so every way of saving counts, and only
-- for people who manage the event: a director registering a band, a
-- volunteer signing up, or a background job never shows as a save.

create table public.event_saves (
  event_id uuid not null references public.events (id) on delete cascade,
  area     text not null,
  saved_by uuid references public.profiles (id) on delete set null,
  saved_at timestamptz not null default now(),
  primary key (event_id, area)
);
alter table public.event_saves enable row level security;
-- No policies: read through event_saves(ev) below, written by the triggers.

create or replace function public.record_event_save(ev uuid, part text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if ev is null or auth.uid() is null or not public.can_manage_volunteers(ev) then
    return;
  end if;
  -- Deleting an event removes its rows too; nothing to note then.
  if not exists (select 1 from events where id = ev) then
    return;
  end if;
  insert into event_saves (event_id, area, saved_by, saved_at)
  values (ev, part, auth.uid(), now())
  on conflict (event_id, area) do update set saved_by = excluded.saved_by, saved_at = excluded.saved_at;
exception when foreign_key_violation then
  null;
end;
$$;
revoke all on function public.record_event_save(uuid, text) from public, anon, authenticated;

-- One trigger for every table with an event_id. Arguments: the part of the
-- event, then a comma list of columns whose changes aren't edits (day-of
-- check-ins, email send times, counters). 'skip_self' as a third argument
-- ignores rows about the person themselves (joining a team isn't editing it).
create or replace function public.note_event_save()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ignored text[] := string_to_array(coalesce(nullif(tg_argv[1], ''), ''), ',');
  r record;
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'DELETE' then
    r := old;
  else
    r := new;
  end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - ignored) = (to_jsonb(old) - ignored) then
    return null;
  end if;
  if tg_argv[2] = 'skip_self' and (to_jsonb(r) ->> 'user_id')::uuid = auth.uid() then
    return null;
  end if;
  perform public.record_event_save((to_jsonb(r) ->> 'event_id')::uuid, tg_argv[0]);
  return null;
end;
$$;

-- The event itself: each changed setting counts toward its part of the page.
create or replace function public.note_event_settings_save()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  part text;
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.record_event_save(new.id, 'details');
    return null;
  end if;
  for part in
    select distinct case
             when n.key = 'status' then 'publish'
             when n.key = 'volunteer_signup_open' then 'volunteers'
             when n.key in ('band_registration_open', 'band_registration_deadline', 'director_info',
                            'chaperone_limit', 'classifications') then 'bands'
             when n.key in ('performance_order_published', 'finals_published', 'finalists_revealed',
                            'ready_minutes_before', 'finals_ready_minutes_before', 'room_schedule_start',
                            'room_interval_minutes', 'room_passing_minutes') then 'schedule'
             when n.key in ('parent_registration_open', 'parent_registration_closes_at',
                            'parent_walk_ins_allowed') then 'parents'
             else 'details'
           end
      from jsonb_each(to_jsonb(new)) n
     where n.key not in ('id', 'organization_id', 'created_at', 'created_by', 'schedule_updated_at')
       and n.value is distinct from (to_jsonb(old) -> n.key)
  loop
    perform public.record_event_save(new.id, part);
  end loop;
  return null;
end;
$$;

revoke all on function public.note_event_save() from public, anon, authenticated;
revoke all on function public.note_event_settings_save() from public, anon, authenticated;

create trigger events_note_save after insert or update on public.events
  for each row execute function public.note_event_settings_save();

create trigger stations_note_save after insert or update or delete on public.stations
  for each row execute function public.note_event_save('volunteers', '');
create trigger shifts_note_save after insert or update or delete on public.shifts
  for each row execute function public.note_event_save('volunteers', 'registered_count');
create trigger station_leads_note_save after insert or update or delete on public.station_leads
  for each row execute function public.note_event_save('volunteers', '');
create trigger volunteers_note_save after insert or update or delete on public.volunteers
  for each row execute function public.note_event_save('volunteers', 'access_token,link_sent_at');

create trigger bands_note_save after insert or update or delete on public.bands
  for each row execute function public.note_event_save('bands',
    'updated_at,buses_at,equipment_at,equipment_spot,away_at,left_at,details_removed_at');
create trigger band_invitations_note_save after insert or update or delete on public.band_invitations
  for each row execute function public.note_event_save('bands', 'sent_at,used_at');
create trigger band_prefills_note_save after insert or update or delete on public.band_prefills
  for each row execute function public.note_event_save('bands', '');

create trigger performance_slots_note_save after insert or update or delete on public.performance_slots
  for each row execute function public.note_event_save('schedule', '');
create trigger finals_slots_note_save after insert or update or delete on public.finals_slots
  for each row execute function public.note_event_save('schedule', '');
create trigger schedule_breaks_note_save after insert or update or delete on public.schedule_breaks
  for each row execute function public.note_event_save('schedule', '');
create trigger group_order_note_save after insert or update or delete on public.group_order
  for each row execute function public.note_event_save('schedule', '');
create trigger rooms_note_save after insert or update or delete on public.rooms
  for each row execute function public.note_event_save('schedule', '');
create trigger room_slots_note_save after insert or update or delete on public.room_slots
  for each row execute function public.note_event_save('schedule', '');

create trigger event_staff_note_save after insert or update or delete on public.event_staff
  for each row execute function public.note_event_save('team', '', 'skip_self');
create trigger invitations_note_save after insert or update or delete on public.invitations
  for each row execute function public.note_event_save('team', 'accepted_at,accepted_by,email_token,sent_at');

create trigger event_files_note_save after insert or update or delete on public.event_files
  for each row execute function public.note_event_save('files', '');
create trigger fair_booths_note_save after insert or update or delete on public.fair_booths
  for each row execute function public.note_event_save('booths', 'arrived_at,arrived_by');
create trigger fair_zones_note_save after insert or update or delete on public.fair_zones
  for each row execute function public.note_event_save('booths', '');
create trigger conference_settings_note_save after insert or update or delete on public.conference_settings
  for each row execute function public.note_event_save('conference', 'updated_at');
create trigger announcements_note_save after insert or update or delete on public.announcements
  for each row execute function public.note_event_save('announcements', '');
create trigger parent_registrations_note_save after insert or update or delete on public.parent_registrations
  for each row execute function public.note_event_save('parents',
    'access_token,checked_in_at,checked_in_by,reminded_at,calendar_sequence,link_emailed_at');

-- What the event's hosts and Volunteer Leads see: each part's last save,
-- with the person's name and role, and how many people manage the event
-- (the lines only show when someone else could have saved).
create or replace function public.event_saves(ev uuid)
returns table (area text, saved_at timestamptz, name text, role text, is_you boolean, managers integer)
language sql stable security definer set search_path = public
as $$
  with mgrs as (
    select m.user_id, case m.role when 'owner' then 'Host' else 'Co-host' end as role
      from events e join organization_members m on m.organization_id = e.organization_id
     where e.id = ev
    union
    select s.user_id, 'Volunteer Lead'
      from event_staff s
     where s.event_id = ev and s.role = 'volunteer_director'
       and not exists (select 1 from events e join organization_members m on m.organization_id = e.organization_id
                        where e.id = ev and m.user_id = s.user_id)
  )
  select s.area, s.saved_at, nullif(trim(p.full_name), ''), g.role,
         s.saved_by is not distinct from auth.uid(),
         (select count(*)::int from mgrs)
    from event_saves s
    left join profiles p on p.id = s.saved_by
    left join mgrs g on g.user_id = s.saved_by
   where s.event_id = ev and public.can_manage_volunteers(ev);
$$;
revoke all on function public.event_saves(uuid) from public, anon;
grant execute on function public.event_saves(uuid) to authenticated;
