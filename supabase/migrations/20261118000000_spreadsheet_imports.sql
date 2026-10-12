-- =============================================================================
-- Spreadsheet imports: a host brings in registrations they already have.
--
--   * Bands and groups are NOT registered for their directors. Each row is
--     saved as a band_prefill: the director's details, kept for the director
--     whose email it names. When that director signs in (usually from the
--     host's invitation email) their registration form opens already filled
--     in, and they check it and register themselves.
--   * Volunteers: import_volunteer() signs a person (and anyone with them) up
--     for their shifts, like the public form, but for the event's hosts and
--     Volunteer Leads. A shift that's full grows to fit: these people already
--     signed up somewhere else.
--   * Parents: import_parent_registration() adds a school visit registration,
--     for the event's hosts only (it holds children's details), whether or
--     not registration is open.
-- =============================================================================

create table public.band_prefills (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events (id) on delete cascade,
  -- The head director's email: only the director signed in with it sees this.
  email                citext not null,
  school_name          text check (length(school_name) <= 150),
  band_name            text not null check (length(band_name) between 1 and 150),
  classification       text check (length(classification) <= 50),
  school_address       text check (length(school_address) <= 300),
  contact_email        citext,
  head_director_name   text check (length(head_director_name) <= 150),
  head_director_phone  text check (length(head_director_phone) <= 30),
  assistant_directors  text[] not null default '{}' check (cardinality(assistant_directors) <= 20),
  student_count        int check (student_count between 0 and 1000),
  chaperone_count      int check (chaperone_count between 0 and 500),
  bus_count            int check (bus_count between 0 and 50),
  box_truck_count      int check (box_truck_count between 0 and 20),
  truck_trailer_count  int check (truck_trailer_count between 0 and 20),
  semi_truck_count     int check (semi_truck_count between 0 and 20),
  special_needs        text check (length(special_needs) <= 2000),
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (event_id, email, band_name)
);
create index on public.band_prefills (event_id);

alter table public.band_prefills enable row level security;
revoke all on public.band_prefills from anon, authenticated;
grant select, delete on public.band_prefills to authenticated;
grant insert (event_id, email, school_name, band_name, classification, school_address, contact_email,
              head_director_name, head_director_phone, assistant_directors, student_count, chaperone_count,
              bus_count, box_truck_count, truck_trailer_count, semi_truck_count, special_needs, created_by)
  on public.band_prefills to authenticated;
-- Importing the same spreadsheet again updates each row in place (an upsert
-- names every column, its keys included).
grant update (event_id, email, band_name, school_name, classification, school_address, contact_email, head_director_name, head_director_phone,
              assistant_directors, student_count, chaperone_count, bus_count, box_truck_count, truck_trailer_count,
              semi_truck_count, special_needs, created_by)
  on public.band_prefills to authenticated;

-- Hosts of a band contest or group event only.
create function public.can_import_bands(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev)
     and exists (select 1 from events e where e.id = ev and e.event_type in ('band_contest', 'group_event'));
$$;

create policy "band prefills: hosts read" on public.band_prefills
  for select to authenticated using (public.is_event_admin(event_id));
create policy "band prefills: hosts add" on public.band_prefills
  for insert to authenticated with check (public.can_import_bands(event_id) and created_by = auth.uid());
create policy "band prefills: hosts update" on public.band_prefills
  for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.can_import_bands(event_id) and created_by = auth.uid());
create policy "band prefills: hosts remove" on public.band_prefills
  for delete to authenticated using (public.is_event_admin(event_id));

-- The signed-in director's saved details for this event (none for anyone else).
create function public.my_band_prefills(p_event uuid)
returns setof public.band_prefills
language sql stable security definer set search_path = public
as $$
  select * from band_prefills
   where event_id = p_event
     and public.current_email() is not null
     and email = public.current_email()
   order by band_name;
$$;
revoke execute on function public.my_band_prefills(uuid) from public, anon;
grant execute on function public.my_band_prefills(uuid) to authenticated;

-- Saved details are only for registering: they go once the event is over.
create function public.purge_band_prefills()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from band_prefills p using events e
     where e.id = p.event_id and (now() at time zone e.timezone)::date > e.ends_on
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_band_prefills() from public, anon, authenticated;
grant execute on function public.purge_band_prefills() to service_role;

-- One person from a volunteer spreadsheet, plus anyone signed up with them
-- ([{"name": "...", "minor": true}, ...]), on their shifts. Someone already
-- signed up with that email keeps their name and phone, and gains the shifts.
create function public.import_volunteer(
  p_event       uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text,
  p_minor       boolean,
  p_companions  jsonb,
  p_shift_ids   uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  nm      text;
  vol_id  uuid;
  ph      text;
begin
  if not public.can_manage_volunteers(p_event) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 then
    raise exception 'No shift picked.' using errcode = 'P0001';
  end if;
  nm := case when p_minor then public.minor_name(p_full_name) else regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g') end;
  if length(nm) not between 1 and 200 then
    raise exception 'Name is missing.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email isn''t valid.' using errcode = 'P0001';
  end if;

  insert into volunteers (event_id, full_name, email, phone, minor)
  values (p_event, nm, lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''), coalesce(p_minor, false))
  on conflict (event_id, email) do update set email = volunteers.email
  returning id, phone into vol_id, ph;

  perform public.book_group(
    p_event,
    array[vol_id] || public.signup_companions(p_event, vol_id, ph, coalesce(p_companions, '[]'), false),
    p_shift_ids, false, true);
  return vol_id;
end;
$$;
revoke execute on function public.import_volunteer(uuid, text, text, text, boolean, jsonb, uuid[]) from public, anon;
grant execute on function public.import_volunteer(uuid, text, text, text, boolean, jsonb, uuid[]) to authenticated;

-- One family from a parent spreadsheet. Returns the registration's link token,
-- or null when that email is already registered (nothing is changed).
create function public.import_parent_registration(
  p_event         uuid,
  p_name          text,
  p_email         text,
  p_phone         text,
  p_children      jsonb,
  p_other_adults  jsonb default '[]'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  token uuid;
begin
  if not public.is_event_admin(p_event)
     or not exists (select 1 from events where id = p_event and event_type = 'school_visit') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  p_other_adults := coalesce(p_other_adults, '[]');
  perform public.parent_registration_check(p_children, p_other_adults);
  if length(trim(coalesce(p_name, ''))) not between 2 and 200 then
    raise exception 'Parent''s name is missing.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email isn''t valid.' using errcode = 'P0001';
  end if;

  insert into parent_registrations (event_id, parent_name, email, phone, children, other_adults, adult_count)
  values (p_event, trim(p_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''),
          (select jsonb_agg(jsonb_build_object('name', trim(k ->> 'name'), 'teacher', trim(k ->> 'teacher'), 'grade', trim(k ->> 'grade')))
             from jsonb_array_elements(p_children) k),
          (select coalesce(jsonb_agg(jsonb_build_object('name', trim(a #>> '{}'), 'checked_in_at', null, 'checked_in_by', null)), '[]')
             from jsonb_array_elements(p_other_adults) a),
          1 + jsonb_array_length(p_other_adults))
  on conflict (event_id, email) do nothing
  returning access_token into token;
  return token;
end;
$$;
revoke execute on function public.import_parent_registration(uuid, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.import_parent_registration(uuid, text, text, text, jsonb, jsonb) to authenticated;
