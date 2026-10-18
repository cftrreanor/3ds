-- =============================================================================
-- A conference's booked meetings move with it when its day changes.
--
-- Before this, changing a conference's day (Edit details, or the day in
-- Conference Setup) moved volunteer shifts but left families' bookings on the
-- old day. The Meetings page lists bookings by time of day, so they showed up
-- under the new day, while Met / No-show (which checks the real start) said
-- the meeting hadn't started, and families' calendars still had the old day.
--
-- Now each booking keeps its time of day and moves to the conference's day.
-- calendar_sequence goes up so the app's updated calendar invites replace the
-- old ones, and the day-before reminder is sent again for the new day. The
-- app emails each family (and the teacher) after the change.
--
-- A booking whose new time is already taken by another booking stays where it
-- is (the teacher sees both and can cancel one), so a day change never fails.
-- =============================================================================

create or replace function public.move_conference_bookings(ev uuid, from_tz text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  e     events;
  moved integer;
begin
  select * into e from events where id = ev;
  if e.id is null or e.event_type::text <> 'conference' then
    return 0;
  end if;
  with target as (
    select b.id, (e.starts_on + (b.starts_at at time zone from_tz)::time) at time zone e.timezone as new_start
      from conference_bookings b
     where b.event_id = ev
  )
  update conference_bookings b
     set starts_at = t.new_start,
         calendar_sequence = b.calendar_sequence + 1,
         reminded_at = null
    from target t
   where t.id = b.id
     and t.new_start <> b.starts_at
     and not exists (select 1 from conference_bookings o where o.event_id = ev and o.starts_at = t.new_start);
  get diagnostics moved = row_count;
  return moved;
end;
$$;
-- Only the trigger below calls it.
revoke execute on function public.move_conference_bookings(uuid, text) from public, anon, authenticated;

create or replace function public.conference_bookings_follow_day()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.move_conference_bookings(new.id, old.timezone);
  return null;
end;
$$;
revoke execute on function public.conference_bookings_follow_day() from public, anon, authenticated;

create trigger conference_bookings_follow_day
  after update of starts_on, timezone on public.events
  for each row
  when (new.event_type::text = 'conference' and (old.starts_on is distinct from new.starts_on or old.timezone is distinct from new.timezone))
  execute function public.conference_bookings_follow_day();

-- Conferences already moved before this fix: put their bookings on the
-- conference's day (at the same time of day) so the Meetings page and
-- Met / No-show agree. Families weren't emailed about those earlier moves.
select public.move_conference_bookings(e.id, e.timezone)
  from public.events e
 where e.event_type::text = 'conference'
   and exists (
     select 1 from public.conference_bookings b
      where b.event_id = e.id and (b.starts_at at time zone e.timezone)::date <> e.starts_on
   );
