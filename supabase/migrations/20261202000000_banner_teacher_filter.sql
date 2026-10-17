-- =============================================================================
-- Company banners can be aimed at free teacher accounts only, or at every
-- host except free teacher accounts.
--
--   host_filter (hosts only)  all | pilot | trial | paid | free_ending
--                             | teacher | schools
--
-- Who matches is decided by the app from each account's kind, the same way
-- the plan filters work; this only lets a banner be saved with the new values.
-- =============================================================================

alter table public.site_banners drop constraint if exists site_banners_host_filter_check;
alter table public.site_banners add constraint site_banners_host_filter_check
  check (host_filter in ('all', 'pilot', 'trial', 'paid', 'free_ending', 'teacher', 'schools'));
