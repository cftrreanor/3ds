-- =============================================================================
-- "Join the pilot" requests from the public home page.
--   * The server saves each request with its private key (visitors aren't
--     signed in), so nobody can write to or read this table from a browser.
--   * Only FieldCommand's own staff (platform_admins) can read the requests
--     and mark them contacted / accepted / declined.
--
-- After running this, make yourself an admin (use the email you sign in with):
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- =============================================================================

create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table public.pilot_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 200),
  email         text not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
  phone         text check (char_length(phone) <= 30),
  organization  text not null check (char_length(organization) between 2 and 200),
  contest_name  text check (char_length(contest_name) <= 200),
  contest_when  text check (char_length(contest_when) <= 100),
  bands         int check (bands between 0 and 500),
  volunteers    int check (volunteers between 0 and 5000),
  notes         text check (char_length(notes) <= 2000),
  status        text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined')),
  created_at    timestamptz not null default now()
);
create index pilot_requests_created_at_idx on public.pilot_requests (created_at desc);
create index pilot_requests_email_idx on public.pilot_requests (lower(email), created_at desc);

alter table public.pilot_requests enable row level security;
revoke all on public.pilot_requests from anon, authenticated;
grant select on public.pilot_requests to authenticated;
grant update (status) on public.pilot_requests to authenticated;

create policy "Platform admins read pilot requests" on public.pilot_requests
  for select to authenticated using (public.is_platform_admin());
create policy "Platform admins update pilot requests" on public.pilot_requests
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
