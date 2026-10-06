-- =============================================================================
-- Section Leads check in their own station's volunteers on contest day.
-- Hosts and Volunteer Leads can still check in anyone, any time. A Section
-- Lead can only check in volunteers on shifts at a station they lead, and
-- only on event day (the same day their contact details unlock).
-- =============================================================================

create or replace function public.check_in_volunteer(p_assignment_id uuid, p_checked_in boolean default true)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev_id uuid;
  st_id uuid;
begin
  select s.event_id, s.station_id into ev_id, st_id
    from volunteer_assignments va join shifts s on s.id = va.shift_id
   where va.id = p_assignment_id;
  if ev_id is null
     or not (public.can_manage_volunteers(ev_id)
             or (public.leads_station(st_id) and public.is_event_day(ev_id))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update volunteer_assignments
     set checked_in_at = case when p_checked_in then now() end,
         checked_in_by = case when p_checked_in then auth.uid() end
   where id = p_assignment_id;
end;
$$;
