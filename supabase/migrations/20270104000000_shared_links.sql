-- =============================================================================
-- Next steps after publishing: which links have been shared.
--   * Once an event is live, its checklist lists who to send each link to
--     (volunteers, parents, directors, people booking a time) and announcing
--     the event. A step is done when someone on the event's team copies that
--     link (or downloads its QR code, or copies the announcement), or marks it
--     done by hand because they shared it another way.
--   * One row per event and link, kept with who did it first and when.
--   * Hosts and Volunteer Leads (who see Links to share) record it; the
--     event's team can read it. Nobody else sees it.
-- =============================================================================

create table public.event_shared_links (
  event_id   uuid not null references public.events (id) on delete cascade,
  link       text not null check (link in ('public', 'registration', 'parents', 'volunteers', 'announcement')),
  shared_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  shared_at  timestamptz not null default now(),
  primary key (event_id, link)
);

alter table public.event_shared_links enable row level security;
revoke all on public.event_shared_links from anon, authenticated;
grant select, insert on public.event_shared_links to authenticated;
grant select, insert, update, delete on public.event_shared_links to service_role;

create policy "shared links: the event's team reads" on public.event_shared_links
  for select to authenticated using (public.is_event_staff(event_id));
create policy "shared links: hosts and Volunteer Leads record, as themselves" on public.event_shared_links
  for insert to authenticated with check (public.can_manage_volunteers(event_id) and shared_by = auth.uid());
