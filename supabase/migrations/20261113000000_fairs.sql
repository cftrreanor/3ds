-- =============================================================================
-- School fairs and fundraisers: a fifth kind of event. Volunteers work the
-- same way (stations, shifts, sign-ups, the check-in desk); what's new is the
-- fair's attractions ("booths"), most hosted by a community partner or vendor:
--   "Dunk Tank, hosted by Verizon, Activity Stations, by the gym doors".
--
--   * fair_booths: what it is, who hosts it (optional), its zone (Game Zone,
--     Activity Stations, Marketplace, Showcase, or anything), where it is, a
--     short description, a private contact, and whether it's listed on the
--     public page. The host and Volunteer Leads add and edit them.
--   * fair_booth_checkin(booth, arrived): anyone on the event team taps a
--     partner in as arrived on fair day (or undoes it).
--   * public_fair_booths(slug): the public "What's at the fair" list for a
--     published fair (no contact details).
--   * stations.zone: which zone a volunteer station belongs to (optional).
--   * A fair with booths keeps its type.
-- =============================================================================

alter type public.event_type add value if not exists 'fair';

alter table public.stations add column zone text check (zone is null or char_length(zone) <= 60);

create table public.fair_booths (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  title          text not null check (char_length(trim(title)) between 1 and 120),
  host_name      text check (host_name is null or char_length(host_name) <= 120),
  zone           text check (zone is null or char_length(zone) <= 60),
  location       text check (location is null or char_length(location) <= 120),
  description    text check (description is null or char_length(description) <= 500),
  contact_name   text check (contact_name is null or char_length(contact_name) <= 120),
  contact_email  text check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone  text check (contact_phone is null or char_length(contact_phone) <= 30),
  show_publicly  boolean not null default true,
  arrived_at     timestamptz,
  arrived_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.fair_booths (event_id, zone);

alter table public.fair_booths enable row level security;
revoke all on public.fair_booths from anon, authenticated;
grant select, delete on public.fair_booths to authenticated;
grant insert (event_id, title, host_name, zone, location, description, contact_name, contact_email, contact_phone, show_publicly)
  on public.fair_booths to authenticated;
grant update (title, host_name, zone, location, description, contact_name, contact_email, contact_phone, show_publicly)
  on public.fair_booths to authenticated;

create policy "booths: event team reads" on public.fair_booths
  for select to authenticated using (public.is_event_staff(event_id) or public.is_event_admin(event_id));
create policy "booths: managers add" on public.fair_booths
  for insert to authenticated with check (public.can_manage_volunteers(event_id));
create policy "booths: managers edit" on public.fair_booths
  for update to authenticated using (public.can_manage_volunteers(event_id)) with check (public.can_manage_volunteers(event_id));
create policy "booths: managers remove" on public.fair_booths
  for delete to authenticated using (public.can_manage_volunteers(event_id));

-- Booths only belong to fairs.
create function public.fair_booths_need_fair()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type::text from events where id = new.event_id) <> 'fair' then
    raise exception 'Booths and partners are for school fairs.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger fair_booths_need_fair
  before insert on public.fair_booths
  for each row execute function public.fair_booths_need_fair();

-- A fair with booths keeps its type (they'd vanish otherwise).
create function public.events_fair_type_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.event_type::text = 'fair' and new.event_type::text <> 'fair'
     and exists (select 1 from fair_booths where event_id = new.id) then
    raise exception 'This fair has booths and partners, so it has to stay a school fair.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger events_fair_type_change
  before update of event_type on public.events
  for each row execute function public.events_fair_type_change();

-- Fair day: anyone on the event team taps a partner in (or takes it back).
create function public.fair_booth_checkin(p_booth uuid, p_arrived boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev uuid;
begin
  select event_id into ev from fair_booths where id = p_booth;
  if ev is null then
    raise exception 'That booth isn''t on this fair.' using errcode = 'P0001';
  end if;
  if not (public.is_event_staff(ev) or public.is_event_admin(ev)) then
    raise exception 'Only the event team can check partners in.' using errcode = '42501';
  end if;
  update fair_booths
     set arrived_at = case when p_arrived then coalesce(arrived_at, now()) end,
         arrived_by = case when p_arrived then coalesce(arrived_by, auth.uid()) end
   where id = p_booth;
end;
$$;

-- The public "What's at the fair" list (published fairs, listed booths only).
create function public.public_fair_booths(p_slug text)
returns table (id uuid, title text, host_name text, zone text, location text, description text)
language sql stable security definer set search_path = public
as $$
  select b.id, b.title, b.host_name, b.zone, b.location, b.description
    from fair_booths b
    join events e on e.id = b.event_id
   where e.slug = p_slug and e.status = 'published' and e.event_type::text = 'fair' and b.show_publicly
   order by b.zone nulls last, b.title;
$$;

revoke execute on function public.fair_booth_checkin(uuid, boolean) from public, anon;
grant execute on function public.fair_booth_checkin(uuid, boolean) to authenticated;
revoke execute on function public.public_fair_booths(text) from public;
grant execute on function public.public_fair_booths(text) to anon, authenticated;
revoke execute on function public.fair_booths_need_fair(), public.events_fair_type_change() from public, anon, authenticated;

-- Hosts and Volunteer Leads set a station's zone like its other details.
grant insert (zone), update (zone) on public.stations to authenticated;
