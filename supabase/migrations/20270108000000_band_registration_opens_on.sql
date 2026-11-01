-- =============================================================================
-- Band registration that opens on a set day, and invitations that say when they
-- couldn't be delivered.
--   1. events.band_registration_opens_on: optional. Until that day (in the
--      event's time zone) registration isn't open, even once published. Empty
--      means it opens when the event is published.
--   2. It falls on or before the registration deadline (people using the app;
--      the server's own jobs aren't held to it, like the other registration rules).
--   3. band_invitations.failed_at: set when an invitation email couldn't be
--      sent, cleared when one goes out. Hosts can read it with the rest.
-- =============================================================================

-- 1. The opening day ----------------------------------------------------------------------------
alter table public.events add column band_registration_opens_on date;

create or replace function public.band_registration_is_open(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e
     where e.id = ev
       and e.event_type::text in ('band_contest', 'group_event')
       and e.status = 'published'
       and e.band_registration_open
       and (e.band_registration_opens_on is null
            or (now() at time zone e.timezone)::date >= e.band_registration_opens_on)
       and (e.band_registration_deadline is null
            or (now() at time zone e.timezone)::date <= e.band_registration_deadline)
  );
$$;

-- 2. It opens on or before the deadline ------------------------------------------------------------
create function public.events_opens_before_deadline()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('role', true) not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.band_registration_opens_on is not null and new.band_registration_deadline is not null
     and new.band_registration_opens_on > new.band_registration_deadline then
    raise exception 'Registration has to open on or before its deadline (%).', to_char(new.band_registration_deadline, 'Mon FMDD')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.events_opens_before_deadline() from public, anon, authenticated;
create trigger events_opens_before_deadline
  before insert or update of band_registration_opens_on, band_registration_deadline
  on public.events
  for each row execute function public.events_opens_before_deadline();

-- 3. Invitations that couldn't be sent ------------------------------------------------------------
alter table public.band_invitations add column failed_at timestamptz;
grant select (failed_at) on public.band_invitations to authenticated;
