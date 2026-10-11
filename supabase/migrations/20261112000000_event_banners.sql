-- =============================================================================
-- Event banners: a host or Volunteer Lead posts a day-of announcement (a band
-- switch, a schedule change, an emergency) that shows as a banner on the
-- pages of the people it's for: the public event page, directors' band
-- pages, the event team's pages and volunteers' "My shifts".
--
-- These are the existing announcements, now with an end:
--   * announcements.ends_at: when the banner stops showing (null = until
--     someone ends it; emergencies default to that). Each person sees a live
--     banner for at least a minute, then it fades away (in the app).
--   * Ending one early: hosts can end any of their event's announcements;
--     Volunteer Leads the ones they could have sent (to volunteers and
--     Section Leads). Nothing else about a sent announcement can change.
-- =============================================================================

alter table public.announcements add column ends_at timestamptz;
alter table public.announcements add constraint announcements_ends_after_start
  check (ends_at is null or ends_at >= created_at);

revoke update on public.announcements from anon, authenticated;
grant update (ends_at) on public.announcements to authenticated;

create policy "announcements: hosts end" on public.announcements
  for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "announcements: volunteer leads end" on public.announcements
  for update to authenticated
  using (public.can_manage_volunteers(event_id)
         and audiences <@ array['volunteers', 'section_leads']::public.announcement_audience[])
  with check (public.can_manage_volunteers(event_id)
              and audiences <@ array['volunteers', 'section_leads']::public.announcement_audience[]);

create index if not exists announcements_live_idx on public.announcements (event_id, ends_at);
