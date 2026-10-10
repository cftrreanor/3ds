-- =============================================================================
-- Security fixes from the October 2026 review.
--
-- 1. Nobody joins a team without saying yes. Hosts and Volunteer Leads could
--    add any user to their event's team directly (event_staff insert), and the
--    team's profiles are readable by managers, so anyone could create a draft
--    event, "add" a stranger and read their email and phone. People now join
--    only by accepting an invitation (accept_invitation and the other security
--    definer functions); hosts and Volunteer Leads can still remove people.
-- 2. Hosts can't create a band in someone else's name. "bands: hosts all"
--    allowed inserting a band with any director_user_id, which then showed
--    that person's email in past_band_directors(). Bands are registered by
--    their own director; hosts still read, edit and remove them.
-- 3. Children's details: Section Leads see parent registrations (and check
--    parents in) only on event day. Hosts and Volunteer Leads keep access from
--    registration until the 30-day purge.
-- =============================================================================

-- 1. Team membership only through invitations.
drop policy if exists "staff: hosts manage" on public.event_staff;
drop policy if exists "staff: directors add section leads" on public.event_staff;
create policy "staff: hosts remove" on public.event_staff
  for delete to authenticated using (public.is_event_admin(event_id));
revoke insert, update on public.event_staff from anon, authenticated;

-- 2. Bands: registered by their own director only.
drop policy if exists "bands: hosts all" on public.bands;
create policy "bands: hosts read" on public.bands
  for select to authenticated using (public.is_event_admin(event_id));
create policy "bands: hosts update" on public.bands
  for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "bands: hosts delete" on public.bands
  for delete to authenticated using (public.is_event_admin(event_id));

-- 3. The door: hosts and Volunteer Leads any time; Section Leads on event day.
create or replace function public.can_check_in_parents(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_manage_volunteers(ev) or (public.is_event_staff(ev) and public.is_event_day(ev));
$$;
