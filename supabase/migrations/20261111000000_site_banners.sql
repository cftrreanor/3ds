-- =============================================================================
-- Company banners: short notices from Field Command Events admins, shown at
-- the top of the site to one group at a time, instead of emailing everyone.
--
--   * site_banners: the notice (title, message, optional https link), its
--     tone, who it's for and when it runs.
--       audience  hosts | directors | teams | public
--       host_filter (hosts only)  all | pilot | trial | paid | free_ending
--     "free_ending" means a pilot or trial whose free period ends within 30
--     days or has ended. The app decides who matches; nothing in a banner is
--     private, but signed-out visitors only ever get the public ones.
--   * site_banner_dismissals: who closed which banner, so it stays closed for
--     them. (Signed-out visitors' dismissals are kept in their browser.)
--   * Urgent banners can't be closed.
-- =============================================================================

create table public.site_banners (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 1 and 120),
  body         text check (char_length(body) <= 600),
  link_label   text check (char_length(link_label) <= 60),
  link_url     text check (link_url ~ '^https?://' and char_length(link_url) <= 500),
  tone         text not null default 'info' check (tone in ('info', 'success', 'warning', 'urgent')),
  audience     text not null check (audience in ('hosts', 'directors', 'teams', 'public')),
  host_filter  text not null default 'all' check (host_filter in ('all', 'pilot', 'trial', 'paid', 'free_ending')),
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index on public.site_banners (starts_at, ends_at);

alter table public.site_banners enable row level security;
revoke all on public.site_banners from anon, authenticated;
grant select on public.site_banners to anon, authenticated;
grant insert, delete on public.site_banners to authenticated;
grant update (title, body, link_label, link_url, tone, audience, host_filter, starts_at, ends_at) on public.site_banners to authenticated;

create policy "site banners: admins read all" on public.site_banners
  for select to authenticated using (public.is_platform_admin());
create policy "site banners: signed-in people read live ones" on public.site_banners
  for select to authenticated using (starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "site banners: visitors read live public ones" on public.site_banners
  for select to anon using (audience = 'public' and starts_at <= now() and (ends_at is null or ends_at > now()));
create policy "site banners: admins add" on public.site_banners
  for insert to authenticated with check (public.is_platform_admin() and created_by = auth.uid());
create policy "site banners: admins update" on public.site_banners
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "site banners: admins delete" on public.site_banners
  for delete to authenticated using (public.is_platform_admin());

create table public.site_banner_dismissals (
  banner_id     uuid not null references public.site_banners (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  dismissed_at  timestamptz not null default now(),
  primary key (banner_id, user_id)
);

alter table public.site_banner_dismissals enable row level security;
revoke all on public.site_banner_dismissals from anon, authenticated;
grant select, insert on public.site_banner_dismissals to authenticated;
create policy "banner dismissals: own" on public.site_banner_dismissals
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy "banner dismissals: close your own" on public.site_banner_dismissals
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.site_banners b where b.id = banner_id and b.tone <> 'urgent')
  );
