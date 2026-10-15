-- =============================================================================
-- Conference bookings are seen only by the teacher: the people on the
-- teacher's own account (the event's hosts). The event's team (Volunteer
-- Leads, Section Leads) no longer reads them, so "only your child's teacher
-- sees this" is true. Families still see only open times.
-- =============================================================================

drop policy "bookings: event team reads" on public.conference_bookings;
create policy "bookings: the teacher reads" on public.conference_bookings
  for select to authenticated using (public.is_event_admin(event_id));
