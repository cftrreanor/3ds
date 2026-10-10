-- =============================================================================
-- Admin dashboard as a CRM: a pilot pipeline, private notes and follow-ups,
-- a log of the emails we send, and each person's sign-in history.
-- Everything here is for FieldCommand admins (platform_admins) only.
--
--   * pilot_requests.status is now a pipeline stage:
--       new → contacted → invited → set_up → active   (or declined)
--     Inviting a host moves the request to "invited", setting up the
--     organization moves it to "set_up", and publishing its first event moves
--     it to "active". Admins can also move a request by hand.
--   * admin_notes: private notes on an account (organization), a person or a
--     pilot request. A note with a follow-up date is a reminder until it's
--     marked done.
--   * email_log: each email the app sends (to, subject, sent or not). Kept
--     180 days for people with an account, 14 days for everyone else
--     (volunteers, parents), by purge_admin_records() in the daily job.
--   * admin_auth_history(user) and admin_sign_ins(): sign-ins from Supabase's
--     own records, for the admin's person and account pages.
-- =============================================================================

-- 1. Pipeline stages ---------------------------------------------------------
alter table public.pilot_requests drop constraint if exists pilot_requests_status_check;
update public.pilot_requests set status = 'invited' where status = 'accepted';
alter table public.pilot_requests add constraint pilot_requests_status_check
  check (status in ('new', 'contacted', 'invited', 'set_up', 'active', 'declined'));
alter table public.pilot_requests
  add column organization_id uuid references public.organizations (id) on delete set null,
  add column stage_changed_at timestamptz not null default now();
update public.pilot_requests set stage_changed_at = created_at;

create function public.pilot_requests_stage_changed()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger pilot_requests_stage_changed
  before update of status on public.pilot_requests
  for each row execute function public.pilot_requests_stage_changed();

-- Requests whose host has already set up: link the organization and catch up the stage.
update public.pilot_requests p
   set organization_id = h.organization_id,
       status = case
         when exists (select 1 from public.events e where e.organization_id = h.organization_id and e.status = 'published') then 'active'
         else 'set_up' end
  from public.host_invitations h
 where h.pilot_request_id = p.id and h.organization_id is not null
   and p.status in ('new', 'contacted', 'invited');

create or replace function public.admin_invite_host(p_email text, p_pilot_request uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  addr citext := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can invite hosts.' using errcode = '42501';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  insert into host_invitations (email, pilot_request_id, invited_by)
  values (addr, p_pilot_request, auth.uid())
  on conflict (email) do update
    set pilot_request_id = coalesce(excluded.pilot_request_id, host_invitations.pilot_request_id),
        invited_by = excluded.invited_by,
        invited_at = now(),
        expires_at = now() + interval '30 days',
        used_at = null,
        organization_id = null;
  if p_pilot_request is not null then
    -- Never moves a request backwards (inviting again after they've set up).
    update pilot_requests set status = 'invited'
     where id = p_pilot_request and status in ('new', 'contacted', 'declined');
  end if;
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'invite_host', jsonb_build_object('email', addr::text, 'pilot_request', p_pilot_request));
end;
$$;

create or replace function public.create_organization(org_name text, org_slug text, tz text default 'America/Chicago')
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  org public.organizations;
  inv host_invitations;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into inv from host_invitations
   where email = public.current_email() and used_at is null and expires_at > now()
   for update;
  if inv.id is null and not public.is_platform_admin() then
    raise exception 'Hosting on FieldCommand is by invitation. Request a pilot spot and we''ll set you up.' using errcode = '42501';
  end if;
  insert into organizations (name, slug, default_timezone)
  values (org_name, org_slug, tz)
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, auth.uid(), 'owner');
  if inv.id is not null then
    update host_invitations set used_at = now(), organization_id = org.id where id = inv.id;
    update pilot_requests set status = 'set_up', organization_id = org.id
     where id = inv.pilot_request_id and status in ('new', 'contacted', 'invited', 'declined');
  end if;
  return org;
end;
$$;

-- Publishing an organization's first event makes its pilot "active".
create function public.pilot_request_goes_active()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    update pilot_requests set status = 'active'
     where organization_id = new.organization_id and status = 'set_up';
  end if;
  return new;
end;
$$;
create trigger pilot_request_goes_active
  after update of status on public.events
  for each row execute function public.pilot_request_goes_active();
revoke execute on function public.pilot_request_goes_active() from public, anon, authenticated;

-- 2. Notes and follow-ups ----------------------------------------------------
create table public.admin_notes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations (id) on delete cascade,
  profile_id        uuid references public.profiles (id) on delete cascade,
  pilot_request_id  uuid references public.pilot_requests (id) on delete cascade,
  body              text not null check (char_length(trim(body)) between 1 and 5000),
  follow_up_on      date,
  done_at           timestamptz,
  done_by           uuid references public.profiles (id) on delete set null,
  author_id         uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  check (num_nonnulls(organization_id, profile_id, pilot_request_id) >= 1)
);
create index on public.admin_notes (organization_id, created_at desc);
create index on public.admin_notes (profile_id, created_at desc);
create index on public.admin_notes (pilot_request_id, created_at desc);
create index on public.admin_notes (follow_up_on) where follow_up_on is not null and done_at is null;

alter table public.admin_notes enable row level security;
revoke all on public.admin_notes from anon, authenticated;
grant select, insert, delete on public.admin_notes to authenticated;
grant update (body, follow_up_on, done_at, done_by) on public.admin_notes to authenticated;
create policy "admin notes: admins read" on public.admin_notes
  for select to authenticated using (public.is_platform_admin());
create policy "admin notes: admins add their own" on public.admin_notes
  for insert to authenticated with check (public.is_platform_admin() and author_id = auth.uid());
create policy "admin notes: admins update" on public.admin_notes
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "admin notes: admins delete" on public.admin_notes
  for delete to authenticated using (public.is_platform_admin());

-- 3. Emails sent -------------------------------------------------------------
create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  to_email    citext not null,
  subject     text not null,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  error       text,
  created_at  timestamptz not null default now()
);
create index on public.email_log (to_email, created_at desc);
create index on public.email_log (created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
grant select on public.email_log to authenticated;
create policy "email log: admins read" on public.email_log
  for select to authenticated using (public.is_platform_admin());

-- Daily clean-up (service role only). Returns how many emails were removed.
create function public.purge_admin_records()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  n int;
begin
  delete from email_log l
   where l.created_at < now() - interval '180 days'
      or (l.created_at < now() - interval '14 days'
          and not exists (select 1 from profiles p where p.email = l.to_email));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_admin_records() from public, anon, authenticated;
grant execute on function public.purge_admin_records() to service_role;

-- 4. Sign-ins ----------------------------------------------------------------
-- Everyone's account dates (for the people and accounts tables).
create function public.admin_sign_ins()
returns table (user_id uuid, created_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can see sign-ins.' using errcode = '42501';
  end if;
  return query
    select u.id, u.created_at, u.email_confirmed_at, u.last_sign_in_at
      from auth.users u join profiles p on p.id = u.id;
end;
$$;

-- One person's recent account activity from Supabase's audit log: sign-ins,
-- sign-in links requested, password changes. (Session refreshes are left out.)
create function public.admin_auth_history(p_user uuid, p_limit int default 50)
returns table (at timestamptz, action text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can see sign-ins.' using errcode = '42501';
  end if;
  return query
    select a.created_at, a.payload ->> 'action'
      from auth.audit_log_entries a
     where a.payload ->> 'actor_id' = p_user::text
       and coalesce(a.payload ->> 'action', '') not in ('token_refreshed', 'token_revoked')
     order by a.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.admin_sign_ins(), public.admin_auth_history(uuid, int) from public, anon;
grant execute on function public.admin_sign_ins(), public.admin_auth_history(uuid, int) to authenticated;
