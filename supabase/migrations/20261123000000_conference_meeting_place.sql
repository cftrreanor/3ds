-- =============================================================================
-- Conferences: where families meet, refined.
--
--   * The school's name and address are asked in step 2 ("Where you'll
--     meet") for in-person meetings, not when the conference is created. They
--     stay on the event (venue_name / venue_address), so they show on the
--     public page and in calendar invites; a video-only conference has none.
--   * own_link: the teacher sends families the video link themselves (in
--     their own calendar invite) instead of pasting it here.
--   * Ready to publish now means: in-person meetings have the school's
--     address and a room; video meetings have a link pasted here (with the
--     waiting room ticked) or the teacher sends their own.
-- =============================================================================

alter table public.conference_settings add column own_link boolean not null default false;
grant insert (own_link), update (own_link) on public.conference_settings to authenticated;

create or replace function public.conference_not_ready(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when not public.is_event_admin(ev) then 'Only the event''s hosts can publish it.'
    when s.event_id is null or s.times_saved_at is null then 'Save your meeting times first (step 1).'
    when s.meeting_mode is null then 'Choose where you''ll meet first (step 2).'
    when s.meeting_mode in ('in_person', 'either') and coalesce(trim(e.venue_address), '') = ''
      then 'Add your school''s address first (step 2).'
    when s.meeting_mode in ('in_person', 'either') and coalesce(trim(s.room), '') = '' then 'Add your room and directions first (step 2).'
    when s.meeting_mode in ('video', 'either') and not s.own_link and s.video_link is null then 'Add your meeting link first (step 2).'
    when s.meeting_mode in ('video', 'either') and not s.own_link and not s.waiting_room_confirmed
      then 'Tick that your meeting has a waiting room and runs the whole time (step 2).'
  end
  from events e
  left join conference_settings s on s.event_id = e.id
  where e.id = ev;
$$;
