-- =============================================================================
-- Core schema for the competition event platform.
--
-- Design notes (see docs/PRD-REVIEW.md for the reasoning):
--   * Roles are scoped to an organization or an event, never global. The same
--     person can host one contest, volunteer at another and direct a band at a
--     third.
--   * The paying customer is an ORGANIZATION (a booster club, a school), not a
--     single user, so a subscription survives a booster president changing.
--   * Privacy rules live in the database (Row Level Security + security-definer
--     functions), not only in the web app, so a bug in a page cannot leak
--     volunteer phone numbers.
-- =============================================================================

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin');
create type public.event_staff_role as enum ('volunteer_director', 'section_lead');
create type public.station_type as enum ('passive', 'active_checkpoint');
create type public.event_status as enum ('draft', 'published', 'archived');
create type public.band_status as enum ('pending', 'checked_in', 'warm_up_active', 'departed_to_gate', 'performed');
create type public.announcement_priority as enum ('emergency', 'schedule', 'routine');
create type public.announcement_audience as enum ('volunteers', 'section_leads', 'band_directors', 'public');
create type public.subscription_status as enum ('none', 'trialing', 'active', 'past_due', 'canceled', 'comped');

-- -----------------------------------------------------------------------------
-- People
-- -----------------------------------------------------------------------------
-- One row per signed-in person, created automatically from auth.users.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       citext not null unique,
  phone       text,                                   -- E.164, e.g. +15125550100
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Organizations (the paying customer) and their admins ("Account Hosts")
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  slug                      citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  default_timezone          text not null default 'America/Chicago',
  stripe_customer_id        text unique,
  subscription_status       public.subscription_status not null default 'none',
  subscription_period_end   timestamptz,
  created_at                timestamptz not null default now()
);

create table public.organization_members (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.org_role not null default 'admin',
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on public.organization_members (user_id);

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
create table public.events (
  id                            uuid primary key default gen_random_uuid(),
  organization_id               uuid not null references public.organizations (id) on delete cascade,
  name                          text not null,
  slug                          citext not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status                        public.event_status not null default 'draft',
  timezone                      text not null default 'America/Chicago',
  -- Calendar days the event runs (supports multi-day events). Section Lead
  -- access to volunteer contact info is unlocked only on these days.
  starts_on                     date not null,
  ends_on                       date not null,
  -- Overall operating window, e.g. 7:00 AM – 10:00 PM.
  window_start                  timestamptz not null,
  window_end                    timestamptz not null,
  venue_name                    text,
  venue_address                 text not null,
  public_notes                  text,
  -- Per-event settings that the PRD hard-coded.
  chaperone_limit               int not null default 25 check (chaperone_limit >= 0),
  classifications               text[] not null default array['1A','2A','3A','4A','5A','6A'],
  volunteer_signup_open         boolean not null default false,
  band_registration_open        boolean not null default false,
  performance_order_published   boolean not null default false,
  created_by                    uuid references public.profiles (id) on delete set null,
  created_at                    timestamptz not null default now(),
  unique (organization_id, slug),
  check (ends_on >= starts_on),
  check (window_end > window_start)
);
create index on public.events (organization_id);

-- Volunteer Directors and Section Leads, per event.
create table public.event_staff (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.event_staff_role not null,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id, role)
);
create index on public.event_staff (user_id);

-- -----------------------------------------------------------------------------
-- Stations and shifts
-- -----------------------------------------------------------------------------
create table public.stations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  name            text not null,
  station_type    public.station_type not null default 'passive',
  location        text,
  instructions    text,
  lead_user_id    uuid references public.profiles (id) on delete set null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index on public.stations (event_id);
create index on public.stations (lead_user_id);

create table public.shifts (
  id                uuid primary key default gen_random_uuid(),
  station_id        uuid not null references public.stations (id) on delete cascade,
  event_id          uuid not null references public.events (id) on delete cascade,
  title             text not null,
  description       text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  max_capacity      int not null check (max_capacity > 0),
  -- Maintained ONLY by register_volunteer()/cancel_assignment(), which lock the
  -- row first. Never update this from application code.
  registered_count  int not null default 0,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registered_count >= 0 and registered_count <= max_capacity)
);
create index on public.shifts (station_id);
create index on public.shifts (event_id);

-- Keep shifts.event_id consistent with its station.
create or replace function public.shifts_set_event_id()
returns trigger
language plpgsql
as $$
begin
  select event_id into new.event_id from public.stations where id = new.station_id;
  if new.max_capacity < new.registered_count then
    raise exception 'Capacity cannot be lowered below the % volunteers already registered', new.registered_count
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger shifts_set_event_id
  before insert or update of station_id, max_capacity on public.shifts
  for each row execute function public.shifts_set_event_id();

-- -----------------------------------------------------------------------------
-- Volunteers
-- -----------------------------------------------------------------------------
-- Volunteers do NOT need an account to sign up. A row is created per event from
-- the public form; when they later sign in with a magic link to the same email
-- they see their own records (matched on verified email).
create table public.volunteers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  full_name   text not null check (length(full_name) between 1 and 200),
  email       citext not null,
  phone       text not null,
  created_at  timestamptz not null default now(),
  unique (event_id, email)
);

create table public.volunteer_assignments (
  id              uuid primary key default gen_random_uuid(),
  shift_id        uuid not null references public.shifts (id) on delete cascade,
  volunteer_id    uuid not null references public.volunteers (id) on delete cascade,
  checked_in_at   timestamptz,
  checked_in_by   uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (shift_id, volunteer_id)
);
create index on public.volunteer_assignments (volunteer_id);

-- -----------------------------------------------------------------------------
-- Bands
-- -----------------------------------------------------------------------------
-- Student-level data is deliberately NOT collected (counts only). Keep it that
-- way: it keeps us clear of FERPA/COPPA obligations.
create table public.bands (
  id                        uuid primary key default gen_random_uuid(),
  event_id                  uuid not null references public.events (id) on delete cascade,
  director_user_id          uuid not null references public.profiles (id) on delete restrict,
  school_name               text not null,
  band_name                 text not null,
  classification            text not null,
  school_address            text not null,
  contact_email             citext not null,
  head_director_name        text not null,
  head_director_email       citext not null,
  head_director_phone       text not null,
  assistant_directors       text[] not null default '{}',
  student_count             int not null check (student_count >= 0),
  chaperone_count           int not null check (chaperone_count >= 0),
  bus_count                 int not null default 0 check (bus_count >= 0),
  box_truck_count           int not null default 0 check (box_truck_count >= 0),
  truck_trailer_count       int not null default 0 check (truck_trailer_count >= 0),
  semi_truck_count          int not null default 0 check (semi_truck_count >= 0),
  contest_day_conflicts     text,
  special_needs             text,
  -- Changed only through set_band_status(); directors cannot write it.
  status                    public.band_status not null default 'pending',
  status_updated_at         timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index on public.bands (event_id);
create index on public.bands (director_user_id);

-- Enforce the per-event chaperone limit and a valid classification.
create or replace function public.bands_validate()
returns trigger
language plpgsql
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = new.event_id;
  if new.chaperone_count > ev.chaperone_limit then
    raise exception 'This event allows at most % chaperones per band', ev.chaperone_limit
      using errcode = 'check_violation';
  end if;
  if not (new.classification = any (ev.classifications)) then
    raise exception 'Classification % is not offered at this event', new.classification
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger bands_validate
  before insert or update of event_id, chaperone_count, classification on public.bands
  for each row execute function public.bands_validate();

-- Performance order lives in its own table so that band directors can never
-- see or set it, and so the Host can draft it privately before publishing.
create table public.performance_slots (
  band_id             uuid primary key references public.bands (id) on delete cascade,
  event_id            uuid not null references public.events (id) on delete cascade,
  performance_order   int not null check (performance_order > 0),
  warm_up_at          timestamptz,
  perform_at          timestamptz,
  warm_up_location    text,
  unique (event_id, performance_order) deferrable initially deferred
);

-- -----------------------------------------------------------------------------
-- Announcements (the broadcast engine)
-- -----------------------------------------------------------------------------
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  sender_id   uuid references public.profiles (id) on delete set null,
  audiences   public.announcement_audience[] not null check (cardinality(audiences) > 0),
  priority    public.announcement_priority not null default 'routine',
  body        text not null check (length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index on public.announcements (event_id, created_at desc);

-- =============================================================================
-- Permission helpers. SECURITY DEFINER so they can be used inside RLS policies
-- without recursive policy evaluation.
-- =============================================================================
create or replace function public.is_org_admin(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org and user_id = auth.uid()
  );
$$;

-- Account Host for the event's organization.
create or replace function public.is_event_admin(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e
    join organization_members m on m.organization_id = e.organization_id
    where e.id = ev and m.user_id = auth.uid()
  );
$$;

-- Host or Volunteer Director: full volunteer access, always.
create or replace function public.can_manage_volunteers(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev) or exists (
    select 1 from event_staff
    where event_id = ev and user_id = auth.uid() and role = 'volunteer_director'
  );
$$;

create or replace function public.is_event_staff(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev) or exists (
    select 1 from event_staff where event_id = ev and user_id = auth.uid()
  );
$$;

create or replace function public.leads_station(st uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from stations where id = st and lead_user_id = auth.uid());
$$;

-- True on the event's calendar day(s), evaluated in the event's own time zone.
-- This is the "day-of-event gatekeeper" from PRD §6.2.
create or replace function public.is_event_day(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events
    where id = ev
      and (now() at time zone timezone)::date between starts_on and ends_on
  );
$$;

create or replace function public.current_email()
returns citext
language sql stable
as $$
  select nullif(auth.jwt() ->> 'email', '')::citext;
$$;

create or replace function public.org_has_active_plan(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from organizations
    where id = org
      and subscription_status in ('trialing', 'active', 'comped', 'past_due')
  );
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.organizations          enable row level security;
alter table public.organization_members   enable row level security;
alter table public.events                 enable row level security;
alter table public.event_staff            enable row level security;
alter table public.stations               enable row level security;
alter table public.shifts                 enable row level security;
alter table public.volunteers             enable row level security;
alter table public.volunteer_assignments  enable row level security;
alter table public.bands                  enable row level security;
alter table public.performance_slots      enable row level security;
alter table public.announcements          enable row level security;

-- profiles: you can see and edit yourself; hosts can see their org's people.
create policy "profiles: read self" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Note: other people's contact details are exposed only via the functions below.

-- organizations
create policy "orgs: members read" on public.organizations
  for select to authenticated using (public.is_org_admin(id));
create policy "orgs: owners update name" on public.organizations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));
-- Billing columns may only be written by the Stripe webhook (service role).
revoke insert, update on public.organizations from anon, authenticated;
grant update (name, default_timezone) on public.organizations to authenticated;
-- Organizations are created through create_organization().

create policy "org members: read" on public.organization_members
  for select to authenticated using (public.is_org_admin(organization_id));

-- events: published events are public; staff see their own drafts.
create policy "events: public read published" on public.events
  for select to anon, authenticated using (status = 'published');
create policy "events: staff read" on public.events
  for select to authenticated using (public.is_event_staff(id));
create policy "events: hosts insert" on public.events
  for insert to authenticated
  with check (public.is_org_admin(organization_id) and public.org_has_active_plan(organization_id));
create policy "events: hosts update" on public.events
  for update to authenticated
  using (public.is_event_admin(id)) with check (public.is_org_admin(organization_id));
create policy "events: hosts delete" on public.events
  for delete to authenticated using (public.is_event_admin(id));

-- event_staff
create policy "staff: staff read" on public.event_staff
  for select to authenticated using (public.is_event_staff(event_id));
create policy "staff: hosts manage" on public.event_staff
  for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "staff: directors add section leads" on public.event_staff
  for insert to authenticated
  with check (role = 'section_lead' and public.can_manage_volunteers(event_id));

-- stations: public can see names/locations of published events (for the
-- signup form); staff see everything.
create policy "stations: public read" on public.stations
  for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy "stations: staff read" on public.stations
  for select to authenticated using (public.is_event_staff(event_id));
create policy "stations: managers write" on public.stations
  for all to authenticated
  using (public.can_manage_volunteers(event_id)) with check (public.can_manage_volunteers(event_id));

-- shifts
create policy "shifts: public read" on public.shifts
  for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy "shifts: staff read" on public.shifts
  for select to authenticated using (public.is_event_staff(event_id));
create policy "shifts: managers write" on public.shifts
  for all to authenticated
  using (public.can_manage_volunteers(event_id)) with check (public.can_manage_volunteers(event_id));
-- Column-level grants: registered_count is never writable by users.
revoke insert, update on public.shifts from anon, authenticated;
grant insert (id, station_id, title, description, starts_at, ends_at, max_capacity) on public.shifts to authenticated;
grant update (station_id, title, description, starts_at, ends_at, max_capacity) on public.shifts to authenticated;

-- volunteers: Hosts/Directors see all; a volunteer sees their own rows.
-- Section Leads get NO direct access; they use station_roster().
create policy "volunteers: managers all" on public.volunteers
  for all to authenticated
  using (public.can_manage_volunteers(event_id)) with check (public.can_manage_volunteers(event_id));
create policy "volunteers: read self" on public.volunteers
  for select to authenticated using (email = public.current_email());

create policy "assignments: managers all" on public.volunteer_assignments
  for all to authenticated
  using (exists (select 1 from public.shifts s where s.id = shift_id and public.can_manage_volunteers(s.event_id)))
  with check (exists (select 1 from public.shifts s where s.id = shift_id and public.can_manage_volunteers(s.event_id)));
create policy "assignments: read self" on public.volunteer_assignments
  for select to authenticated
  using (exists (select 1 from public.volunteers v where v.id = volunteer_id and v.email = public.current_email()));
-- Inserts/deletes that change capacity must go through the functions below.
revoke insert, update, delete on public.volunteer_assignments from anon, authenticated;
grant update (checked_in_at, checked_in_by) on public.volunteer_assignments to authenticated;

-- bands: a director manages their own band; hosts see all; checkpoint leads
-- see bands of their event.
create policy "bands: director read own" on public.bands
  for select to authenticated using (director_user_id = auth.uid());
create policy "bands: staff read" on public.bands
  for select to authenticated using (public.is_event_staff(event_id));
create policy "bands: director register" on public.bands
  for insert to authenticated
  with check (
    director_user_id = auth.uid()
    and exists (select 1 from public.events e
                where e.id = event_id and e.status = 'published' and e.band_registration_open)
  );
create policy "bands: director update own" on public.bands
  for update to authenticated
  using (director_user_id = auth.uid()) with check (director_user_id = auth.uid());
create policy "bands: hosts all" on public.bands
  for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
-- Column-level grants: status is only changed by set_band_status(), and a band
-- can't be moved to another event or director.
revoke insert, update on public.bands from anon, authenticated;
grant insert (id, event_id, director_user_id, school_name, band_name, classification, school_address,
              contact_email, head_director_name, head_director_email, head_director_phone,
              assistant_directors, student_count, chaperone_count, bus_count, box_truck_count,
              truck_trailer_count, semi_truck_count, contest_day_conflicts, special_needs)
  on public.bands to authenticated;
grant update (school_name, band_name, classification, school_address,
              contact_email, head_director_name, head_director_email, head_director_phone,
              assistant_directors, student_count, chaperone_count, bus_count, box_truck_count,
              truck_trailer_count, semi_truck_count, contest_day_conflicts, special_needs)
  on public.bands to authenticated;

-- performance_slots: public/directors only once published; hosts always.
create policy "slots: read when published" on public.performance_slots
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_id and e.status = 'published' and e.performance_order_published));
create policy "slots: staff read" on public.performance_slots
  for select to authenticated using (public.is_event_staff(event_id));
create policy "slots: hosts write" on public.performance_slots
  for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- announcements
create policy "announcements: public read" on public.announcements
  for select to anon, authenticated
  using ('public' = any (audiences)
         and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy "announcements: staff read" on public.announcements
  for select to authenticated using (public.is_event_staff(event_id));
create policy "announcements: volunteers read" on public.announcements
  for select to authenticated
  using ('volunteers' = any (audiences)
         and exists (select 1 from public.volunteers v
                     where v.event_id = announcements.event_id and v.email = public.current_email()));
create policy "announcements: band directors read" on public.announcements
  for select to authenticated
  using ('band_directors' = any (audiences)
         and exists (select 1 from public.bands b
                     where b.event_id = announcements.event_id and b.director_user_id = auth.uid()));
-- Hosts can send to anyone; Volunteer Directors to volunteers and leads only.
create policy "announcements: hosts send" on public.announcements
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_event_admin(event_id));
create policy "announcements: directors send" on public.announcements
  for insert to authenticated
  with check (sender_id = auth.uid()
              and public.can_manage_volunteers(event_id)
              and audiences <@ array['volunteers','section_leads']::public.announcement_audience[]);

-- =============================================================================
-- Functions (the only way to do the sensitive operations)
-- =============================================================================

-- Create an organization and make the caller its owner.
create or replace function public.create_organization(org_name text, org_slug text, tz text default 'America/Chicago')
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  insert into organizations (name, slug, default_timezone)
  values (org_name, org_slug, tz)
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, auth.uid(), 'owner');
  return org;
end;
$$;

-- Public volunteer signup (PRD §4.1, §6.3). All-or-nothing: either every
-- requested shift is booked or none are. Each shift row is locked FOR UPDATE,
-- in a fixed order to avoid deadlocks, so two people can never both take the
-- last slot.
create or replace function public.register_volunteer(
  p_event_id   uuid,
  p_full_name  text,
  p_email      text,
  p_phone      text,
  p_shift_ids  uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev        public.events;
  vol_id    uuid;
  sh        public.shifts;
begin
  select * into ev from events where id = p_event_id;
  if ev.id is null or ev.status <> 'published' or not ev.volunteer_signup_open then
    raise exception 'Volunteer signup is not open for this event' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 then
    raise exception 'Pick at least one shift' using errcode = 'P0001';
  end if;

  insert into volunteers (event_id, full_name, email, phone)
  values (p_event_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone))
  on conflict (event_id, email)
    do update set full_name = excluded.full_name, phone = excluded.phone
  returning id into vol_id;

  for sh in
    select * from shifts
    where id = any (p_shift_ids) and event_id = p_event_id
    order by id
    for update
  loop
    if exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = vol_id) then
      continue; -- already booked; signing up twice is harmless
    end if;
    if sh.registered_count >= sh.max_capacity then
      raise exception 'Sorry, "%" just filled up. Please pick another shift.', sh.title
        using errcode = 'P0002';
    end if;
    if exists (
      select 1 from volunteer_assignments a
      join shifts s2 on s2.id = a.shift_id
      where a.volunteer_id = vol_id
        and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(sh.starts_at, sh.ends_at)
    ) then
      raise exception '"%" overlaps with another shift you signed up for.', sh.title
        using errcode = 'P0003';
    end if;

    insert into volunteer_assignments (shift_id, volunteer_id) values (sh.id, vol_id);
    update shifts set registered_count = registered_count + 1 where id = sh.id;
  end loop;

  if (select count(*) from shifts where id = any (p_shift_ids) and event_id = p_event_id)
     <> cardinality(array(select distinct unnest(p_shift_ids))) then
    raise exception 'One of the selected shifts does not exist' using errcode = 'P0001';
  end if;

  return vol_id;
end;
$$;

-- Remove an assignment and give the slot back. Callable by managers, or by the
-- volunteer themself (matched on verified email).
create or replace function public.cancel_assignment(p_assignment_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a   record;
begin
  select va.id, va.shift_id, s.event_id, v.email
    into a
    from volunteer_assignments va
    join shifts s on s.id = va.shift_id
    join volunteers v on v.id = va.volunteer_id
   where va.id = p_assignment_id;

  if a.id is null then
    raise exception 'Assignment not found' using errcode = 'P0001';
  end if;
  if not (public.can_manage_volunteers(a.event_id) or a.email = public.current_email()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  perform 1 from shifts where id = a.shift_id for update;
  delete from volunteer_assignments where id = a.id;
  update shifts set registered_count = registered_count - 1 where id = a.shift_id;
end;
$$;

-- Station roster for Section Leads (PRD §6.2). Names and shifts are always
-- visible to the lead; phone and email only on the event's calendar day(s).
-- Hosts and Volunteer Directors always get contact details.
create or replace function public.station_roster(p_station_id uuid)
returns table (
  assignment_id   uuid,
  shift_id        uuid,
  shift_title     text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  volunteer_name  text,
  email           text,
  phone           text,
  checked_in_at   timestamptz,
  contact_locked  boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  ev_id       uuid;
  show_pii    boolean;
begin
  select event_id into ev_id from stations where id = p_station_id;
  if ev_id is null then
    raise exception 'Station not found' using errcode = 'P0001';
  end if;

  if public.can_manage_volunteers(ev_id) then
    show_pii := true;
  elsif public.leads_station(p_station_id) then
    show_pii := public.is_event_day(ev_id);
  else
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
    select va.id, s.id, s.title, s.starts_at, s.ends_at, v.full_name,
           case when show_pii then v.email::text end,
           case when show_pii then v.phone end,
           va.checked_in_at,
           not show_pii
      from shifts s
      join volunteer_assignments va on va.shift_id = s.id
      join volunteers v on v.id = va.volunteer_id
     where s.station_id = p_station_id
     order by s.starts_at, v.full_name;
end;
$$;

-- A volunteer's consolidated agenda across every event, with their Section
-- Lead's contact details (PRD §2, Volunteers).
create or replace function public.my_agenda()
returns table (
  assignment_id   uuid,
  event_id        uuid,
  event_name      text,
  venue_address   text,
  station_name    text,
  station_location text,
  instructions    text,
  shift_title     text,
  shift_description text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  lead_name       text,
  lead_phone      text,
  lead_email      text,
  checked_in_at   timestamptz
)
language sql stable security definer set search_path = public
as $$
  select va.id, e.id, e.name, e.venue_address, st.name, st.location, st.instructions,
         s.title, s.description, s.starts_at, s.ends_at,
         p.full_name, p.phone, p.email::text, va.checked_in_at
    from volunteers v
    join volunteer_assignments va on va.volunteer_id = v.id
    join shifts s on s.id = va.shift_id
    join stations st on st.id = s.station_id
    join events e on e.id = v.event_id
    left join profiles p on p.id = st.lead_user_id
   where v.email = public.current_email()
   order by s.starts_at;
$$;

-- Check a volunteer in at the main desk (PRD §4.2).
create or replace function public.check_in_volunteer(p_assignment_id uuid, p_checked_in boolean default true)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev_id uuid;
begin
  select s.event_id into ev_id
    from volunteer_assignments va join shifts s on s.id = va.shift_id
   where va.id = p_assignment_id;
  if ev_id is null or not public.can_manage_volunteers(ev_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update volunteer_assignments
     set checked_in_at = case when p_checked_in then now() end,
         checked_in_by = case when p_checked_in then auth.uid() end
   where id = p_assignment_id;
end;
$$;

-- Move a band through an active checkpoint (PRD §4.3). Allowed for Hosts,
-- Volunteer Directors and leads of an active checkpoint at the same event.
create or replace function public.set_band_status(p_band_id uuid, p_status public.band_status)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ev_id uuid;
begin
  select event_id into ev_id from bands where id = p_band_id;
  if ev_id is null then
    raise exception 'Band not found' using errcode = 'P0001';
  end if;
  if not (
    public.can_manage_volunteers(ev_id)
    or exists (select 1 from stations
               where event_id = ev_id and station_type = 'active_checkpoint'
                 and lead_user_id = auth.uid())
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update bands set status = p_status, status_updated_at = now() where id = p_band_id;
end;
$$;

-- Lock down function execution. Postgres grants EXECUTE to PUBLIC by default.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_org_admin(uuid),
                          public.is_event_admin(uuid),
                          public.can_manage_volunteers(uuid),
                          public.is_event_staff(uuid),
                          public.leads_station(uuid),
                          public.is_event_day(uuid),
                          public.current_email(),
                          public.org_has_active_plan(uuid),
                          public.create_organization(text, text, text),
                          public.cancel_assignment(uuid),
                          public.station_roster(uuid),
                          public.my_agenda(),
                          public.check_in_volunteer(uuid, boolean),
                          public.set_band_status(uuid, public.band_status)
  to authenticated;
-- Signup is called from our server (which adds bot protection), never directly
-- from the browser.
grant execute on function public.register_volunteer(uuid, text, text, text, uuid[]) to service_role;
grant execute on function public.current_email() to anon;

-- Live updates for logged-in dashboards. (The public spectator page polls a
-- cached endpoint instead, so a stadium full of phones can't exhaust realtime
-- connection limits.)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.announcements,
                                                  public.volunteer_assignments,
                                                  public.bands;
  end if;
end;
$$;
