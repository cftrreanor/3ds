-- =============================================================================
-- Register first, confirm after: a director who isn't signed in fills in the
-- band registration form, and it waits here until they type the code we email
-- them (or tap the button in that email). Confirming creates their account,
-- if they don't have one, and the registration. Unconfirmed entries are
-- deleted after 7 days, so organizers never see half-finished registrations.
--
-- Only our server reads or writes this table (no policies: browsers can't).
-- =============================================================================

create table public.pending_band_registrations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  email       text not null check (email = lower(email)),
  details     jsonb not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz not null default now()
);
create index on public.pending_band_registrations (email);
create index on public.pending_band_registrations (created_at);

alter table public.pending_band_registrations enable row level security;
revoke all on public.pending_band_registrations from anon, authenticated;
