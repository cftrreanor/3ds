-- =============================================================================
-- Security fixes from the October 2026 review.
--
-- 1. Nobody joins a team without saying yes. Hosts and Volunteer Leads could
--    add any user to their event's team directly (event_staff insert), and the
--    team's profiles are readable by managers, so anyone could create a draft
--    event, "add" a stranger and read their email and phone. People now join
--    only by accepting an invitation (accept_invitation and the other security
--    definer functions); hosts and Volunteer Leads can still remove people.
-- 2. Hosts can't create a band in someone else's name. "bands: hosts all"
--    allowed inserting a band with any director_user_id, which then showed
--    that person's email in past_band_directors(). Bands are registered by
--    their own director; hosts still read, edit and remove them.
-- 3. Children's details: Section Leads see parent registrations (and check
--    parents in) only on event day. Hosts and Volunteer Leads keep access from
--    registration until the 30-day purge.
-- =============================================================================

-- 1. Team membership only through invitations.
drop policy if exists "staff: hosts manage" on public.event_staff;
drop policy if exists "staff: directors add section leads" on public.event_staff;
create policy "staff: hosts remove" on public.event_staff
  for delete to authenticated using (public.is_event_admin(event_id));
revoke insert, update on public.event_staff from anon, authenticated;

-- 2. Bands: registered by their own director only.
drop policy if exists "bands: hosts all" on public.bands;
create policy "bands: hosts read" on public.bands
  for select to authenticated using (public.is_event_admin(event_id));
create policy "bands: hosts update" on public.bands
  for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "bands: hosts delete" on public.bands
  for delete to authenticated using (public.is_event_admin(event_id));

-- 3. The door: hosts and Volunteer Leads any time; Section Leads on event day.
create or replace function public.can_check_in_parents(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_manage_volunteers(ev) or (public.is_event_staff(ev) and public.is_event_day(ev));
$$;

-- 4. Parent registration can't be overwritten by someone who knows the email.
--    Registering again with an email that's already registered changes
--    nothing (the server emails that parent their own link instead, at most
--    every 10 minutes: link_emailed_at). Changes are made from the parent's
--    own link, update_parent_registration(token, ...).
alter table public.parent_registrations add column link_emailed_at timestamptz;

create function public.parent_registration_check(p_children jsonb, p_other_adults jsonb)
returns void
language plpgsql immutable set search_path = public
as $$
declare
  kid   jsonb;
  adult jsonb;
begin
  if jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) not between 1 and 8 then
    raise exception 'Add between 1 and 8 children.' using errcode = 'P0001';
  end if;
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
end;
$$;

create function public.parent_registration_open(ev events)
returns boolean
language sql stable set search_path = public
as $$
  select ev.event_type::text = 'school_visit' and ev.status = 'published' and ev.parent_registration_open
     and (now() at time zone ev.timezone)::date <= ev.ends_on
     and now() < coalesce(ev.parent_registration_closes_at, 'infinity');
$$;

-- New registrations only. Returns the new registration's link token, or null
-- when this email is already registered for the event (nothing is changed).
create or replace function public.register_parents(p_event uuid, p_name text, p_email text, p_phone text, p_children jsonb, p_other_adults jsonb default '[]')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  ev    events;
  token uuid;
begin
  select * into ev from events where id = p_event;
  if not found or not public.parent_registration_open(ev) then
    raise exception 'Registration for this event is closed.' using errcode = 'P0001';
  end if;
  p_other_adults := coalesce(p_other_adults, '[]');
  perform public.parent_registration_check(p_children, p_other_adults);

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

-- A parent changes their registration from their own link (the email stays).
-- Anyone already checked in stays checked in. Returns the event id.
create function public.update_parent_registration(p_token uuid, p_name text, p_phone text, p_children jsonb, p_other_adults jsonb default '[]')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  reg parent_registrations;
  ev  events;
begin
  select * into reg from parent_registrations where access_token = p_token for update;
  if not found then
    raise exception 'This link isn''t valid.' using errcode = 'P0001';
  end if;
  select * into ev from events where id = reg.event_id;
  if not public.parent_registration_open(ev) then
    raise exception 'Registration for this event is closed, so it can''t be changed online. Contact the school.' using errcode = 'P0001';
  end if;
  p_other_adults := coalesce(p_other_adults, '[]');
  perform public.parent_registration_check(p_children, p_other_adults);
  if length(trim(coalesce(p_name, ''))) not between 2 and 200 then
    raise exception 'Please enter your first and last name.' using errcode = 'P0001';
  end if;

  update parent_registrations
     set parent_name = trim(p_name),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         children = (select jsonb_agg(jsonb_build_object('name', trim(k ->> 'name'), 'teacher', trim(k ->> 'teacher'), 'grade', trim(k ->> 'grade')))
                       from jsonb_array_elements(p_children) k),
         other_adults = (
           select coalesce(jsonb_agg(
                    coalesce((select o from jsonb_array_elements(reg.other_adults) o
                               where lower(o ->> 'name') = lower(trim(n #>> '{}')) limit 1),
                             jsonb_build_object('name', trim(n #>> '{}'), 'checked_in_at', null, 'checked_in_by', null))), '[]')
             from jsonb_array_elements(p_other_adults) n),
         adult_count = 1 + jsonb_array_length(p_other_adults),
         calendar_sequence = calendar_sequence + 1
   where id = reg.id;
  return reg.event_id;
end;
$$;

revoke execute on function public.parent_registration_check(jsonb, jsonb), public.parent_registration_open(events),
                           public.update_parent_registration(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_parent_registration(uuid, text, text, jsonb, jsonb) to service_role;
