-- =============================================================================
-- School visitor events: how many adults are coming on each registration
-- (a parent, plus a spouse or grandparent), so the team's numbers match the
-- people who actually walk in.
-- =============================================================================

alter table public.parent_registrations
  add column adult_count integer not null default 1 check (adult_count between 1 and 6);
grant select (adult_count) on public.parent_registrations to authenticated;

-- Registration now takes the number of adults (1 if left out).
drop function public.register_parents(uuid, text, text, text, jsonb);
create function public.register_parents(p_event uuid, p_name text, p_email text, p_phone text, p_children jsonb, p_adults integer default 1)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev    events;
  kid   jsonb;
  token uuid;
begin
  select * into ev from events where id = p_event;
  if not found or ev.event_type::text <> 'school_visit' or ev.status <> 'published' or not ev.parent_registration_open
     or (now() at time zone ev.timezone)::date > ev.ends_on then
    raise exception 'Registration for this event is closed.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) not between 1 and 8 then
    raise exception 'Add between 1 and 8 children.' using errcode = 'P0001';
  end if;
  if p_adults is null or p_adults not between 1 and 6 then
    raise exception 'Between 1 and 6 adults can come on one registration.' using errcode = 'P0001';
  end if;
  for kid in select * from jsonb_array_elements(p_children) loop
    if length(trim(coalesce(kid ->> 'name', ''))) not between 1 and 120
       or length(trim(coalesce(kid ->> 'teacher', ''))) not between 1 and 80
       or length(trim(coalesce(kid ->> 'grade', ''))) not between 1 and 20 then
      raise exception 'Please fill in each child''s name, teacher and grade.' using errcode = 'P0001';
    end if;
  end loop;

  insert into parent_registrations (event_id, parent_name, email, phone, children, adult_count)
  values (p_event, trim(p_name), lower(trim(p_email)), nullif(trim(coalesce(p_phone, '')), ''),
          (select jsonb_agg(jsonb_build_object('name', trim(k ->> 'name'), 'teacher', trim(k ->> 'teacher'), 'grade', trim(k ->> 'grade')))
             from jsonb_array_elements(p_children) k),
          p_adults)
  on conflict (event_id, email) do update
    set parent_name = excluded.parent_name, phone = excluded.phone, children = excluded.children,
        adult_count = excluded.adult_count,
        calendar_sequence = parent_registrations.calendar_sequence + 1
  returning access_token into token;
  return token;
end;
$$;

revoke execute on function public.register_parents(uuid, text, text, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.register_parents(uuid, text, text, text, jsonb, integer) to service_role;
