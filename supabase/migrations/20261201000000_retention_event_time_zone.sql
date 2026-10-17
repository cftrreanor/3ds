-- =============================================================================
-- Children's details (school visit registrations and conference bookings) are
-- kept for 30 days after the event, counted in the event's own time zone, the
-- same way volunteers' 10 days already are. Before, the 30 days were counted
-- by the server's date (UTC), so an evening event in Texas could be hidden and
-- deleted a few hours early. Now an event that ends on October 10 is hidden
-- and cleared on November 10, local time.
-- =============================================================================

-- Still kept (visible to the event team)?
create or replace function public.parent_data_kept(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from events where id = ev and (now() at time zone timezone)::date <= ends_on + 30);
$$;

create or replace function public.purge_parent_registrations()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from parent_registrations r using events e
     where e.id = r.event_id and (now() at time zone e.timezone)::date > e.ends_on + 30
    returning 1
  )
  select count(*)::int from gone;
$$;

create or replace function public.purge_conference_bookings()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from conference_bookings b using events e
     where e.id = b.event_id and (now() at time zone e.timezone)::date > e.ends_on + 30
    returning 1
  )
  select count(*)::int from gone;
$$;
