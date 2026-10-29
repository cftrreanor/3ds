-- =============================================================================
-- Signing up a group, each person on their own shifts.
--   * One person (the booker) signs up themselves plus up to 6 others. Each
--     added person picks their own shifts ("Same shifts as you" is one choice)
--     and is their own volunteer, linked to the booker by contact_id, with
--     their own optional email and phone, and their own private link
--     (access_token) to see, switch, or cancel only their own shifts.
--   * Shifts can be adults only, or have a minimum age (for minors). A minor's
--     age is kept (5-17) so the minimum can be checked; adults always qualify.
--     A minor with no age on file can't take a shift with a minimum age.
--   * minor_consents: when anyone in the group is under 18, the booker ticks
--     "I confirm I am this volunteer's parent or legal guardian, or have their
--     permission to sign them up." Each minor gets a permanent record of it:
--     who ticked it, when, and the exact words shown. It can never be edited
--     or deleted, and it outlives the volunteer list (no foreign keys).
--   * swap_shift_with_pass(): a volunteer switches one of their shifts to
--     another (their own link). volunteer_changes notes it for the daily
--     summary, like volunteer_dropped_shifts does for cancellations.
--   * volunteer_digest_prefs: what each person's daily volunteer summary
--     includes (new sign-ups, changes, cancellations). Each person sets their
--     own; hosts can set anyone's on their event.
--   * station_roster() also says whether a guardian confirmed for a minor.
-- =============================================================================

-- Adults-only shifts, and a minimum age for minors.
alter table public.shifts
  add column adults_only boolean not null default false,
  add column min_age smallint check (min_age between 5 and 17);
grant insert (adults_only, min_age), update (adults_only, min_age) on public.shifts to authenticated;

-- A minor's age, when we were told it.
alter table public.volunteers
  add column age smallint check (age is null or (minor and age between 5 and 17));
grant select (age) on public.volunteers to authenticated;

-- Why a person can't take a shift ("Adults only", "Ages 16 and up"), or null when they can.
create function public.shift_ineligible(p_shift_id uuid, p_minor boolean, p_age int)
returns text
language sql stable security definer set search_path = public
as $$
  select case
           when not coalesce(p_minor, false) then null
           when s.adults_only or st.adults_only then 'Adults only'
           when s.min_age is not null and (p_age is null or p_age < s.min_age) then 'Ages ' || s.min_age || ' and up'
         end
    from shifts s join stations st on st.id = s.station_id
   where s.id = p_shift_id;
$$;
revoke execute on function public.shift_ineligible(uuid, boolean, int) from public, anon;
grant execute on function public.shift_ineligible(uuid, boolean, int) to authenticated, service_role;

-- Same as before, with the shift's own adults-only switch and minimum age.
create or replace function public.book_group(p_event_id uuid, p_people uuid[], p_shift_ids uuid[], p_check_in boolean, p_over_capacity boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sh       public.shifts;
  person   uuid;
  needed   int;
  who      text;
  why      text;
begin
  for sh in
    select * from shifts
    where id = any (p_shift_ids) and event_id = p_event_id
    order by id
    for update
  loop
    select count(*) into needed from unnest(p_people) p
     where not exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = p);
    continue when needed = 0; -- already booked; signing up twice is harmless
    if sh.registered_count + needed > sh.max_capacity then
      if p_over_capacity then
        update shifts set max_capacity = registered_count + needed where id = sh.id;
      elsif sh.registered_count >= sh.max_capacity then
        raise exception 'Sorry, "%" just filled up. Please pick another shift.', sh.title using errcode = 'P0002';
      else
        raise exception 'Only % left in "%" for your group of %. Please pick another shift.',
          case when sh.max_capacity - sh.registered_count = 1 then '1 spot' else (sh.max_capacity - sh.registered_count) || ' spots' end,
          sh.title, needed
          using errcode = 'P0002';
      end if;
    end if;
    foreach person in array p_people loop
      continue when exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = person);
      select public.shift_ineligible(sh.id, v.minor, v.age), case when v.contact_id is null then 'You' else v.full_name end
        into why, who
        from volunteers v where v.id = person;
      if why = 'Adults only' then
        raise exception '"%" is for adults only (18+). % can''t sign up for it.', sh.title, who using errcode = 'P0005';
      elsif why is not null then
        raise exception '"%" is for ages % and up. % can''t sign up for it.', sh.title, sh.min_age, who using errcode = 'P0005';
      end if;
      if exists (
        select 1 from volunteer_assignments a
        join shifts s2 on s2.id = a.shift_id
        where a.volunteer_id = person
          and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(sh.starts_at, sh.ends_at)
      ) then
        select case when v.contact_id is null then 'you' else v.full_name end into who from volunteers v where v.id = person;
        raise exception '"%" overlaps with another shift % signed up for.', sh.title, who using errcode = 'P0003';
      end if;
      insert into volunteer_assignments (shift_id, volunteer_id, checked_in_at, checked_in_by)
      values (sh.id, person, case when p_check_in then now() end, case when p_check_in then auth.uid() end);
    end loop;
    update shifts set registered_count = registered_count + needed where id = sh.id;
  end loop;

  if (select count(*) from shifts where id = any (p_shift_ids) and event_id = p_event_id)
     <> cardinality(array(select distinct unnest(p_shift_ids))) then
    raise exception 'One of the selected shifts does not exist' using errcode = 'P0001';
  end if;
end;
$$;

-- The sign-up page's call, now with a minor's age (kept on a new sign-up, or
-- filled in when missing; an existing volunteer's other details stay).
drop function public.sign_up_volunteer(uuid, text, text, text, uuid[], boolean, jsonb, jsonb);
create function public.sign_up_volunteer(
  p_event_id    uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text,
  p_shift_ids   uuid[],
  p_minor       boolean default false,
  p_companions  jsonb default '[]',
  p_items       jsonb default '[]',
  p_age         int default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev        public.events;
  vol_id    uuid;
  vol_phone text;
  pick      jsonb;
  it        public.station_items;
  v_note    text;
begin
  select * into ev from events where id = p_event_id;
  if ev.id is null or ev.status <> 'published' or not ev.volunteer_signup_open then
    raise exception 'Volunteer signup is not open for this event' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 and coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'Pick at least one shift or item' using errcode = 'P0001';
  end if;
  -- People bring as many things as they like; this only stops a script sending thousands.
  if coalesce(jsonb_array_length(p_items), 0) > 200 then
    raise exception 'Too many items in one sign-up' using errcode = 'P0001';
  end if;
  if coalesce(p_minor, false) and p_age is not null and p_age not between 5 and 17 then
    raise exception 'Please enter an age from 5 to 17 for anyone under 18.' using errcode = 'P0001';
  end if;

  insert into volunteers (event_id, full_name, email, phone, minor, age)
  values (p_event_id,
          case when p_minor then public.minor_name(p_full_name) else trim(p_full_name) end,
          lower(trim(p_email)), trim(p_phone), coalesce(p_minor, false),
          case when p_minor then p_age end)
  -- An existing volunteer's name and phone are kept: the public form can't
  -- prove who is typing, so it mustn't overwrite someone else's details.
  on conflict (event_id, email)
    do update set age = case when volunteers.minor then coalesce(volunteers.age, excluded.age) end
  returning id, phone into vol_id, vol_phone;

  if coalesce(cardinality(p_shift_ids), 0) > 0 then
    perform public.book_group(
      p_event_id,
      array[vol_id] || public.signup_companions(p_event_id, vol_id, vol_phone, p_companions, false),
      p_shift_ids, false, false);
  end if;

  for pick in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    select i.* into it from station_items i
      where i.id = (pick->>'item')::uuid and i.event_id = p_event_id
      for update;
    if it.id is null then
      raise exception 'One of the selected items does not exist' using errcode = 'P0001';
    end if;
    v_note := nullif(left(trim(coalesce(pick->>'note', '')), 200), '');
    if exists (select 1 from item_signups s where s.item_id = it.id and s.volunteer_id = vol_id) then
      update item_signups set note = coalesce(v_note, note) where item_id = it.id and volunteer_id = vol_id;
    elsif it.claimed_count >= it.needed then
      raise exception 'Sorry, "%" is already covered. Please pick something else.', it.name using errcode = 'P0002';
    else
      insert into item_signups (item_id, event_id, volunteer_id, note) values (it.id, p_event_id, vol_id, v_note);
    end if;
  end loop;
  return vol_id;
end;
$$;
revoke execute on function public.sign_up_volunteer(uuid, text, text, text, uuid[], boolean, jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.sign_up_volunteer(uuid, text, text, text, uuid[], boolean, jsonb, jsonb, int) to service_role;

-- The guardian's tick for each minor: permanent, never edited or deleted.
create table public.minor_consents (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null,
  event_name           text not null,
  volunteer_id         uuid not null,
  minor_name           text not null,
  booker_volunteer_id  uuid not null,
  booker_name          text not null,
  booker_email         text not null,
  wording              text not null check (char_length(wording) between 20 and 500),
  consented_at         timestamptz not null default now(),
  timezone             text not null
);
create index on public.minor_consents (event_id);
create index on public.minor_consents (volunteer_id);
alter table public.minor_consents enable row level security;
revoke all on public.minor_consents from anon, authenticated;
grant select on public.minor_consents to authenticated;
grant select, insert on public.minor_consents to service_role;
-- The event's hosts and Volunteer Leads can see it; no one can write it but sign_up_group().
create policy "minor consents: event team reads" on public.minor_consents
  for select to authenticated using (public.can_manage_volunteers(event_id));

create function public.minor_consents_frozen()
returns trigger
language plpgsql set search_path = public
as $$
begin
  raise exception 'A guardian''s confirmation is a permanent record and can''t be changed or deleted.' using errcode = '42501';
end;
$$;
revoke execute on function public.minor_consents_frozen() from public, anon, authenticated;
create trigger minor_consents_frozen before update or delete on public.minor_consents
  for each row execute function public.minor_consents_frozen();
create trigger minor_consents_no_truncate before truncate on public.minor_consents
  for each statement execute function public.minor_consents_frozen();

-- The sign-up page's call for a group: the booker (as sign_up_volunteer), then
-- each added person on their own shifts, all together or not at all.
-- p_people: [{"name", "minor", "age", "email", "phone", "shift_ids": [...]}, ...]
-- p_consent: the exact guardian wording shown, required when anyone is a minor.
create function public.sign_up_group(
  p_event_id   uuid,
  p_full_name  text,
  p_email      text,
  p_phone      text,
  p_shift_ids  uuid[],
  p_minor      boolean default false,
  p_age        int default null,
  p_items      jsonb default '[]',
  p_people     jsonb default '[]',
  p_consent    text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  ev         public.events;
  booker     public.volunteers;
  p          jsonb;
  is_min     boolean;
  nm         text;
  em         text;
  ph         text;
  ag         int;
  shift_ids  uuid[];
  pid        uuid;
  ids        uuid[] := '{}';
  minors     uuid[] := '{}';
  m          public.volunteers;
begin
  if jsonb_typeof(coalesce(p_people, '[]')) <> 'array' then
    raise exception 'Something went wrong. Please try again.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_people, '[]')) > 6 then
    raise exception 'You can sign up yourself and up to 6 other people.' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_shift_ids), 0) = 0 and jsonb_array_length(coalesce(p_people, '[]')) > 0 then
    raise exception 'Pick a shift for yourself first.' using errcode = 'P0001';
  end if;
  if (coalesce(p_minor, false) or exists (select 1 from jsonb_array_elements(coalesce(p_people, '[]')) x
                                           where coalesce((x ->> 'minor')::boolean, false)))
     and char_length(trim(coalesce(p_consent, ''))) < 20 then
    raise exception 'Please confirm you''re the parent or legal guardian of everyone under 18, or have their permission.' using errcode = 'P0006';
  end if;

  pid := public.sign_up_volunteer(p_event_id, p_full_name, p_email, p_phone, p_shift_ids, p_minor, '[]', p_items, p_age);
  select * into booker from volunteers where id = pid;
  select * into ev from events where id = p_event_id;
  if booker.minor then
    minors := minors || booker.id;
  end if;

  for p in select * from jsonb_array_elements(coalesce(p_people, '[]')) loop
    is_min := coalesce((p ->> 'minor')::boolean, false);
    nm := regexp_replace(trim(coalesce(p ->> 'name', '')), '\s+', ' ', 'g');
    if is_min then
      nm := public.minor_name(nm);
    end if;
    if length(nm) not between 1 and 200 then
      raise exception 'Please enter a name for everyone you''re adding.' using errcode = 'P0001';
    end if;
    em := nullif(lower(trim(coalesce(p ->> 'email', ''))), '');
    ph := coalesce(nullif(trim(coalesce(p ->> 'phone', '')), ''), booker.phone);
    ag := case when is_min then nullif(p ->> 'age', '')::int end;
    if ag is not null and ag not between 5 and 17 then
      raise exception 'Please enter an age from 5 to 17 for %.', nm using errcode = 'P0001';
    end if;
    if em is not null and em = booker.email::text then
      raise exception 'You''re already in this sign-up. Use a different email for %, or leave it blank.', nm using errcode = 'P0001';
    end if;
    select coalesce(array_agg(distinct x::uuid), '{}') into shift_ids from jsonb_array_elements_text(coalesce(p -> 'shift_ids', '[]')) x;
    if cardinality(shift_ids) = 0 then
      raise exception 'Pick at least one shift for %.', nm using errcode = 'P0001';
    end if;

    pid := null;
    if em is not null then
      -- Someone already on this event's list stays as they are; they're told by email.
      select id into pid from volunteers where event_id = p_event_id and email = em;
    else
      -- Signing up again with the same person reuses them.
      select id into pid from volunteers
       where contact_id = booker.id and email is null and lower(full_name) = lower(nm)
       limit 1;
    end if;
    if pid is null then
      insert into volunteers (event_id, full_name, email, phone, minor, age, contact_id)
      values (p_event_id, nm, em, ph, is_min, ag, booker.id)
      returning id into pid;
    end if;
    if pid = booker.id or pid = any (ids) then
      raise exception 'You added % twice.', nm using errcode = 'P0001';
    end if;
    ids := ids || pid;
    perform public.book_group(p_event_id, array[pid], shift_ids, false, false);
    if is_min then
      minors := minors || pid;
    end if;
  end loop;

  for m in select * from volunteers where id = any (minors) loop
    insert into minor_consents (event_id, event_name, volunteer_id, minor_name, booker_volunteer_id,
                                booker_name, booker_email, wording, timezone)
    values (p_event_id, ev.name, m.id, m.full_name, booker.id, booker.full_name, booker.email, trim(p_consent), ev.timezone);
  end loop;

  return jsonb_build_object('booker', booker.id, 'people', to_jsonb(ids));
end;
$$;
revoke execute on function public.sign_up_group(uuid, text, text, text, uuid[], boolean, int, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.sign_up_group(uuid, text, text, text, uuid[], boolean, int, jsonb, jsonb, text) to service_role;

-- Switched shifts, for the daily summary (no foreign keys, like volunteer_dropped_shifts).
create table public.volunteer_changes (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null,
  volunteer_id   uuid not null,
  full_name      text not null,
  from_shift_id  uuid not null,
  to_shift_id    uuid not null,
  changed_at     timestamptz not null default now()
);
create index on public.volunteer_changes (event_id, changed_at);
alter table public.volunteer_changes enable row level security;
revoke all on public.volunteer_changes from anon, authenticated;
grant select, insert, delete on public.volunteer_changes to service_role;

-- A volunteer moves one of their shifts to another, with their own link.
-- Checks the new shift like a sign-up does; the old spot opens up.
create function public.swap_shift_with_pass(
  p_assignment_id uuid, p_new_shift_id uuid, p_volunteer_tokens uuid[], p_assignment_tokens uuid[]
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a       record;
  ev      public.events;
  sh      public.shifts;
  why     text;
begin
  select va.id, va.shift_id, va.volunteer_id, v.full_name, v.minor, v.age, s.event_id into a
    from volunteer_assignments va
    join volunteers v on v.id = va.volunteer_id
    join shifts s on s.id = va.shift_id
   where va.id = p_assignment_id
     and (v.access_token = any (coalesce(p_volunteer_tokens, '{}'))
          or va.manage_token = any (coalesce(p_assignment_tokens, '{}')));
  if a.id is null then
    return false;
  end if;
  if a.shift_id = p_new_shift_id then
    return true;
  end if;
  select * into ev from events where id = a.event_id;
  if ev.status <> 'published' or not ev.volunteer_signup_open then
    raise exception 'Volunteer signup is closed, so shifts can''t be switched. Contact the organizers.' using errcode = 'P0001';
  end if;

  -- Lock both shifts in a fixed order, like book_group.
  perform 1 from shifts where id in (a.shift_id, p_new_shift_id) order by id for update;
  select * into sh from shifts where id = p_new_shift_id and event_id = a.event_id;
  if sh.id is null then
    raise exception 'That shift isn''t part of this event.' using errcode = 'P0001';
  end if;
  if exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = a.volunteer_id) then
    raise exception 'You''re already signed up for "%".', sh.title using errcode = 'P0001';
  end if;
  if sh.registered_count >= sh.max_capacity then
    raise exception 'Sorry, "%" just filled up. Please pick another shift.', sh.title using errcode = 'P0002';
  end if;
  why := public.shift_ineligible(sh.id, a.minor, a.age);
  if why is not null then
    raise exception '"%" is %.', sh.title, lower(why) using errcode = 'P0005';
  end if;
  if exists (
    select 1 from volunteer_assignments x
    join shifts s2 on s2.id = x.shift_id
    where x.volunteer_id = a.volunteer_id and x.id <> a.id
      and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(sh.starts_at, sh.ends_at)
  ) then
    raise exception '"%" overlaps with another shift you signed up for.', sh.title using errcode = 'P0003';
  end if;

  update volunteer_assignments set shift_id = sh.id, checked_in_at = null, checked_in_by = null where id = a.id;
  update shifts set registered_count = registered_count - 1 where id = a.shift_id;
  update shifts set registered_count = registered_count + 1 where id = sh.id;
  insert into volunteer_changes (event_id, volunteer_id, full_name, from_shift_id, to_shift_id)
  values (a.event_id, a.volunteer_id, a.full_name, a.shift_id, sh.id);
  return true;
end;
$$;
revoke execute on function public.swap_shift_with_pass(uuid, uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.swap_shift_with_pass(uuid, uuid, uuid[], uuid[]) to service_role;

-- The daily job also forgets switched shifts after a week.
create or replace function public.purge_dropped_shifts()
returns int
language sql security definer set search_path = public
as $$
  with gone as (delete from volunteer_dropped_shifts where dropped_at < now() - interval '7 days' returning 1),
       moved as (delete from volunteer_changes where changed_at < now() - interval '7 days' returning 1)
  select ((select count(*) from gone) + (select count(*) from moved))::int;
$$;

-- What each person's daily volunteer summary includes. No row: everything.
create table public.volunteer_digest_prefs (
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  new_bookings   boolean not null default true,
  changes        boolean not null default true,
  cancellations  boolean not null default true,
  updated_at     timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.volunteer_digest_prefs enable row level security;
revoke all on public.volunteer_digest_prefs from anon, authenticated;
grant select on public.volunteer_digest_prefs to authenticated;
grant insert (event_id, user_id, new_bookings, changes, cancellations, updated_at) on public.volunteer_digest_prefs to authenticated;
grant update (new_bookings, changes, cancellations, updated_at) on public.volunteer_digest_prefs to authenticated;
grant select, insert, update, delete on public.volunteer_digest_prefs to service_role;
-- Your own, on an event you run volunteers for; hosts, anyone's on their event.
create policy "digest prefs: read own or as host" on public.volunteer_digest_prefs
  for select to authenticated
  using ((user_id = auth.uid() and public.can_manage_volunteers(event_id)) or public.is_event_admin(event_id));
create policy "digest prefs: add own or as host" on public.volunteer_digest_prefs
  for insert to authenticated
  with check ((user_id = auth.uid() and public.can_manage_volunteers(event_id)) or public.is_event_admin(event_id));
create policy "digest prefs: edit own or as host" on public.volunteer_digest_prefs
  for update to authenticated
  using ((user_id = auth.uid() and public.can_manage_volunteers(event_id)) or public.is_event_admin(event_id))
  with check ((user_id = auth.uid() and public.can_manage_volunteers(event_id)) or public.is_event_admin(event_id));

-- Station rosters also say whether a guardian confirmed for a minor.
drop function public.station_roster(uuid);
create function public.station_roster(p_station_id uuid)
returns table (
  assignment_id       uuid,
  shift_id            uuid,
  shift_title         text,
  starts_at           timestamptz,
  ends_at             timestamptz,
  volunteer_name      text,
  email               text,
  phone               text,
  checked_in_at       timestamptz,
  contact_locked      boolean,
  minor               boolean,
  signed_up_by        text,
  guardian_confirmed  boolean
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
           not show_pii,
           v.minor,
           c.full_name,
           v.minor and exists (select 1 from minor_consents mc where mc.volunteer_id = v.id)
      from shifts s
      join volunteer_assignments va on va.shift_id = s.id
      join volunteers v on v.id = va.volunteer_id
      left join volunteers c on c.id = v.contact_id
     where s.station_id = p_station_id
     order by s.starts_at, v.full_name;
end;
$$;
revoke execute on function public.station_roster(uuid) from public, anon;
grant execute on function public.station_roster(uuid) to authenticated;
