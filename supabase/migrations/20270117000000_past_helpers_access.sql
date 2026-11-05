-- =============================================================================
-- People on an event's team stop seeing it 10 days after it ends (design review
-- 2026-11-05, finding 6). That's the day volunteers' details are deleted
-- (purge_volunteers()); after it, a past Volunteer Lead or Coordinator no
-- longer sees the event, its team's names, emails, and phone numbers, or
-- anything else staff can read. Hosts and co-hosts keep everything, and the
-- event_staff rows stay as history (My team's Past events, Invite again).
-- "Ends" counts in the event's own time zone, like the clean-up.
-- =============================================================================

create or replace function public.can_manage_volunteers(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev) or exists (
    select 1 from event_staff s join events e on e.id = s.event_id
     where s.event_id = ev and s.user_id = auth.uid() and s.role = 'volunteer_director'
       and (now() at time zone e.timezone)::date <= e.ends_on + 10
  );
$$;

create or replace function public.is_event_staff(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev) or exists (
    select 1 from event_staff s join events e on e.id = s.event_id
     where s.event_id = ev and s.user_id = auth.uid()
       and (now() at time zone e.timezone)::date <= e.ends_on + 10
  );
$$;
