-- =============================================================================
-- Walk-up volunteers on contest day.
--   * The volunteer desk (hosts and Volunteer Leads) can add someone who just
--     showed up to a shift: name and phone, no email needed. They're checked
--     in right away and marked as a walk-up.
--   * A full shift can still take a walk-up when the desk confirms it: the
--     shift's capacity grows by one to fit them.
--   * Releasing a no-show uses the existing cancel_assignment(), which frees
--     the spot.
-- =============================================================================

alter table public.volunteers alter column email drop not null;
alter table public.volunteers add column walk_up boolean not null default false;
grant select (walk_up) on public.volunteers to authenticated;

create function public.add_walk_up(
  p_shift_id       uuid,
  p_full_name      text,
  p_phone          text,
  p_over_capacity  boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  sh      shifts;
  vol_id  uuid;
  a_id    uuid;
begin
  select * into sh from shifts where id = p_shift_id for update;
  if sh.id is null or not public.can_manage_volunteers(sh.event_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_full_name, ''))) not between 2 and 200 then
    raise exception 'Please enter their name.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_phone, ''))) = 0 then
    raise exception 'Please enter their phone number.' using errcode = 'P0001';
  end if;
  if sh.registered_count >= sh.max_capacity then
    if not p_over_capacity then
      raise exception 'This shift is full.' using errcode = 'P0004';
    end if;
    update shifts set max_capacity = registered_count + 1 where id = sh.id;
  end if;

  -- The same walk-up helping with a second shift is one person.
  select id into vol_id from volunteers
   where event_id = sh.event_id and walk_up and phone = trim(p_phone)
   limit 1;
  if vol_id is null then
    insert into volunteers (event_id, full_name, email, phone, walk_up)
    values (sh.event_id, trim(p_full_name), null, trim(p_phone), true)
    returning id into vol_id;
  end if;
  if exists (select 1 from volunteer_assignments where shift_id = sh.id and volunteer_id = vol_id) then
    raise exception 'They''re already on this shift.' using errcode = 'P0001';
  end if;

  insert into volunteer_assignments (shift_id, volunteer_id, checked_in_at, checked_in_by)
  values (sh.id, vol_id, now(), auth.uid())
  returning id into a_id;
  update shifts set registered_count = registered_count + 1 where id = sh.id;
  return a_id;
end;
$$;
revoke execute on function public.add_walk_up(uuid, text, text, boolean) from public, anon;
grant execute on function public.add_walk_up(uuid, text, text, boolean) to authenticated;
