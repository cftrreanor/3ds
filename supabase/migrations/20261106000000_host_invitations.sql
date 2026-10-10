-- =============================================================================
-- Hosts by invitation.
--
-- Anyone could sign up and create an organization (a host account with free
-- draft events). Now a FieldCommand admin invites each new host by email,
-- usually from their pilot request; that person signs in with the invited
-- email (which Supabase has confirmed) and sets up their organization.
-- Directors, team members, volunteers and parents are unaffected: they never
-- create organizations. Co-hosts still join an existing organization through
-- the host's own invitations.
--   * host_invitations: one row per invited email (an invitation is used up
--     when its organization is created; inviting again re-arms it).
--   * admin_invite_host(email, pilot_request): platform admins only; logged.
--   * has_host_invitation(): does the signed-in email have one waiting?
--   * create_organization(): needs a waiting invitation (or a platform admin).
-- =============================================================================

create table public.host_invitations (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  pilot_request_id  uuid references public.pilot_requests (id) on delete set null,
  invited_by        uuid references public.profiles (id) on delete set null,
  invited_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '30 days',
  used_at           timestamptz,
  organization_id   uuid references public.organizations (id) on delete set null
);
alter table public.host_invitations enable row level security;
revoke all on public.host_invitations from anon, authenticated;
grant select on public.host_invitations to authenticated;
create policy "host invitations: admins read" on public.host_invitations
  for select to authenticated using (public.is_platform_admin());

create function public.admin_invite_host(p_email text, p_pilot_request uuid default null)
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
    update pilot_requests set status = 'accepted' where id = p_pilot_request;
  end if;
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'invite_host', jsonb_build_object('email', addr::text, 'pilot_request', p_pilot_request));
end;
$$;

create function public.has_host_invitation()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from host_invitations
     where email = public.current_email() and used_at is null and expires_at > now()
  );
$$;

create or replace function public.create_organization(org_name text, org_slug text, tz text default 'America/Chicago')
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  org public.organizations;
  inv uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select id into inv from host_invitations
   where email = public.current_email() and used_at is null and expires_at > now()
   for update;
  if inv is null and not public.is_platform_admin() then
    raise exception 'Hosting on FieldCommand is by invitation. Request a pilot spot and we''ll set you up.' using errcode = '42501';
  end if;
  insert into organizations (name, slug, default_timezone)
  values (org_name, org_slug, tz)
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, auth.uid(), 'owner');
  if inv is not null then
    update host_invitations set used_at = now(), organization_id = org.id where id = inv;
  end if;
  return org;
end;
$$;

revoke execute on function public.admin_invite_host(text, uuid), public.has_host_invitation() from public, anon;
grant execute on function public.admin_invite_host(text, uuid), public.has_host_invitation() to authenticated;
