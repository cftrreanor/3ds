-- =============================================================================
-- Parent-teacher conferences: a free kind of event for teachers. A teacher
-- sets aside one day's block of time, it's cut into meetings, and families
-- book one (booking comes in a later update). Meetings are in person (a room
-- and directions), on video (one Zoom or Meet link with a waiting room for
-- the whole block), or the family's choice.
--
--   * conference_settings: meeting length, a gap between meetings, breaks,
--     where they meet, the video link, and the teacher's tick that the
--     meeting has a waiting room and runs the whole block. Only the event's
--     hosts and team can read it (the video link is never public).
--   * Free: a conference publishes without a paid plan, but an account can
--     have only one published conference at a time. It also needs its
--     meeting place set up first.
--   * A conference is one day, and stays a conference (no switching kinds).
-- =============================================================================

alter type public.event_type add value if not exists 'conference';

create table public.conference_settings (
  event_id                uuid primary key references public.events (id) on delete cascade,
  meeting_minutes         integer not null default 15 check (meeting_minutes in (10, 15, 20, 25, 30, 45, 60)),
  gap_minutes             integer not null default 0 check (gap_minutes between 0 and 30),
  -- [{ "start": "17:00", "minutes": 30, "label": "Dinner" }, …]
  breaks                  jsonb not null default '[]'::jsonb
                            check (jsonb_typeof(breaks) = 'array' and jsonb_array_length(breaks) <= 8),
  -- When step 1 (meeting times) was last saved.
  times_saved_at          timestamptz,
  meeting_mode            text check (meeting_mode in ('in_person', 'video', 'either')),
  room                    text check (room is null or char_length(room) <= 200),
  video_link              text check (video_link is null or (char_length(video_link) <= 500 and video_link ~ '^https://')),
  waiting_room_confirmed  boolean not null default false,
  updated_at              timestamptz not null default now()
);

alter table public.conference_settings enable row level security;
revoke all on public.conference_settings from anon, authenticated;
grant select on public.conference_settings to authenticated;
grant insert (event_id, meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room, video_link, waiting_room_confirmed, updated_at)
  on public.conference_settings to authenticated;
grant update (meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room, video_link, waiting_room_confirmed, updated_at)
  on public.conference_settings to authenticated;

create policy "conference settings: event team reads" on public.conference_settings
  for select to authenticated using (public.is_event_admin(event_id) or public.is_event_staff(event_id));
create policy "conference settings: hosts add" on public.conference_settings
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "conference settings: hosts edit" on public.conference_settings
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- Settings only belong to conferences.
create function public.conference_settings_need_conference()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type::text from events where id = new.event_id) <> 'conference' then
    raise exception 'Meeting times are for parent-teacher conferences.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger conference_settings_need_conference
  before insert on public.conference_settings
  for each row execute function public.conference_settings_need_conference();

-- A conference is one day.
create function public.conferences_are_one_day()
returns trigger
language plpgsql
as $$
begin
  if new.event_type::text = 'conference' and new.ends_on <> new.starts_on then
    raise exception 'Conferences are one day. Pick the same start and end date.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger conferences_are_one_day
  before insert or update of starts_on, ends_on, event_type on public.events
  for each row execute function public.conferences_are_one_day();

-- A conference stays a conference, and nothing else becomes one: they're free,
-- and they have nothing in common with the other kinds.
create function public.conference_type_is_fixed()
returns trigger
language plpgsql
as $$
begin
  if (old.event_type::text = 'conference') <> (new.event_type::text = 'conference') then
    raise exception 'A parent-teacher conference can''t change to another kind of event, or the other way round. Create a new event instead.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger conference_type_is_fixed
  before update of event_type on public.events
  for each row execute function public.conference_type_is_fixed();

-- What's still missing before a conference can be published (null when
-- ready). For the event's hosts.
create function public.conference_not_ready(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when not public.is_event_admin(ev) then 'Only the event''s hosts can publish it.'
    when s.event_id is null or s.times_saved_at is null then 'Save your meeting times first (step 1).'
    when s.meeting_mode is null then 'Choose where you''ll meet first (step 2).'
    when s.meeting_mode in ('in_person', 'either') and coalesce(trim(s.room), '') = '' then 'Add your room and directions first (step 2).'
    when s.meeting_mode in ('video', 'either') and s.video_link is null then 'Add your meeting link first (step 2).'
    when s.meeting_mode in ('video', 'either') and not s.waiting_room_confirmed
      then 'Tick that your meeting has a waiting room and runs the whole time (step 2).'
  end
  from (select ev as id) e
  left join conference_settings s on s.event_id = e.id;
$$;
revoke execute on function public.conference_not_ready(uuid) from public, anon;
grant execute on function public.conference_not_ready(uuid) to authenticated;

-- The account's other published conference, if any (whoever is publishing).
-- Hosts of the event only.
create function public.other_published_conference(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select o.name from events e
    join events o on o.organization_id = e.organization_id
   where e.id = ev and public.is_event_admin(ev)
     and o.event_type::text = 'conference' and o.status = 'published' and o.id <> ev
   limit 1;
$$;
revoke execute on function public.other_published_conference(uuid) from public, anon;
grant execute on function public.other_published_conference(uuid) to authenticated;

-- Publishing: conferences are free (one published at a time per account, set
-- up first); everything else needs an active plan, as before.
create or replace function public.events_publish_needs_plan()
returns trigger
language plpgsql
as $$
declare
  missing_step text;
  other text;
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'published' and old.status is distinct from 'published' then
    if new.event_type::text = 'conference' then
      missing_step := public.conference_not_ready(new.id);
      if missing_step is not null then
        raise exception '%', missing_step using errcode = 'P0001';
      end if;
      -- One at a time, even if two are published at once.
      perform pg_advisory_xact_lock(hashtext('conference-publish:' || new.organization_id::text));
      other := public.other_published_conference(new.id);
      if other is not null then
        raise exception 'You already have a published conference: %. Unpublish it first, then publish this one.', other
          using errcode = 'P0001';
      end if;
    elsif not public.org_has_active_plan(new.organization_id) then
      raise exception 'Publishing needs an active Field Command Events plan' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
