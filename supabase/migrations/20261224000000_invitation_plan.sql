-- =============================================================================
-- Pick a host's package and pilot length when inviting them.
--
-- An organization doesn't exist until the invited person sets it up, so the
-- admin's choices wait on their host_invitations row:
--   * package (a plan_tiers package), plan_status (comped or trialing) and
--     free_until (the last free day). All empty means nothing was chosen:
--     older invitations and email-only invites behave exactly as before.
--   * admin_invite_host() takes them, and inviting again keeps earlier choices
--     unless new ones are given.
--   * admin_set_invitation_plan() changes them before the invitation is used.
--   * create_organization() and create_teacher_account() apply them to the new
--     organization through the same steps as admin_set_plan() and
--     set_account_package(), logged in admin_log with the note "Set from host
--     invitation" (by the admin who invited them).
-- Hosts still can't change their own package or plan: organizations only
-- grants updates of name and default_timezone, and the package columns are
-- guarded by package_changes_go_through_admin.
-- =============================================================================

alter table public.host_invitations
  add column package text references public.plan_tiers (code),
  add column plan_status public.subscription_status,
  add column free_until date,
  add constraint host_invitations_plan_check
    check ((plan_status is null and free_until is null)
           or (plan_status in ('comped', 'trialing') and free_until is not null));

-- A package, not a pass.
create function public.host_invitations_package_check()
returns trigger
language plpgsql
as $$
begin
  if new.package is not null and not exists (select 1 from plan_tiers where code = new.package and kind = 'package') then
    raise exception 'Pick a package.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger host_invitations_package_check
  before insert or update of package on public.host_invitations
  for each row execute function public.host_invitations_package_check();
revoke execute on function public.host_invitations_package_check() from public, anon, authenticated;

-- 1. One set of steps for each change, shared by the admin screens and invitations -------
-- Not callable from the browser: the public functions below check who's asking first.
create function public.apply_plan(p_org uuid, p_status public.subscription_status, p_free_until date, p_note text, p_actor uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before organizations;
begin
  if p_status in ('comped', 'trialing') and p_free_until is null then
    raise exception 'Pick the last day of the free period' using errcode = 'P0001';
  end if;
  select * into before from organizations where id = p_org for update;
  if not found then
    raise exception 'Organization not found' using errcode = 'P0001';
  end if;

  update organizations
     set subscription_status = p_status,
         free_until = case when p_status in ('comped', 'trialing') then p_free_until end
   where id = p_org;

  insert into admin_log (admin_id, action, organization_id, details)
  values (p_actor, 'plan_changed', p_org, jsonb_build_object(
    'from', jsonb_build_object('status', before.subscription_status, 'free_until', before.free_until),
    'to', jsonb_build_object('status', p_status, 'free_until', case when p_status in ('comped', 'trialing') then p_free_until end),
    'note', nullif(trim(coalesce(p_note, '')), '')
  ));
end;
$$;
revoke execute on function public.apply_plan(uuid, public.subscription_status, date, text, uuid) from public, anon, authenticated;

create function public.apply_package(p_org uuid, p_package text, p_rate text, p_note text, p_source text, p_actor uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before organizations;
begin
  if not exists (select 1 from plan_tiers where code = p_package and kind = 'package') then
    raise exception 'Pick a package.' using errcode = 'P0001';
  end if;
  if coalesce(p_rate, '') not in ('teacher', 'standard') then
    raise exception 'Pick a rate.' using errcode = 'P0001';
  end if;
  select * into before from organizations where id = p_org for update;
  if before.id is null then
    raise exception 'Organization not found' using errcode = 'P0001';
  end if;
  if before.package = p_package and before.rate = p_rate then
    return;
  end if;
  perform set_config('app.package_change', 'on', true);
  update organizations
     set package = p_package, rate = p_rate,
         had_volunteer_tracking = had_volunteer_tracking or (select volunteer_history from plan_tiers where code = p_package)
   where id = p_org;
  perform set_config('app.package_change', 'off', true);
  insert into admin_log (admin_id, action, organization_id, details)
  values (p_actor, 'package_changed', p_org, jsonb_build_object(
    'from', jsonb_build_object('package', before.package, 'rate', before.rate),
    'to', jsonb_build_object('package', p_package, 'rate', p_rate),
    'source', p_source,
    'note', nullif(trim(coalesce(p_note, '')), '')
  ));
end;
$$;
revoke execute on function public.apply_package(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- The admin screens, unchanged for callers: they check who's asking, then use the shared steps.
create or replace function public.admin_set_plan(p_org uuid, p_status public.subscription_status, p_free_until date, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change plans' using errcode = '42501';
  end if;
  perform public.apply_plan(p_org, p_status, p_free_until, p_note, auth.uid());
end;
$$;

create or replace function public.set_account_package(p_org uuid, p_package text, p_rate text, p_note text, p_source text default 'admin')
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.package_caller_ok(p_source) then
    raise exception 'Only Field Command Events admins or a payment can change packages.' using errcode = '42501';
  end if;
  perform public.apply_package(p_org, p_package, p_rate, p_note, p_source, auth.uid());
end;
$$;

-- What the invitation chose, applied to the organization just set up from it.
create function public.apply_invitation_plan(p_org uuid, inv public.host_invitations)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if inv.plan_status is not null then
    perform public.apply_plan(p_org, inv.plan_status, inv.free_until, 'Set from host invitation', inv.invited_by);
  end if;
  if inv.package is not null then
    perform public.apply_package(p_org, inv.package, (select rate from organizations where id = p_org),
                                 'Set from host invitation', 'admin', inv.invited_by);
  end if;
end;
$$;
revoke execute on function public.apply_invitation_plan(uuid, public.host_invitations) from public, anon, authenticated;

-- 2. Inviting, with the choices ---------------------------------------------------
drop function if exists public.admin_invite_host(text, uuid);
create function public.admin_invite_host(
  p_email text,
  p_pilot_request uuid default null,
  p_package text default null,
  p_plan_status public.subscription_status default null,
  p_free_until date default null)
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
  if p_plan_status is not null and (p_plan_status not in ('comped', 'trialing') or p_free_until is null) then
    raise exception 'Pick a free pilot or trial, and its last free day.' using errcode = 'P0001';
  end if;
  insert into host_invitations (email, pilot_request_id, invited_by, package, plan_status, free_until)
  values (addr, p_pilot_request, auth.uid(), p_package, p_plan_status, case when p_plan_status is not null then p_free_until end)
  on conflict (email) do update
    set pilot_request_id = coalesce(excluded.pilot_request_id, host_invitations.pilot_request_id),
        invited_by = excluded.invited_by,
        invited_at = now(),
        expires_at = now() + interval '30 days',
        used_at = null,
        organization_id = null,
        -- Inviting again keeps earlier choices unless new ones are given.
        package = coalesce(excluded.package, host_invitations.package),
        plan_status = coalesce(excluded.plan_status, host_invitations.plan_status),
        free_until = case when excluded.plan_status is not null then excluded.free_until else host_invitations.free_until end;
  if p_pilot_request is not null then
    -- Never moves a request backwards (inviting again after they've set up).
    update pilot_requests set status = 'invited'
     where id = p_pilot_request and status in ('new', 'contacted', 'declined');
  end if;
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'invite_host', jsonb_build_object(
    'email', addr::text, 'pilot_request', p_pilot_request,
    'package', p_package, 'plan_status', p_plan_status, 'free_until', p_free_until));
end;
$$;
revoke execute on function public.admin_invite_host(text, uuid, text, public.subscription_status, date) from public, anon;
grant execute on function public.admin_invite_host(text, uuid, text, public.subscription_status, date) to authenticated;

-- Change the choices on an invitation that hasn't been used yet (no email is sent).
create function public.admin_set_invitation_plan(p_email text, p_package text, p_plan_status public.subscription_status, p_free_until date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  addr citext := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can change invitations.' using errcode = '42501';
  end if;
  if p_plan_status is not null and (p_plan_status not in ('comped', 'trialing') or p_free_until is null) then
    raise exception 'Pick a free pilot or trial, and its last free day.' using errcode = 'P0001';
  end if;
  update host_invitations
     set package = p_package,
         plan_status = p_plan_status,
         free_until = case when p_plan_status is not null then p_free_until end
   where email = addr and used_at is null;
  if not found then
    raise exception 'That invitation has already been used. Change their plan on their account page.' using errcode = 'P0001';
  end if;
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'invitation_plan_changed', jsonb_build_object(
    'email', addr::text, 'package', p_package, 'plan_status', p_plan_status, 'free_until', p_free_until));
end;
$$;
revoke execute on function public.admin_set_invitation_plan(text, text, public.subscription_status, date) from public, anon;
grant execute on function public.admin_set_invitation_plan(text, text, public.subscription_status, date) to authenticated;

-- 3. Setting up an organization applies the invitation's choices ------------------
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
    perform public.apply_invitation_plan(org.id, inv);
    select * into org from organizations where id = org.id;
  end if;
  return org;
end;
$$;

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
  -- No plan, as before, unless the invitation chose one.
  insert into organizations (name, slug, default_timezone, account_kind, school)
  values (v_name,
          trim(both '-' from left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 40)) || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
          p_tz, 'teacher', v_school)
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, me, 'owner');
  if inv.id is not null then
    update host_invitations set used_at = now(), organization_id = org.id where id = inv.id;
    perform public.apply_invitation_plan(org.id, inv);
    select * into org from organizations where id = org.id;
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
