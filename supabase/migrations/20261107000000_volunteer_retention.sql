-- =============================================================================
-- Volunteer records are kept for 10 days after the event, then deleted:
-- names, emails, phone numbers, under-18 helpers (companions) and their shift
-- sign-ups and check-ins. "After the event" counts days in the event's own
-- time zone, so an event that ends on the 10th is cleared on the 21st.
-- Shift totals (shifts.registered_count) stay, so past events still show how
-- many people signed up. Run daily by the server's cron job.
-- =============================================================================

create function public.purge_volunteers()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from volunteers v using events e
     where e.id = v.event_id and (now() at time zone e.timezone)::date > e.ends_on + 10
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.purge_volunteers() from public, anon, authenticated;
grant execute on function public.purge_volunteers() to service_role;
