-- =============================================================================
-- Band directors: a registration deadline, information for directors, and a
-- host contact that only the event's directors and team can see.
-- =============================================================================

alter table public.events
  add column band_registration_deadline date,
  add column director_info text check (length(director_info) <= 3000);

-- Registration is open when the host has opened it and the deadline (the end
-- of that day, in the event's time zone) hasn't passed.
create or replace function public.band_registration_is_open(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e
     where e.id = ev
       and e.status = 'published'
       and e.band_registration_open
       and (e.band_registration_deadline is null
            or (now() at time zone e.timezone)::date <= e.band_registration_deadline)
  );
$$;

drop policy "bands: director register" on public.bands;
create policy "bands: director register" on public.bands
  for insert to authenticated
  with check (director_user_id = auth.uid() and public.band_registration_is_open(event_id));

drop policy "bands: director update own" on public.bands;
create policy "bands: director update own" on public.bands
  for update to authenticated
  using (director_user_id = auth.uid() and public.band_registration_is_open(event_id))
  with check (director_user_id = auth.uid());

drop policy "bands: director withdraw" on public.bands;
create policy "bands: director withdraw" on public.bands
  for delete to authenticated
  using (director_user_id = auth.uid() and public.band_registration_is_open(event_id));

-- Who directors should call or email. Kept out of the public events table:
-- only the host's team and directors with a band at the event can read it.
create table public.event_director_contacts (
  event_id    uuid primary key references public.events (id) on delete cascade,
  name        text not null default '' check (length(name) <= 150),
  phone       text not null default '' check (length(phone) <= 20),
  email       text not null default '' check (length(email) <= 254),
  updated_at  timestamptz not null default now()
);
alter table public.event_director_contacts enable row level security;

create policy "director contacts: team read" on public.event_director_contacts
  for select to authenticated using (public.is_event_staff(event_id));
create policy "director contacts: directors read" on public.event_director_contacts
  for select to authenticated
  using (exists (select 1 from public.bands b where b.event_id = event_director_contacts.event_id
                                              and b.director_user_id = auth.uid()));
create policy "director contacts: hosts write" on public.event_director_contacts
  for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
revoke all on public.event_director_contacts from anon;

revoke execute on function public.band_registration_is_open(uuid) from public, anon;
grant execute on function public.band_registration_is_open(uuid) to authenticated;
