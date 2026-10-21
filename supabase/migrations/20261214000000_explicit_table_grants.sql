-- =============================================================================
-- Spell out who can reach each table, instead of relying on Supabase's
-- automatic grants.
--
-- From October 30, 2026, Supabase stops granting API access to new tables in
-- "public" automatically. Tables that already exist keep their access, so the
-- live database doesn't change. But rebuilding the schema from these
-- migrations (a new project, a preview branch, or a local reset) would leave
-- every table unreachable, since each one got its access that way.
--
-- These grants are exactly the access each table has today: what Supabase
-- granted automatically, minus what earlier migrations took away. Row-level
-- security still decides which rows anyone sees. On the live database this
-- changes nothing.
--
-- From here on, each migration that creates a table grants its access itself.
-- =============================================================================

grant select, insert, update, delete on public.admin_log to service_role;
grant select, insert, update, delete on public.admin_notes to service_role;
grant select on public.announcements to anon;
grant select, insert, delete on public.announcements to authenticated;
grant select, insert, update, delete on public.announcements to service_role;
grant select on public.band_activity to anon, authenticated;
grant select, insert, update, delete on public.band_activity to service_role;
grant select, insert, update, delete on public.band_invitations to service_role;
grant select on public.band_notes to anon, authenticated;
grant select, insert, update, delete on public.band_notes to service_role;
grant select, insert, update, delete on public.band_prefills to service_role;
grant select on public.band_stops to anon, authenticated;
grant select, insert, update, delete on public.band_stops to service_role;
grant select on public.bands to anon;
grant select, delete on public.bands to authenticated;
grant select, insert, update, delete on public.bands to service_role;
grant select, insert, update, delete on public.conference_bookings to service_role;
grant select, insert, update, delete on public.conference_settings to service_role;
grant select, insert, update, delete on public.demo_accounts to service_role;
grant select, insert, update, delete on public.demo_events to service_role;
grant select, insert, update, delete on public.demo_samples to service_role;
grant select, insert, update, delete on public.email_log to service_role;
grant select, insert, update, delete on public.email_templates to service_role;
grant insert, update, delete on public.event_director_contacts to authenticated;
grant select, insert, update, delete on public.event_director_contacts to service_role;
grant select, insert, update, delete on public.event_email_settings to service_role;
grant select, insert, update, delete on public.event_files to service_role;
grant select on public.event_saves to anon;
grant select, insert, update, delete on public.event_saves to authenticated, service_role;
grant select on public.event_staff to anon;
grant select, delete on public.event_staff to authenticated;
grant select, insert, update, delete on public.event_staff to service_role;
grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated, service_role;
grant select, insert, update, delete on public.fair_booths to service_role;
grant select, insert, update, delete on public.fair_zones to service_role;
grant select on public.finals_slots to anon;
grant select, insert, update, delete on public.finals_slots to authenticated, service_role;
grant select on public.group_checkins to authenticated;
grant select, insert, update, delete on public.group_checkins to service_role;
grant select, insert, update, delete on public.group_order to service_role;
grant select, insert, update, delete on public.host_invitations to service_role;
grant select, insert, update, delete on public.invitation_sends to service_role;
grant delete on public.invitations to authenticated;
grant select, insert, update, delete on public.invitations to service_role;
grant select on public.organization_members to anon;
grant select, insert, update, delete on public.organization_members to authenticated, service_role;
grant select on public.organizations to anon;
grant select, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.parent_registrations to service_role;
grant select, insert, update, delete on public.pending_band_registrations to service_role;
grant select on public.performance_slots to anon;
grant select, insert, update, delete on public.performance_slots to authenticated, service_role;
grant select, insert, update, delete on public.pilot_requests to service_role;
grant select, insert, update, delete on public.platform_admins to service_role;
grant select on public.profiles to anon;
grant select, insert, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.room_slots to service_role;
grant select, insert, update, delete on public.rooms to service_role;
grant select on public.schedule_breaks to anon;
grant select, insert, update, delete on public.schedule_breaks to authenticated, service_role;
grant select on public.shifts to anon;
grant select, delete on public.shifts to authenticated;
grant select, insert, update, delete on public.shifts to service_role;
grant select, insert, update, delete on public.site_banner_dismissals to service_role;
grant select, insert, update, delete on public.site_banners to service_role;
grant select, insert, update, delete on public.station_leads to authenticated, service_role;
grant select on public.stations to anon;
grant select, delete on public.stations to authenticated;
grant select, insert, update, delete on public.stations to service_role;
grant select, insert, update, delete on public.team_removals to service_role;
grant select, insert, update, delete on public.user_deletion_queue to service_role;
grant select, insert, update, delete on public.volunteer_assignments to service_role;
grant insert, update, delete on public.volunteers to authenticated;
grant select, insert, update, delete on public.volunteers to service_role;
