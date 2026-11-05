-- =============================================================================
-- My team (design review 2026-11-05, light check): a Coordinator sees who their
-- event's Volunteer Lead is, by name and email (no phone), so day-of questions go
-- to the person running volunteers. Only for people on that event's team while
-- they can see it (is_event_staff(), which ends 10 days after the event).
-- =============================================================================

create function public.event_volunteer_leads(p_events uuid[])
returns table (event_id uuid, user_id uuid, full_name text, email text)
language sql stable security definer set search_path = public
as $$
  select s.event_id, s.user_id, coalesce(nullif(p.full_name, ''), p.email::text), p.email::text
    from event_staff s
    join profiles p on p.id = s.user_id
   where s.event_id = any (p_events)
     and s.role = 'volunteer_director'
     and public.is_event_staff(s.event_id);
$$;
revoke execute on function public.event_volunteer_leads(uuid[]) from public, anon;
grant execute on function public.event_volunteer_leads(uuid[]) to authenticated;
