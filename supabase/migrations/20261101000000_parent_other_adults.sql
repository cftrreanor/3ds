-- =============================================================================
-- Parent registration: the other adults coming for the same children (a
-- spouse, a grandparent) are named, so the door team can match each photo ID
-- to a name. adult_count is now 1 (the parent) + the other adults.
-- =============================================================================

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
     or (now() at time zone ev.timezone)::date > ev.ends_on then
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
          (select coalesce(jsonb_agg(to_jsonb(trim(a #>> '{}'))), '[]') from jsonb_array_elements(p_other_adults) a),
          1 + jsonb_array_length(p_other_adults))
  on conflict (event_id, email) do update
    set parent_name = excluded.parent_name, phone = excluded.phone, children = excluded.children,
        other_adults = excluded.other_adults, adult_count = excluded.adult_count,
        calendar_sequence = parent_registrations.calendar_sequence + 1
  returning access_token into token;
  return token;
end;
$$;

revoke execute on function public.register_parents(uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.register_parents(uuid, text, text, text, jsonb, jsonb) to service_role;
