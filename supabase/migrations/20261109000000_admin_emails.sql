-- =============================================================================
-- Admin emails: write to a host (or a person, or a pilot request) from the
-- admin dashboard, and keep reusable email templates.
--
--   * email_templates: name, subject and body (with {{merge fields}}).
--     FieldCommand admins only.
--   * email_log.sent_by / email_log.body: who wrote an email from the admin
--     dashboard, and what it said, for the account's timeline. (Emails the
--     app sends on its own leave them empty.)
-- =============================================================================

create table public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  subject     text not null check (char_length(trim(subject)) between 1 and 300),
  body        text not null check (char_length(trim(body)) between 1 and 10000),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.email_templates enable row level security;
revoke all on public.email_templates from anon, authenticated;
grant select, insert, delete on public.email_templates to authenticated;
grant update (name, subject, body, updated_at) on public.email_templates to authenticated;
create policy "email templates: admins read" on public.email_templates
  for select to authenticated using (public.is_platform_admin());
create policy "email templates: admins add" on public.email_templates
  for insert to authenticated with check (public.is_platform_admin() and created_by = auth.uid());
create policy "email templates: admins update" on public.email_templates
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "email templates: admins delete" on public.email_templates
  for delete to authenticated using (public.is_platform_admin());

alter table public.email_log
  add column sent_by uuid references public.profiles (id) on delete set null,
  add column body text check (char_length(body) <= 10000);
