-- =============================================================================
-- Parent-teacher conferences: the teacher chooses whether families give their
-- child's name (Edit event details). Asked by default, as before.
--
--   * events.ask_child_name: true (the default) asks for it; false hides the
--     field on the booking page, and the booking keeps no child's name.
--   * Without a child's name, a family books one meeting per first parent's
--     email (with weekly hours, one upcoming meeting), instead of one per child.
-- =============================================================================

alter table public.events add column ask_child_name boolean not null default true;

-- A booking made without the child's name has none.
alter table public.conference_bookings alter column child_name drop not null;
alter table public.conference_bookings drop constraint if exists conference_bookings_child_name_check;
alter table public.conference_bookings add constraint conference_bookings_child_name_check
  check (child_name is null or char_length(trim(child_name)) between 2 and 120);

create or replace function public.book_conference(p_event uuid, p_starts_at timestamptz, p_child text, p_parents jsonb, p_mode text,
                                                  p_note text, p_call_phone text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  mode   text;
  token  uuid;
  p      jsonb;
  weekly boolean;
  ask    boolean;
  who    text;
  phone  text := nullif(regexp_replace(coalesce(p_call_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  mode := public.conference_booking_check(p_event, p_starts_at, p_mode);
  ask := coalesce((select ask_child_name from events where id = p_event), true);
  if ask and char_length(trim(coalesce(p_child, ''))) not between 2 and 120 then
    raise exception 'Please enter your child''s first and last name.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_parents) <> 'array' or jsonb_array_length(p_parents) not between 1 and 4 then
    raise exception 'Add one to four parents or guardians.' using errcode = 'P0001';
  end if;
  for p in select * from jsonb_array_elements(p_parents) loop
    if char_length(trim(coalesce(p ->> 'name', ''))) not between 2 and 120
       or coalesce(p ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p ->> 'email') > 254 then
      raise exception 'Please enter each parent''s name and email address.' using errcode = 'P0001';
    end if;
  end loop;
  if mode = 'phone' and (phone is null or phone !~ '^\+?[0-9]{7,15}$') then
    raise exception 'Please enter the phone number your teacher should call.' using errcode = 'P0001';
  end if;
  weekly := exists (select 1 from conference_settings where event_id = p_event and schedule = 'weekly');
  if ask then
    -- One meeting per child (with weekly hours, one upcoming meeting), even if two are booked at once.
    perform pg_advisory_xact_lock(hashtext('conference-child:' || p_event::text), hashtext(lower(trim(p_child))));
    if exists (select 1 from conference_bookings
                where event_id = p_event and lower(trim(child_name)) = lower(trim(p_child))
                  and (not weekly or starts_at > now())) then
      raise exception '% already has a meeting booked. Use the link in your confirmation email to change it.', trim(p_child)
        using errcode = 'P0001';
    end if;
  else
    -- No child's name: one meeting per first parent's email instead.
    who := lower(trim(p_parents -> 0 ->> 'email'));
    perform pg_advisory_xact_lock(hashtext('conference-contact:' || p_event::text), hashtext(who));
    if exists (select 1 from conference_bookings
                where event_id = p_event and lower(parents -> 0 ->> 'email') = who
                  and (not weekly or starts_at > now())) then
      raise exception 'You already have a meeting booked. Use the link in your confirmation email to change it.'
        using errcode = 'P0001';
    end if;
  end if;
  begin
    insert into conference_bookings (event_id, starts_at, child_name, parents, meeting_mode, note, call_phone)
    values (p_event, p_starts_at, case when ask then trim(p_child) end,
            (select jsonb_agg(jsonb_build_object('name', trim(x ->> 'name'), 'email', lower(trim(x ->> 'email')),
                                                 'phone', nullif(trim(coalesce(x ->> 'phone', '')), '')))
               from jsonb_array_elements(p_parents) x),
            mode, nullif(left(trim(coalesce(p_note, '')), 500), ''),
            case when mode = 'phone' then phone end)
    returning access_token into token;
  exception when unique_violation then
    raise exception 'That time was just taken. Please pick another.' using errcode = 'P0001';
  end;
  return token;
end;
$$;
revoke execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.book_conference(uuid, timestamptz, text, jsonb, text, text, text) to service_role;
