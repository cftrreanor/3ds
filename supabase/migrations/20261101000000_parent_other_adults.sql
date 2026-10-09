-- =============================================================================
-- Parent registration: the other adults coming for the same children (a
-- spouse, a grandparent) are named, and each is checked in on their own (mom
-- may arrive before dad). adult_count is now 1 (the parent) + the others.
--
-- other_adults: [{ "name": "Marco Lopez", "checked_in_at": null, "checked_in_by": null }, …]
-- The registering parent's own check-in stays in checked_in_at / checked_in_by.
--
-- Also: hosts can pick a date and time when parent registration closes on its own.
-- =============================================================================

alter table public.events add column parent_registration_closes_at timestamptz;

alter table public.parent_registrations
  add column other_adults jsonb not null default '[]'
    check (jsonb_typeof(other_adults) = 'array' and jsonb_array_length(other_adults) <= 5);
grant select (other_adults) on public.parent_registrations to authenticated;

drop function public.register_parents(uuid, text, text, text, jsonb, integer);
create function public.register_parents(p_event uuid, p_name text, p_email text, p_phone text, p_children jsonb, p_other_adults jsonb default '[]')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev     events;
  kid    jsonb;
  adult  jsonb;
  token  uuid;
begin
  select * into ev from events where id = p_event;
  if not found or ev.event_type::text <> 'school_visit' or ev.status <> 'published' or not ev.parent_registration_open
     or (now() at time zone ev.timezone)::date > ev.ends_on
     or now() >= coalesce(ev.parent_registration_closes_at, 'infinity') then
    raise exception 'Registration for this event is closed.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) not between 1 and 8 then
    raise exception 'Add between 1 and 8 children.' using errcode = 'P0001';
  end if;
  p_other_adults := coalesce(p_other_adults, '[]');
  if jsonb_typeof(p_other_adults) <> 'array' or jsonb_array_length(p_other_adults) > 5 then
    raise exception 'Up to 5 other adults can come on one registration.' using errcode = 'P0001';
  end if;
  for adult in select * from jsonb_array_elements(p_other_adults) loop
    if jsonb_typeof(adult) <> 'string' or length(trim(adult #>> '{}')) not between 2 and 120 then
      raise exception 'Please enter each adult''s first and last name.' using errcode = 'P0001';
    end if;
  end loop;
  for kid in select * from jsonb_array_elements(p_children) loop
    if length(trim(coalesce(kid ->> 'name', ''))) not between 1 and 120
       or length(trim(coalesce(kid ->> 'teacher', ''))) not between 1 and 80
       or length(trim(coalesce(kid ->> 'grade', ''))) not between 1 and 20 then
      raise exception 'Please fill in each child''s name, teacher and grade.' using errcode = 'P0001';
    end if;
  end loop;

  insert into parent_registrations (event_id, parent_name, email, phone, children, other_adults, adult_count)
  values (p_event, trim(p_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''),
          (select jsonb_agg(jsonb_build_object('name', trim(k ->> 'name'), 'teacher', trim(k ->> 'teacher'), 'grade', trim(k ->> 'grade')))
             from jsonb_array_elements(p_children) k),
          (select coalesce(jsonb_agg(jsonb_build_object('name', trim(a #>> '{}'), 'checked_in_at', null, 'checked_in_by', null)), '[]')
             from jsonb_array_elements(p_other_adults) a),
          1 + jsonb_array_length(p_other_adults))
  on conflict (event_id, email) do update
    set parent_name = excluded.parent_name, phone = excluded.phone, children = excluded.children,
        -- Anyone already checked in stays checked in when the list is edited.
        other_adults = (
          select coalesce(jsonb_agg(
                   coalesce((select o from jsonb_array_elements(parent_registrations.other_adults) o
                              where lower(o ->> 'name') = lower(n ->> 'name') limit 1), n)), '[]')
            from jsonb_array_elements(excluded.other_adults) n),
        adult_count = excluded.adult_count,
        calendar_sequence = parent_registrations.calendar_sequence + 1
  returning access_token into token;
  return token;
end;
$$;

revoke execute on function public.register_parents(uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.register_parents(uuid, text, text, text, jsonb, jsonb) to service_role;

-- The door: check in one adult on a registration (0 = the registering
-- parent, 1… = the other adults in order), after looking at their ID; or undo.
drop function public.set_parent_checked_in(uuid, boolean);
create function public.set_parent_checked_in(p_id uuid, p_in boolean, p_adult integer default 0)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  reg parent_registrations;
begin
  select * into reg from parent_registrations where id = p_id for update;
  if not found or not public.can_check_in_parents(reg.event_id) or not public.parent_data_kept(reg.event_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if p_adult is null or p_adult < 0 or p_adult > jsonb_array_length(reg.other_adults) then
    raise exception 'That adult isn''t on this registration.' using errcode = 'P0001';
  end if;
  if p_adult = 0 then
    update parent_registrations
       set checked_in_at = case when p_in then coalesce(checked_in_at, now()) end,
           checked_in_by = case when p_in then coalesce(checked_in_by, auth.uid()) end
     where id = p_id;
  else
    update parent_registrations
       set other_adults = jsonb_set(other_adults, array[(p_adult - 1)::text],
             (other_adults -> (p_adult - 1)) || case
               when not p_in then jsonb_build_object('checked_in_at', null, 'checked_in_by', null)
               when other_adults -> (p_adult - 1) ->> 'checked_in_at' is not null then '{}'::jsonb
               else jsonb_build_object('checked_in_at', now(), 'checked_in_by', auth.uid())
             end)
     where id = p_id;
  end if;
end;
$$;
revoke execute on function public.set_parent_checked_in(uuid, boolean, integer) from public, anon;
grant execute on function public.set_parent_checked_in(uuid, boolean, integer) to authenticated;
