-- =============================================================================
-- Maps & documents: files (PDFs, images) a host shares with the public, band
-- directors, volunteers and/or the team.
--   * Files live in a private storage bucket. Nobody downloads straight from
--     storage: our server checks who's asking (the file's audiences, and its
--     "show from" date) and hands out a short-lived link.
--   * Only hosts and co-hosts can see the list here or change it; everyone
--     else gets the files meant for them through our server.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-files', 'event-files', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create table public.event_files (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 120),
  path          text not null unique,
  file_name     text not null check (char_length(file_name) between 1 and 200),
  content_type  text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes    int not null check (size_bytes between 1 and 10485760),
  -- Who can see it: any of public, directors, volunteers, team.
  audiences     text[] not null check (cardinality(audiences) > 0 and audiences <@ array['public', 'directors', 'volunteers', 'team']),
  -- Hidden from everyone but hosts until this day (in the event's time zone).
  visible_from  date,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.event_files (event_id);

alter table public.event_files enable row level security;
revoke all on public.event_files from anon, authenticated;
grant select, delete on public.event_files to authenticated;
grant insert (event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from, created_by)
  on public.event_files to authenticated;
grant update (label, path, file_name, content_type, size_bytes, audiences, visible_from, updated_at)
  on public.event_files to authenticated;

create policy "event files: hosts read" on public.event_files
  for select to authenticated using (public.is_event_admin(event_id));
create policy "event files: hosts add" on public.event_files
  for insert to authenticated with check (public.is_event_admin(event_id) and created_by = auth.uid());
create policy "event files: hosts change" on public.event_files
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "event files: hosts remove" on public.event_files
  for delete to authenticated using (public.is_event_admin(event_id));

-- A file's path must sit in its own event's folder.
alter table public.event_files
  add constraint event_files_path_in_event check (path like event_id::text || '/%');
