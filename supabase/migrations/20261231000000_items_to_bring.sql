-- =============================================================================
-- Items to bring: volunteer sections without times.
--
-- A station (a section of the volunteer sign-up page) is now one of two kinds:
--   * shifts: time slots, as before (set up 5 to 6 PM);
--   * items: things to bring, each with how many are needed (a potluck's
--     Sides 8, Desserts 6, Drinks 4).
-- People sign up for both on the one sign-up page. Each item sign-up is one of
-- what's needed, with an optional note ("Brownies"); the page shows everyone
-- who's bringing what by first name, so people don't all bring brownies.
--
--   * stations.signup_kind: 'shifts' or 'items', set when the station is made.
--     It can be changed while the station is empty (no shifts, no items);
--     after that, the shifts or items have to be removed first. Shifts only
--     go in a shifts station, and a check-in station stays a shifts station.
--   * station_items: what a station needs, and how many are claimed so far
--     (claimed_count, kept by triggers on item_signups; never set by hand).
--   * item_signups: who's bringing what. Volunteer managers see them all; a
--     volunteer sees their own (by email, or with their link's tokens).
--   * sign_up_volunteer(): the sign-up page's one call for shifts and items,
--     all or nothing. register_volunteer() stays for older callers.
--   * public_item_board(): first name and note for each item, published
--     events only.
--   * pass_items / cancel_item_with_pass, my_items / cancel_my_item: a
--     volunteer's own page lists and cancels their items.
--   * A cancelled item sign-up is noted in volunteer_dropped_shifts (now with
--     item_id) for the daily summary, like a cancelled shift.
-- Item sign-ups go with the volunteer (deleted 10 days after the event).
-- =============================================================================

alter table public.stations
  add column signup_kind text not null default 'shifts' check (signup_kind in ('shifts', 'items'));
grant insert (signup_kind) on public.stations to authenticated;
grant update (signup_kind) on public.stations to authenticated;

-- Switching kinds only while the station is empty, so no one's sign-up is lost.
create function public.stations_signup_kind_check()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.signup_kind = 'items' and new.checkpoint_kind is not null then
    raise exception 'A check-in stop takes time slots, not items to bring.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.signup_kind is distinct from old.signup_kind
     and (exists (select 1 from shifts where station_id = new.id)
          or exists (select 1 from station_items where station_id = new.id)) then
    raise exception 'To change what people sign up for at "%", first delete its %.',
      new.name, case when old.signup_kind = 'items' then 'items' else 'shifts' end using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.stations_signup_kind_check() from public, anon, authenticated;
create trigger stations_signup_kind_check before insert or update of signup_kind, checkpoint_kind on public.stations
  for each row execute function public.stations_signup_kind_check();

-- Shifts (time slots) only go in a shifts station.
create function public.shifts_station_kind_check()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from stations where id = new.station_id and signup_kind = 'items') then
    raise exception 'This sign-up is for items to bring, so it has no time slots.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.shifts_station_kind_check() from public, anon, authenticated;
create trigger shifts_station_kind_check before insert or update of station_id on public.shifts
  for each row execute function public.shifts_station_kind_check();

create table public.station_items (
  id             uuid primary key default gen_random_uuid(),
  station_id     uuid not null references public.stations (id) on delete cascade,
  event_id       uuid not null references public.events (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 100),
  needed         int not null check (needed between 1 and 500),
  claimed_count  int not null default 0 check (claimed_count >= 0),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index on public.station_items (station_id);
create index on public.station_items (event_id);

-- An item belongs to an items station of the same event, and can't need fewer than are already coming.
create function public.station_items_check()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if not exists (select 1 from stations s where s.id = new.station_id and s.event_id = new.event_id and s.signup_kind = 'items') then
    raise exception 'Items only go in a sign-up for items to bring.' using errcode = 'P0001';
  end if;
  if new.needed < new.claimed_count then
    raise exception '% people are already bringing "%". Ask some of them to cancel first, or keep the number at % or more.',
      new.claimed_count, new.name, new.claimed_count using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger station_items_check before insert or update on public.station_items
  for each row execute function public.station_items_check();

alter table public.station_items enable row level security;
revoke all on public.station_items from anon, authenticated;
grant select on public.station_items to anon, authenticated;
grant insert (id, station_id, event_id, name, needed, sort_order) on public.station_items to authenticated;
grant update (name, needed, sort_order) on public.station_items to authenticated;
grant delete on public.station_items to authenticated;
grant select, insert, update, delete on public.station_items to service_role;
create policy "station items: public read" on public.station_items
  for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy "station items: staff read" on public.station_items
  for select to authenticated using (public.is_event_staff(event_id));
create policy "station items: managers write" on public.station_items
  for all to authenticated
  using (public.can_manage_volunteers(event_id)) with check (public.can_manage_volunteers(event_id));

create table public.item_signups (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.station_items (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  volunteer_id  uuid not null references public.volunteers (id) on delete cascade,
  note          text check (note is null or char_length(note) <= 200),
  manage_token  uuid not null default gen_random_uuid() unique,
  reminded_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (item_id, volunteer_id)
);
create index on public.item_signups (volunteer_id);
create index on public.item_signups (event_id, created_at);

alter table public.item_signups enable row level security;
revoke all on public.item_signups from anon, authenticated;
grant select, delete on public.item_signups to authenticated;
grant select, insert, update, delete on public.item_signups to service_role;
create policy "item signups: managers read" on public.item_signups
  for select to authenticated using (public.can_manage_volunteers(event_id));
create policy "item signups: managers remove" on public.item_signups
  for delete to authenticated using (public.can_manage_volunteers(event_id));
create policy "item signups: read self" on public.item_signups
  for select to authenticated
  using (exists (select 1 from public.volunteers v where v.id = volunteer_id and v.email = public.current_email()));

-- claimed_count follows the sign-ups; a cancelled one is noted for the daily summary.
alter table public.volunteer_dropped_shifts alter column shift_id drop not null;
alter table public.volunteer_dropped_shifts add column item_id uuid;

create function public.item_signups_count()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  who text;
begin
  if tg_op = 'INSERT' then
    update station_items set claimed_count = claimed_count + 1 where id = new.item_id;
    return new;
  end if;
  update station_items set claimed_count = greatest(claimed_count - 1, 0) where id = old.item_id;
  select v.full_name into who from volunteers v where v.id = old.volunteer_id;
  if who is not null and exists (select 1 from station_items i where i.id = old.item_id) then
    insert into volunteer_dropped_shifts (event_id, item_id, full_name) values (old.event_id, old.item_id, who);
  end if;
  return old;
end;
$$;
revoke execute on function public.item_signups_count() from public, anon, authenticated;
create trigger item_signups_count after insert or delete on public.item_signups
  for each row execute function public.item_signups_count();

-- The sign-up page: shifts (with anyone signing up with them) and items, in one go.
-- p_items: [{"item": "<id>", "note": "Brownies"}]. Items are for the person signing up only.
create function public.sign_up_volunteer(
  p_event_id    uuid,
  p_full_name   text,
  p_email       text,
  p_phone       text,
  p_shift_ids   uuid[],
  p_minor       boolean default false,
  p_companions  jsonb default '[]',
  p_items       jsonb default '[]'
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
  if coalesce(jsonb_array_length(p_items), 0) > 12 then
    raise exception 'Please pick 12 items or fewer' using errcode = 'P0001';
  end if;

  insert into volunteers (event_id, full_name, email, phone, minor)
  values (p_event_id,
          case when p_minor then public.minor_name(p_full_name) else trim(p_full_name) end,
          lower(trim(p_email)), trim(p_phone), coalesce(p_minor, false))
  -- An existing volunteer's name and phone are kept: the public form can't
  -- prove who is typing, so it mustn't overwrite someone else's details.
  on conflict (event_id, email)
    do update set email = volunteers.email
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
revoke execute on function public.sign_up_volunteer(uuid, text, text, text, uuid[], boolean, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sign_up_volunteer(uuid, text, text, text, uuid[], boolean, jsonb, jsonb) to service_role;

-- Who's bringing what, for the sign-up page: first names and notes only, published events only.
create function public.public_item_board(p_event_id uuid)
returns table (item_id uuid, first_name text, note text)
language sql stable security definer set search_path = public
as $$
  select s.item_id, split_part(trim(v.full_name), ' ', 1), s.note
    from item_signups s
    join volunteers v on v.id = s.volunteer_id
    join events e on e.id = s.event_id
   where s.event_id = p_event_id and e.status = 'published'
   order by s.created_at;
$$;
grant execute on function public.public_item_board(uuid) to anon, authenticated, service_role;

-- A volunteer's items, with their link's tokens (like pass_agenda) or signed in (like my_agenda).
create function public.pass_items(p_volunteer_tokens uuid[], p_item_tokens uuid[])
returns table (
  signup_id         uuid,
  manage_token      uuid,
  event_id          uuid,
  event_name        text,
  timezone          text,
  starts_on         date,
  venue_name        text,
  venue_address     text,
  station_name      text,
  station_location  text,
  instructions      text,
  item_name         text,
  note              text,
  volunteer_email   text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.manage_token, e.id, e.name, e.timezone, e.starts_on, e.venue_name, e.venue_address,
         st.name, st.location, st.instructions, i.name, s.note, v.email::text
    from item_signups s
    join volunteers v on v.id = s.volunteer_id
    join station_items i on i.id = s.item_id
    join stations st on st.id = i.station_id
    join events e on e.id = s.event_id
   where (v.access_token = any (coalesce(p_volunteer_tokens, '{}'))
          or s.manage_token = any (coalesce(p_item_tokens, '{}')))
     and e.ends_on >= current_date - 7
   order by e.starts_on, st.sort_order, i.sort_order, i.created_at;
$$;
revoke execute on function public.pass_items(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.pass_items(uuid[], uuid[]) to service_role;

create function public.my_items()
returns table (
  signup_id         uuid,
  manage_token      uuid,
  event_id          uuid,
  event_name        text,
  timezone          text,
  starts_on         date,
  venue_name        text,
  venue_address     text,
  station_name      text,
  station_location  text,
  instructions      text,
  item_name         text,
  note              text,
  volunteer_email   text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.manage_token, e.id, e.name, e.timezone, e.starts_on, e.venue_name, e.venue_address,
         st.name, st.location, st.instructions, i.name, s.note, v.email::text
    from item_signups s
    join volunteers v on v.id = s.volunteer_id
    join station_items i on i.id = s.item_id
    join stations st on st.id = i.station_id
    join events e on e.id = s.event_id
   where v.email = public.current_email()
     and e.ends_on >= current_date - 7
   order by e.starts_on, st.sort_order, i.sort_order, i.created_at;
$$;
revoke execute on function public.my_items() from public, anon;
grant execute on function public.my_items() to authenticated;

-- Cancel an item with a link's tokens. False if the tokens don't cover it.
create function public.cancel_item_with_pass(p_signup_id uuid, p_volunteer_tokens uuid[], p_item_tokens uuid[])
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  found_id uuid;
begin
  select s.id into found_id
    from item_signups s join volunteers v on v.id = s.volunteer_id
   where s.id = p_signup_id
     and (v.access_token = any (coalesce(p_volunteer_tokens, '{}'))
          or s.manage_token = any (coalesce(p_item_tokens, '{}')));
  if found_id is null then
    return false;
  end if;
  delete from item_signups where id = found_id;
  return true;
end;
$$;
revoke execute on function public.cancel_item_with_pass(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.cancel_item_with_pass(uuid, uuid[], uuid[]) to service_role;

-- Cancel your own item, signed in.
create function public.cancel_my_item(p_signup_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  delete from item_signups s
   using volunteers v
   where s.id = p_signup_id and v.id = s.volunteer_id and v.email = public.current_email();
  return found;
end;
$$;
revoke execute on function public.cancel_my_item(uuid) from public, anon;
grant execute on function public.cancel_my_item(uuid) to authenticated;
