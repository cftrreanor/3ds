-- =============================================================================
-- Data retention: what the privacy policy promises, run by the daily job.
--
--   * Closing an account: a FieldCommand admin closes (or reopens) a host
--     organization. 90 days after closing, the organization, its events and
--     everything in them are deleted, with its pilot requests. Hosts and team
--     members left with no other role anywhere go in user_deletion_queue; the
--     server deletes their sign-in accounts (Supabase's admin API) and the
--     queue row goes with them.
--   * Pilot requests that never became an account: deleted 1 year after.
--   * Band and group registrations: 2 years after the event ends, the
--     director's personal details are removed (names, email, phone, school
--     address, notes). Band, school and headcounts stay for the host's history.
--     Band invitations for those events go too.
--   * Fair booths: contact name, email and phone removed 15 months after the
--     event ends.
--   * Uploaded files: expired_event_files() lists files of events that ended
--     over 30 days ago (and of accounts due for deletion); the server removes
--     them from storage, then the rows.
--
-- "After the event" counts days in the event's own time zone, like
-- purge_volunteers(). Everything here is server-only (service role), except
-- closing and reopening, which only FieldCommand admins can do.
-- =============================================================================

-- 1. Closing an account -------------------------------------------------------
alter table public.organizations add column closed_at timestamptz;

create function public.admin_close_account(p_org uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can close accounts' using errcode = '42501';
  end if;
  update organizations set closed_at = now() where id = p_org and closed_at is null;
  if not found then
    raise exception 'That account is already closed, or doesn''t exist' using errcode = 'P0001';
  end if;
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'account_closed', p_org, jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;

create function public.admin_reopen_account(p_org uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can reopen accounts' using errcode = '42501';
  end if;
  update organizations set closed_at = null where id = p_org and closed_at is not null;
  if not found then
    raise exception 'That account isn''t closed' using errcode = 'P0001';
  end if;
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'account_reopened', p_org, jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;

revoke execute on function public.admin_close_account(uuid, text) from public, anon;
grant execute on function public.admin_close_account(uuid, text) to authenticated;
revoke execute on function public.admin_reopen_account(uuid, text) from public, anon;
grant execute on function public.admin_reopen_account(uuid, text) to authenticated;

-- Sign-in accounts to delete through Supabase's admin API (server only).
create table public.user_deletion_queue (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  queued_at  timestamptz not null default now()
);
alter table public.user_deletion_queue enable row level security;
revoke all on public.user_deletion_queue from anon, authenticated;

-- Does this person still have a role anywhere (so their account must stay)?
create function public.has_any_role(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from organization_members where user_id = p_user)
      or exists (select 1 from event_staff where user_id = p_user)
      or exists (select 1 from station_leads where user_id = p_user)
      or exists (select 1 from bands where director_user_id = p_user)
      or exists (select 1 from platform_admins where user_id = p_user)
      or exists (select 1 from demo_accounts where user_id = p_user or owner_id = p_user);
$$;
revoke execute on function public.has_any_role(uuid) from public, anon, authenticated;
grant execute on function public.has_any_role(uuid) to service_role;

-- Delete organizations closed over 90 days ago. Returns how many.
create function public.purge_closed_accounts()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  orgs uuid[];
  people uuid[];
begin
  select coalesce(array_agg(id), '{}') into orgs
    from organizations where closed_at < now() - interval '90 days';
  if cardinality(orgs) = 0 then
    return 0;
  end if;

  -- Its hosts, and its events' team members and section leads.
  select coalesce(array_agg(distinct u), '{}') into people from (
    select user_id from organization_members where organization_id = any (orgs)
    union select s.user_id from event_staff s join events e on e.id = s.event_id where e.organization_id = any (orgs)
    union select l.user_id from station_leads l join events e on e.id = l.event_id where e.organization_id = any (orgs)
  ) t(u);

  delete from pilot_requests p
   where p.organization_id = any (orgs)
      or exists (select 1 from host_invitations h where h.pilot_request_id = p.id and h.organization_id = any (orgs));
  delete from host_invitations where organization_id = any (orgs);
  -- Events (and everything in them) go with the organization.
  delete from organizations where id = any (orgs);

  insert into user_deletion_queue (user_id)
  select u from unnest(people) u
   where not public.has_any_role(u)
  on conflict do nothing;

  return cardinality(orgs);
end;
$$;
revoke execute on function public.purge_closed_accounts() from public, anon, authenticated;
grant execute on function public.purge_closed_accounts() to service_role;

-- The queued accounts that are still safe to delete. Anyone who has picked up
-- a role since (invited to another team, registered a band) leaves the queue.
create function public.user_deletions_due()
returns setof uuid
language plpgsql security definer set search_path = public
as $$
begin
  delete from user_deletion_queue q where public.has_any_role(q.user_id);
  return query select user_id from user_deletion_queue order by queued_at;
end;
$$;
revoke execute on function public.user_deletions_due() from public, anon, authenticated;
grant execute on function public.user_deletions_due() to service_role;

-- 2. Pilot requests that never became an account -----------------------------
create function public.purge_pilot_requests()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (
    delete from pilot_requests p
     where p.created_at < now() - interval '1 year'
       and p.organization_id is null
       and not exists (select 1 from host_invitations h where h.pilot_request_id = p.id and h.organization_id is not null)
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_pilot_requests() from public, anon, authenticated;
grant execute on function public.purge_pilot_requests() to service_role;

-- 3. Directors' details, 2 years after the event ---------------------------
alter table public.bands add column details_removed_at timestamptz;

create function public.purge_band_directors()
returns integer
language sql security definer set search_path = public
as $$
  with old as (
    select e.id from events e
     where (now() at time zone e.timezone)::date > (e.ends_on + interval '2 years')::date
  ),
  invites as (
    delete from band_invitations where event_id in (select id from old)
  ),
  cleared as (
    update bands b
       set school_address = '', contact_email = '', head_director_name = '', head_director_email = '',
           head_director_phone = '', assistant_directors = '{}', contest_day_conflicts = null,
           special_needs = null, details_removed_at = now()
     where b.event_id in (select id from old) and b.details_removed_at is null
    returning 1
  )
  select count(*)::int from cleared;
$$;
revoke execute on function public.purge_band_directors() from public, anon, authenticated;
grant execute on function public.purge_band_directors() to service_role;

-- Hosts can invite directors back only from registrations that still have their details.
create or replace function public.past_band_directors(p_event uuid)
returns table (
  email         text,
  full_name     text,
  bands         text[],
  last_event    text,
  last_event_on date,
  registered    boolean,
  invited_at    timestamptz
)
language sql stable security definer set search_path = public
as $$
  with ev as (
    select organization_id from events where id = p_event and public.is_event_admin(p_event)
  ),
  past as (
    select b.director_user_id, b.band_name, b.school_name, e.name as event_name, e.starts_on
      from bands b
      join events e on e.id = b.event_id
     where e.organization_id = (select organization_id from ev)
       and e.id <> p_event
       and b.details_removed_at is null
  )
  select p.email::text,
         p.full_name,
         array_agg(distinct past.band_name || ' (' || past.school_name || ')'),
         (array_agg(past.event_name order by past.starts_on desc))[1],
         max(past.starts_on),
         exists (select 1 from bands b2 where b2.event_id = p_event and b2.director_user_id = p.id),
         (select i.sent_at from band_invitations i where i.event_id = p_event and i.email = p.email)
    from past
    join profiles p on p.id = past.director_user_id
   -- Demo directors (demo mode) aren't real people to invite.
   where p.email::text not like '%@demo.fieldcommandevents.com'
   group by p.id, p.email, p.full_name
   order by max(past.starts_on) desc, p.full_name;
$$;

-- 4. Fair booth contacts, 15 months after the event -------------------------
create function public.purge_booth_contacts()
returns integer
language sql security definer set search_path = public
as $$
  with cleared as (
    update fair_booths f
       set contact_name = null, contact_email = null, contact_phone = null
      from events e
     where e.id = f.event_id
       and (now() at time zone e.timezone)::date > (e.ends_on + interval '15 months')::date
       and (f.contact_name is not null or f.contact_email is not null or f.contact_phone is not null)
    returning 1
  )
  select count(*)::int from cleared;
$$;
revoke execute on function public.purge_booth_contacts() from public, anon, authenticated;
grant execute on function public.purge_booth_contacts() to service_role;

-- 5. Uploaded files, 30 days after the event --------------------------------
-- Also the files of accounts due for deletion: the server removes them from
-- storage before purge_closed_accounts() deletes the rows with the events.
create function public.expired_event_files()
returns table (id uuid, path text)
language sql stable security definer set search_path = public
as $$
  select f.id, f.path
    from event_files f
    join events e on e.id = f.event_id
    join organizations o on o.id = e.organization_id
   where (now() at time zone e.timezone)::date > e.ends_on + 30
      or o.closed_at < now() - interval '90 days';
$$;
revoke execute on function public.expired_event_files() from public, anon, authenticated;
grant execute on function public.expired_event_files() to service_role;
