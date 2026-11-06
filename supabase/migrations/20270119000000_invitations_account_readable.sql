-- =============================================================================
-- Fix: invitations.organization_id (added in 20270113000000_my_team.sql) could be
-- written but not read, because invitations' columns are granted one by one
-- (20261019000000_team_emails.sql keeps the secret email_token out). My team and
-- the event's team setup look invitations up by account, so the query was
-- refused and My team showed "This page didn't load". Row access is unchanged:
-- the "invitations: managers read" policy still decides which rows anyone sees.
-- =============================================================================

grant select (organization_id) on public.invitations to authenticated;
