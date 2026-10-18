-- =============================================================================
-- Conference bookings are seen only by the teacher who set up the conference
-- (the event's creator), not by everyone on a school's or PTO's account.
-- Families are promised "only your child's teacher sees this", and on a
-- shared account the other Hosts and Co-hosts could read every booking.
--
-- The others keep a count of booked times (no names) for the event page.
-- A conference whose creator is gone (created_by is null) falls back to the
-- account's hosts, so its bookings aren't stranded.
-- =============================================================================

create or replace function public.is_conference_teacher(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_event_admin(ev) and exists (
    select 1 from events e
    where e.id = ev and (e.created_by = auth.uid() or e.created_by is null)
  );
$$;
revoke execute on function public.is_conference_teacher(uuid) from public, anon;
grant execute on function public.is_conference_teacher(uuid) to authenticated;

drop policy "bookings: the teacher reads" on public.conference_bookings;
create policy "bookings: the teacher reads" on public.conference_bookings
  for select to authenticated using (public.is_conference_teacher(event_id));
drop policy "bookings: hosts cancel" on public.conference_bookings;
create policy "bookings: the teacher cancels" on public.conference_bookings
  for delete to authenticated using (public.is_conference_teacher(event_id));

-- Met / No-show: the teacher only.
create or replace function public.set_conference_outcome(p_id uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b conference_bookings;
begin
  if p_outcome is not null and p_outcome not in ('met', 'no_show') then
    raise exception 'Choose Met or No-show' using errcode = '22023';
  end if;
  select * into b from conference_bookings where id = p_id for update;
  if b.id is null or not coalesce(public.is_conference_teacher(b.event_id), false) then
    raise exception 'You don''t have permission to do that' using errcode = '42501';
  end if;
  if p_outcome is not null and b.starts_at > now() then
    raise exception 'You can mark this once the meeting has started.' using errcode = 'P0001';
  end if;
  update conference_bookings
     set outcome = p_outcome,
         outcome_at = case when p_outcome is null then null else now() end
   where id = p_id;
end;
$$;

-- How many times are booked, for anyone who runs the event (no names or details).
create or replace function public.conference_booked_count(ev uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case when public.is_event_admin(ev)
    then (select count(*)::integer from conference_bookings where event_id = ev)
  end;
$$;
revoke execute on function public.conference_booked_count(uuid) from public, anon;
grant execute on function public.conference_booked_count(uuid) to authenticated;
