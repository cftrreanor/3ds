-- =============================================================================
-- Band invitations that wait for registration to open, say why they couldn't be
-- sent, and can be moved to a corrected address.
--   * sent_at is empty until the email goes out (an invitation sent at once still gets now()). scheduled_for: the day a host
--     chose them to go out (registration's opening day); the daily job sends
--     them that morning, once registration is open.
--   * failed_reason: why the last email couldn't be sent ("address": the
--     email service refused the address; "service": something on our side).
--   * replaced_by: the corrected address this invitation was moved to.
-- Hosts read these with the rest; only the server writes invitations.
-- =============================================================================

alter table public.band_invitations alter column sent_at drop not null;
alter table public.band_invitations
  add column scheduled_for date,
  add column failed_reason text check (failed_reason in ('address', 'service')),
  add column replaced_by citext;

grant select (scheduled_for, failed_reason, replaced_by) on public.band_invitations to authenticated;

-- The daily job finds waiting invitations by day.
create index on public.band_invitations (scheduled_for) where sent_at is null;
