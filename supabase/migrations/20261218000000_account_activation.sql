-- =============================================================================
-- Accounts are switched on by us, and switched off cleanly.
--
-- 1. Accepting a host invitation starts the account on the free pilot plan,
--    through the pilot's end (src/lib/pilot.ts PILOT_END), so it can publish
--    right away. Before, a new account had no plan until an admin set one.
-- 2. Free teacher accounts need an invitation too (no more self-serve): the
--    teacher asks through the pilot form, which now offers parent-teacher
--    conferences, and an admin approves them like any other request. Their
--    plan is unchanged (none: one free conference at a time, weekly hours premium).
-- 3. Closing an account takes its published events offline at once, and a
--    closed account can't publish. Before, its events stayed up until the
--    account was deleted 90 days later. Reopening doesn't republish them.
-- =============================================================================

-- 1. New accounts start on the pilot ---------------------------------------------
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
    raise exception 'Hosting on Field Command Events is by invitation. Request a pilot spot and we''ll set you up.' using errcode = '42501';
  end if;
  insert into organizations (name, slug, default_timezone, subscription_status, free_until)
  values (org_name, org_slug, tz, 'comped', date '2027-01-01')
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

-- 2. Teacher accounts by invitation ----------------------------------------------
create or replace function public.create_teacher_account(p_full_name text, p_school text, p_tz text)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_name text := trim(coalesce(p_full_name, ''));
  v_school text := trim(coalesce(p_school, ''));
  org public.organizations;
  inv host_invitations;
begin
  if me is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your name.' using errcode = 'P0001';
  end if;
  if char_length(v_school) < 2 or char_length(v_school) > 160 then
    raise exception 'Please enter your school''s name.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'Please pick your time zone.' using errcode = 'P0001';
  end if;
  -- One account per person (also stops a double tap making two).
  perform pg_advisory_xact_lock(hashtext('create_teacher_account'), hashtext(me::text));
  if exists (select 1 from organization_members where user_id = me) then
    raise exception 'You already have an account. Go to your dashboard to see it.' using errcode = 'P0001';
  end if;
  select * into inv from host_invitations
   where email = public.current_email() and used_at is null and expires_at > now()
   for update;
  if inv.id is null and not public.is_platform_admin() then
    raise exception 'Accounts are by invitation. Join the pilot and we''ll set you up.' using errcode = '42501';
  end if;

  update profiles set full_name = v_name where id = me;
  -- No plan, as before: a teacher account's one free conference doesn't need one,
  -- and weekly hours stay premium.
  insert into organizations (name, slug, default_timezone, account_kind, school)
  values (v_name,
          trim(both '-' from left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 40)) || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
          p_tz, 'teacher', v_school)
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, me, 'owner');
  if inv.id is not null then
    update host_invitations set used_at = now(), organization_id = org.id where id = inv.id;
  end if;
  if inv.pilot_request_id is not null then
    -- Invited from their pilot request: that card moves on.
    update pilot_requests set status = 'set_up', organization_id = org.id
     where id = inv.pilot_request_id and status in ('new', 'contacted', 'invited', 'declined');
  else
    -- Invited by email alone: their card in the admin pipeline, as before.
    insert into pilot_requests (name, email, organization, status, organization_id, notes)
    values (v_name, public.current_email()::text, v_school, 'teacher', org.id, 'Set up a free teacher account.');
  end if;
  return org;
end;
$$;

-- The pilot form can now ask for parent-teacher conferences.
alter table public.pilot_requests drop constraint if exists pilot_requests_event_types_check;
alter table public.pilot_requests add constraint pilot_requests_event_types_check
  check (event_types <@ array['band_contest', 'group_event', 'fair', 'volunteer', 'school_visit', 'conference', 'other']::text[]
         and cardinality(event_types) <= 7);

-- 3. Closing takes events offline ------------------------------------------------
create or replace function public.admin_close_account(p_org uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can close accounts.' using errcode = '42501';
  end if;
  update organizations set closed_at = now() where id = p_org and closed_at is null;
  if not found then
    raise exception 'That account is already closed, or doesn''t exist.' using errcode = 'P0001';
  end if;
  update events set status = 'draft' where organization_id = p_org and status = 'published';
  get diagnostics n = row_count;
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'account_closed', p_org,
          jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), ''), 'unpublished', n));
end;
$$;

-- A suspended or closed account can't publish, whoever tries.
create or replace function public.suspended_accounts_cant_publish()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if exists (select 1 from organizations where id = new.organization_id and suspended_at is not null) then
      raise exception 'This account is suspended, so its events can''t be published. Please contact us.' using errcode = '42501';
    end if;
    if exists (select 1 from organizations where id = new.organization_id and closed_at is not null) then
      raise exception 'This account is closed, so its events can''t be published. Please contact us.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
