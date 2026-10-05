-- =============================================================================
-- Co-hosts: more than one person running the organization's events. A
-- co-host is an organization member with the 'admin' role, so they can do
-- everything the host can, on all of the organization's events.
-- =============================================================================

-- Invitations can now be for a co-host (as_host) instead of an event role.
alter table public.invitations alter column role drop not null;
alter table public.invitations add column as_host boolean not null default false;
alter table public.invitations
  add constraint invitations_host_or_role check ((as_host and role is null and station_id is null) or (not as_host and role is not null));
create unique index invitations_one_open_host on public.invitations (event_id, email) where as_host and accepted_at is null;
grant insert (as_host) on public.invitations to authenticated;
-- (Only hosts can invite co-hosts: the Volunteer Lead policy requires role = 'section_lead'.)

-- The invite page needs to know it's a co-host invitation.
drop function public.get_invitation(uuid);
create function public.get_invitation(p_token uuid)
returns table (
  email           text,
  role            public.event_staff_role,
  as_host         boolean,
  event_id        uuid,
  event_name      text,
  starts_on       date,
  ends_on         date,
  organization    text,
  station_name    text,
  expired         boolean,
  accepted        boolean
)
language sql stable security definer set search_path = public
as $$
  select i.email::text, i.role, i.as_host, e.id, e.name, e.starts_on, e.ends_on, o.name, s.name,
         i.expires_at < now(), i.accepted_at is not null
    from invitations i
    join events e on e.id = i.event_id
    join organizations o on o.id = e.organization_id
    left join stations s on s.id = i.station_id
   where i.token = p_token;
$$;
revoke execute on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- Accepting a co-host invitation joins the organization.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  inv invitations;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first' using errcode = '42501';
  end if;
  select * into inv from invitations where token = p_token for update;
  if inv.id is null then
    raise exception 'This invitation link isn''t valid' using errcode = 'P0001';
  end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = auth.uid() then
      return inv.event_id;
    end if;
    raise exception 'This invitation has already been used' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask for a new one.' using errcode = 'P0001';
  end if;
  if inv.email <> public.current_email() then
    raise exception 'This invitation was sent to %. Sign in with that email to accept it.', inv.email
      using errcode = 'P0001';
  end if;

  if inv.as_host then
    insert into organization_members (organization_id, user_id, role)
    select e.organization_id, auth.uid(), 'admin' from events e where e.id = inv.event_id
    on conflict do nothing;
  else
    insert into event_staff (event_id, user_id, role)
    values (inv.event_id, auth.uid(), inv.role)
    on conflict do nothing;
    if inv.station_id is not null then
      insert into station_leads (station_id, user_id, event_id)
      values (inv.station_id, auth.uid(), inv.event_id)
      on conflict do nothing;
    end if;
  end if;

  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.event_id;
end;
$$;

-- Hosts can remove co-hosts (never the organization's owner).
create policy "org members: hosts remove co-hosts" on public.organization_members
  for delete to authenticated
  using (role = 'admin' and public.is_org_admin(organization_id));
