-- =============================================================================
-- One-tap host invitations, and a passcode for video meetings.
--
--   * host_invitations.email_token / sent_at: the "Set up my account" button
--     in a host invitation email signs the invited person straight in (like
--     team invitations, 20261203000000), so they don't need a second sign-in
--     email. The app sets a fresh token each time it sends the email; the
--     button works for a week after that, until the account is set up. The
--     token never leaves the server: admins can still read every other column.
--   * conference_settings.video_passcode: a Zoom (or other) passcode, shown
--     next to the meeting link in families' emails and calendar invites.
-- =============================================================================

alter table public.host_invitations
  add column email_token uuid unique,
  add column sent_at timestamptz;

-- Signed-in admins read invitations column by column, so the token stays server-only.
revoke select on public.host_invitations from authenticated;
grant select (id, email, pilot_request_id, invited_by, invited_at, expires_at, used_at, organization_id, package, plan_status, free_until)
  on public.host_invitations to authenticated;

alter table public.conference_settings
  add column video_passcode text check (video_passcode is null or char_length(video_passcode) between 1 and 50);
grant insert (video_passcode), update (video_passcode) on public.conference_settings to authenticated;
