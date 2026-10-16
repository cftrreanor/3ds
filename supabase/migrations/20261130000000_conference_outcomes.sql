-- Parent-teacher conferences: once a meeting has started, the teacher can
-- mark it "Met" or "No-show" on Your meetings (tap again to undo). Only the
-- teacher (the event's hosts) can see or set it, and it's deleted with the
-- booking 30 days after the conference.

alter table public.conference_bookings
  add column outcome     text check (outcome in ('met', 'no_show')),
  add column outcome_at  timestamptz;

grant select (outcome, outcome_at) on public.conference_bookings to authenticated;

create function public.set_conference_outcome(p_id uuid, p_outcome text)
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
  if b.id is null or not coalesce(public.is_event_admin(b.event_id), false) then
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
revoke execute on function public.set_conference_outcome(uuid, text) from public, anon;
grant execute on function public.set_conference_outcome(uuid, text) to authenticated;
