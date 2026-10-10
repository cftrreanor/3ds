-- =============================================================================
-- The company name is "Field Command Events": the database's own messages
-- (for example "Hosting on Field Command Events is by invitation") now say
-- so. Each function below is the latest version, unchanged except for that
-- wording; permissions on them stay as they were.
-- =============================================================================

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

create or replace function public.admin_invite_host(p_email text, p_pilot_request uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  addr citext := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can invite hosts.' using errcode = '42501';
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

create or replace function public.events_publish_needs_plan()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'published' and old.status is distinct from 'published'
     and not public.org_has_active_plan(new.organization_id) then
    raise exception 'Publishing needs an active Field Command Events plan' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.admin_set_plan(p_org uuid, p_status public.subscription_status, p_free_until date, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before organizations;
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change plans' using errcode = '42501';
  end if;
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
  values (auth.uid(), 'plan_changed', p_org, jsonb_build_object(
    'from', jsonb_build_object('status', before.subscription_status, 'free_until', before.free_until),
    'to', jsonb_build_object('status', p_status, 'free_until', case when p_status in ('comped', 'trialing') then p_free_until end),
    'note', nullif(trim(coalesce(p_note, '')), '')
  ));
end;
$$;

create or replace function public.admin_sign_ins()
returns table (user_id uuid, created_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can see sign-ins.' using errcode = '42501';
  end if;
  return query
    select u.id, u.created_at, u.email_confirmed_at, u.last_sign_in_at
      from auth.users u join profiles p on p.id = u.id;
end;
$$;

create or replace function public.admin_auth_history(p_user uuid, p_limit int default 50)
returns table (at timestamptz, action text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can see sign-ins.' using errcode = '42501';
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
