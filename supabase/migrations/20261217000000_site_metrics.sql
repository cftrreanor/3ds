-- =============================================================================
-- Visits to the marketing pages, counted by us (Admin → Site visits).
--
-- Daily counts only: which page, where the visitor came from (Google, another
-- site, direct), and what happened: a visit, a section of the page reached, a
-- button or link clicked (label names which), starting the pilot form, sending
-- it. No cookies, no IP addresses, nothing about who the visitor was, and
-- nothing from event, student, or family pages (src/lib/site-metrics.ts).
--
-- Only the server reads or writes these (its own key).
-- =============================================================================

create table public.site_metrics (
  day     date not null,
  path    text not null check (char_length(path) between 1 and 200),
  source  text not null check (char_length(source) between 1 and 60),
  event   text not null check (event in ('view', 'section', 'click', 'pilot_open', 'pilot_sent')),
  -- The section's heading or the button's text, for 'section' and 'click'; '' otherwise.
  label   text not null default '' check (char_length(label) <= 100),
  count   int  not null default 0 check (count >= 0),
  primary key (day, path, source, event, label)
);
create index site_metrics_day on public.site_metrics (day desc);

alter table public.site_metrics enable row level security;
revoke all on public.site_metrics from anon, authenticated;
grant select, insert, update, delete on public.site_metrics to service_role;

-- Adds one to a day's count, in one step, so two visits at once both count.
create function public.bump_site_metric(p_day date, p_path text, p_source text, p_event text, p_label text default '')
returns void
language sql
set search_path = public
as $$
  insert into public.site_metrics (day, path, source, event, label, count)
  values (p_day, p_path, p_source, p_event, coalesce(p_label, ''), 1)
  on conflict (day, path, source, event, label) do update set count = site_metrics.count + 1;
$$;
revoke execute on function public.bump_site_metric(date, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bump_site_metric(date, text, text, text, text) to service_role;
