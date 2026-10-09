-- =============================================================================
-- Event types: a band contest (everything), or a volunteer event (stations,
-- shifts, sign-ups, check-in and the team; no bands).
--
--   * Every existing event is a band contest.
--   * A volunteer event can't have bands or band check-in stations.
--   * Switching a band contest to a volunteer event is only allowed before
--     any band has registered; its band check-in stations become plain stations.
-- =============================================================================

create type public.event_type as enum ('band_contest', 'volunteer');
alter table public.events add column event_type public.event_type not null default 'band_contest';

-- Band registration is never open on a volunteer event.
create or replace function public.band_registration_is_open(ev uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from events e
     where e.id = ev
       and e.event_type = 'band_contest'
       and e.status = 'published'
       and e.band_registration_open
       and (e.band_registration_deadline is null
            or (now() at time zone e.timezone)::date <= e.band_registration_deadline)
  );
$$;

-- Switching type.
create function public.events_type_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.event_type = 'volunteer' and old.event_type <> 'volunteer' then
    if exists (select 1 from bands where event_id = new.id) then
      raise exception 'Bands have registered for this event, so it has to stay a band contest.' using errcode = 'P0001';
    end if;
    -- The band check-in path doesn't apply: those become ordinary stations.
    update stations set checkpoint_kind = null, checkpoint_order = null, due_minutes_before_warm_up = null
     where event_id = new.id and checkpoint_kind is not null;
    new.band_registration_open := false;
  end if;
  return new;
end;
$$;
create trigger events_type_change
  before update of event_type on public.events
  for each row execute function public.events_type_change();

-- No bands on a volunteer event (hosts can add bands directly, so this
-- covers more than the registration check above).
create function public.bands_need_band_contest()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select event_type from events where id = new.event_id) = 'volunteer' then
    raise exception 'This is a volunteer event, so it doesn''t take band registrations.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger bands_need_band_contest
  before insert or update of event_id on public.bands
  for each row execute function public.bands_need_band_contest();

-- No band check-in stations on a volunteer event.
create function public.checkpoints_need_band_contest()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.checkpoint_kind is not null and (select event_type from events where id = new.event_id) = 'volunteer' then
    raise exception 'Band check-in stations are only for band contests.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger checkpoints_need_band_contest
  before insert or update of checkpoint_kind, event_id on public.stations
  for each row execute function public.checkpoints_need_band_contest();
