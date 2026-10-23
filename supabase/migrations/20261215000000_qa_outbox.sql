-- =============================================================================
-- The QA site's outbox (docs/QA-SETUP.md).
--
-- On the QA site (QA_MODE=1), emails the platform would send are saved here
-- instead, so reviewers can read exactly what families and organizers get.
-- On the live site nothing writes to it.
--
-- Only the server reads or writes it (its own key): no one signs in to it.
-- =============================================================================

create table public.qa_outbox (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  sender      text not null,
  reply_to    text,
  recipients  text[] not null,
  subject     text not null,
  html        text not null,
  text_body   text,
  -- A calendar invite's method (REQUEST or CANCEL), when the email carries one.
  invite      text
);
create index qa_outbox_created_at on public.qa_outbox (created_at desc);

alter table public.qa_outbox enable row level security;
revoke all on public.qa_outbox from anon, authenticated;
grant select, insert, update, delete on public.qa_outbox to service_role;
