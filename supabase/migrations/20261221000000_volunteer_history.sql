-- =============================================================================
-- Volunteer history: how many shifts each adult volunteer signed up for and
-- checked in to, across an account's events (Volunteer history page). Booster
-- clubs use it to put their most reliable volunteers first, e.g. for chaperone
-- spots.
--
--   * When an event's volunteers are deleted (10 days after the event, as
--     before), each adult volunteer's name, email, and shift counts for that
--     event are kept in volunteer_history first. Phone numbers, under-18
--     helpers, and demo people are not kept.
--   * A person's history is deleted 2 years after their last event, or right
--     away when a host removes them (they asked to be forgotten).
--   * One account's history is its own: never shared across accounts.
--   * Only the account's hosts and its Volunteer Leads can read it, through
--     volunteer_report(); only hosts can remove someone.
-- =============================================================================

create table public.volunteer_history (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           citext not null,
  event_id        uuid not null,  -- no foreign key: the event may be deleted later, the history stays
  event_name      text not null,
  event_on        date not null,
  full_name       text not null check (char_length(full_name) between 1 and 200),
  signed_up       int not null check (signed_up >= 0),
  checked_in      int not null check (checked_in between 0 and signed_up),
  recorded_at     timestamptz not null default now(),
  primary key (organization_id, email, event_id)
);
create index volunteer_history_last_event on public.volunteer_history (organization_id, email, event_on desc);

alter table public.volunteer_history enable row level security;
revoke all on public.volunteer_history from anon, authenticated;
grant select, insert, update, delete on public.volunteer_history to service_role;

-- People a host removed: events before this are never recorded for them again.
create table public.volunteer_history_removed (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           citext not null,
  removed_at      timestamptz not null default now(),
  primary key (organization_id, email)
);
alter table public.volunteer_history_removed enable row level security;
revoke all on public.volunteer_history_removed from anon, authenticated;
grant select, insert, update, delete on public.volunteer_history_removed to service_role;

-- The account's hosts, or a Volunteer Lead on any of its events.
create function public.can_see_volunteer_history(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_org_admin(p_org)
      or exists (select 1 from event_staff s join events e on e.id = s.event_id
                  where e.organization_id = p_org and s.user_id = auth.uid() and s.role = 'volunteer_director');
$$;
revoke execute on function public.can_see_volunteer_history(uuid) from public, anon;
grant execute on function public.can_see_volunteer_history(uuid) to authenticated;

-- Each adult volunteer's shift counts per event, for an account's events whose volunteers are still here:
-- shifts that have ended only (an upcoming shift isn't kept or missed yet).
create function public.volunteer_event_counts(p_org uuid, p_ended_by timestamptz)
returns table (email citext, event_id uuid, event_name text, event_on date, full_name text, signed_up int, checked_in int)
language sql stable security definer set search_path = public
as $$
  select v.email, e.id, e.name, e.ends_on, max(v.full_name),
         count(va.id)::int, count(va.checked_in_at)::int
    from volunteers v
    join events e on e.id = v.event_id
    join volunteer_assignments va on va.volunteer_id = v.id
    join shifts s on s.id = va.shift_id and s.ends_at <= p_ended_by
   where e.organization_id = p_org
     and not v.minor
     and v.email::text not like '%@demo.fieldcommandevents.com'
   group by v.email, e.id, e.name, e.ends_on;
$$;
revoke execute on function public.volunteer_event_counts(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.volunteer_event_counts(uuid, timestamptz) to service_role;

/**
 * The Volunteer history page: one row per person, kept history plus events
 * whose volunteers aren't deleted yet (their ended shifts only).
 */
create function public.volunteer_report(p_org uuid)
returns table (email text, full_name text, events int, signed_up int, checked_in int, last_event_name text, last_event_on date)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_see_volunteer_history(p_org) then
    raise exception 'Only the account''s hosts and Volunteer Leads can see volunteer history.' using errcode = '42501';
  end if;
  return query
    with hist as (
      select h.email, h.event_id, h.event_name, h.event_on, h.full_name, h.signed_up, h.checked_in
        from volunteer_history h
       where h.organization_id = p_org
      union all
      select c.email, c.event_id, c.event_name, c.event_on, c.full_name, c.signed_up, c.checked_in
        from public.volunteer_event_counts(p_org, now()) c
       where not exists (select 1 from volunteer_history h
                          where h.organization_id = p_org and h.email = c.email and h.event_id = c.event_id)
         and not exists (select 1 from volunteer_history_removed r
                          where r.organization_id = p_org and r.email = c.email and r.removed_at >= c.event_on)
    ),
    latest as (
      select distinct on (r.email) r.email, r.full_name, r.event_name, r.event_on
        from hist r
       order by r.email, r.event_on desc
    )
    select r.email::text, l.full_name, count(*)::int, sum(r.signed_up)::int, sum(r.checked_in)::int, l.event_name, l.event_on
      from hist r join latest l on l.email = r.email
     where r.signed_up > 0
     group by r.email, l.full_name, l.event_name, l.event_on;
end;
$$;
revoke execute on function public.volunteer_report(uuid) from public, anon;
grant execute on function public.volunteer_report(uuid) to authenticated;

-- A host removes someone from the history (they asked to be forgotten).
create function public.remove_volunteer_history(p_org uuid, p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only the account''s hosts can remove someone from volunteer history.' using errcode = '42501';
  end if;
  delete from volunteer_history where organization_id = p_org and email = p_email::citext;
  insert into volunteer_history_removed (organization_id, email) values (p_org, p_email::citext)
  on conflict (organization_id, email) do update set removed_at = now();
end;
$$;
revoke execute on function public.remove_volunteer_history(uuid, text) from public, anon;
grant execute on function public.remove_volunteer_history(uuid, text) to authenticated;

-- The daily clean-up: keep each adult's counts, then delete the event's
-- volunteers (as before), then forget anyone whose last event was over 2 years ago.
create or replace function public.purge_volunteers()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n int;
  ev record;
begin
  for ev in
    select distinct e.organization_id
      from volunteers v join events e on e.id = v.event_id
     where (now() at time zone e.timezone)::date > e.ends_on + 10
  loop
    insert into volunteer_history (organization_id, email, event_id, event_name, event_on, full_name, signed_up, checked_in)
    select ev.organization_id, c.email, c.event_id, c.event_name, c.event_on, c.full_name, c.signed_up, c.checked_in
      from public.volunteer_event_counts(ev.organization_id, 'infinity') c
      join events e on e.id = c.event_id
     where (now() at time zone e.timezone)::date > e.ends_on + 10
       and c.signed_up > 0
       and not exists (select 1 from volunteer_history_removed r
                        where r.organization_id = ev.organization_id and r.email = c.email and r.removed_at >= c.event_on)
    on conflict (organization_id, email, event_id) do nothing;
  end loop;

  with gone as (
    delete from volunteers v using events e
     where e.id = v.event_id and (now() at time zone e.timezone)::date > e.ends_on + 10
    returning 1
  )
  select count(*)::int into n from gone;

  delete from volunteer_history h
   where not exists (select 1 from volunteer_history recent
                      where recent.organization_id = h.organization_id and recent.email = h.email
                        and recent.event_on >= current_date - interval '2 years');
  return n;
end;
$$;
revoke execute on function public.purge_volunteers() from public, anon, authenticated;
grant execute on function public.purge_volunteers() to service_role;
