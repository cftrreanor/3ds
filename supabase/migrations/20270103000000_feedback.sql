-- =============================================================================
-- Feedback from any page.
--   * Anyone (signed in or not) can send feedback from the Feedback button:
--     what kind (something's broken, an idea, a question), the message, the
--     page, their browser, an optional screenshot, and, if they aren't signed
--     in, an optional email for our reply.
--   * Only our server saves it (it checks for spam and how often someone has
--     sent feedback), emails the team, and opens a GitHub issue. The issue
--     never holds the person's name, email, or screenshot; those stay here.
--   * Platform admins read it in Admin → Feedback. No one else can read it.
--   * Screenshots live in a private bucket our server reads for admins.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create table public.feedback (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  kind             text not null check (kind in ('bug', 'idea', 'question')),
  message          text not null check (char_length(message) between 1 and 5000),
  page             text not null check (char_length(page) between 1 and 500),
  user_agent       text check (char_length(user_agent) <= 500),
  -- Who sent it: a signed-in person, or just the email they typed (optional).
  user_id          uuid references public.profiles (id) on delete set null,
  organization_id  uuid references public.organizations (id) on delete set null,
  name             text check (char_length(name) <= 200),
  email            text check (char_length(email) <= 254),
  -- A one-way fingerprint of the sender's network address, to limit how often feedback can be sent.
  sender_hash      text not null check (char_length(sender_hash) <= 100),
  screenshot_path  text unique,
  github_issue     int,
  github_url       text,
  replied_at       timestamptz
);
create index on public.feedback (created_at desc);
create index on public.feedback (sender_hash, created_at);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;
create policy "feedback: platform admins read" on public.feedback
  for select to authenticated using (public.is_platform_admin());
