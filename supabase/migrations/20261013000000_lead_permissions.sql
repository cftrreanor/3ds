-- =============================================================================
-- What Volunteer Leads and Section Leads can see.
--
-- * Band registrations (directors' emails, phones, addresses, notes) are for
--   hosts and the band's own director only. Leads get event_bands(): every
--   band's name, school, class and contest-day status, plus headcounts and
--   vehicles for Volunteer Leads (parking and planning). Nobody but hosts
--   and the band's director can edit a band.
-- * Leads see the performance schedule, breaks and finals the same way the
--   public does: once published, with finalist names only once revealed.
--   Drafts stay with the hosts.
-- * Announcements: hosts and Volunteer Leads read them all. Section Leads
--   read the ones sent to volunteers or Section Leads (plus public ones).
-- =============================================================================

-- Bands -------------------------------------------------------------------
drop policy "bands: staff read" on public.bands;

create function public.event_bands(ev uuid)
returns table (
  id                   uuid,
  band_name            text,
  school_name          text,
  classification       text,
  status               public.band_status,
  status_updated_at    timestamptz,
  student_count        int,
  chaperone_count      int,
  bus_count            int,
  box_truck_count      int,
  truck_trailer_count  int,
  semi_truck_count     int
)
language sql stable security definer set search_path = public
as $$
  with me as (select public.is_event_staff(ev) as staff, public.can_manage_volunteers(ev) as manager)
  select b.id, b.band_name, b.school_name, b.classification, b.status, b.status_updated_at,
         case when me.manager then b.student_count end,
         case when me.manager then b.chaperone_count end,
         case when me.manager then b.bus_count end,
         case when me.manager then b.box_truck_count end,
         case when me.manager then b.truck_trailer_count end,
         case when me.manager then b.semi_truck_count end
    from bands b, me
   where b.event_id = ev and me.staff
   order by b.band_name;
$$;
revoke execute on function public.event_bands(uuid) from public, anon;
grant execute on function public.event_bands(uuid) to authenticated;

-- Schedule: hosts keep full access through their "hosts write" policies.
drop policy "slots: staff read" on public.performance_slots;
drop policy "breaks: staff read" on public.schedule_breaks;
drop policy "finals: staff read" on public.finals_slots;

-- Announcements -----------------------------------------------------------
drop policy "announcements: staff read" on public.announcements;
create policy "announcements: managers read" on public.announcements
  for select to authenticated using (public.can_manage_volunteers(event_id));
create policy "announcements: section leads read" on public.announcements
  for select to authenticated
  using (audiences && array['volunteers', 'section_leads']::public.announcement_audience[]
         and public.is_event_staff(event_id));
