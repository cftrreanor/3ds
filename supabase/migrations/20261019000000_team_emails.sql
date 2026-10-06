-- =============================================================================
-- Team invitations by email, and a list of removed team members.
--   * Each invitation gets a second, secret key (email_token) that only goes
--     out in the invitation email. Opening that link proves the person owns
--     the email, so they can join with one tap, without a separate sign-in
--     email. Nobody can read it from a browser (not even the host), so it
--     can't be used to sign in as someone else. Re-sending makes a new one.
--   * Removing a co-host, Volunteer Lead or Section Lead keeps a record, so
--     the Team page can list removed people and re-invite them.
-- =============================================================================

alter table public.invitations
  add column email_token uuid not null default gen_random_uuid() unique,
  add column sent_at timestamptz;

-- Every column except the secret email_token.
revoke select on public.invitations from anon, authenticated;
grant select (id, event_id, email, role, as_host, station_id, token, invited_by, created_at, expires_at,
              accepted_at, accepted_by, sent_at)
  on public.invitations to authenticated;

-- Before (re)sending an invitation email: checks you may send it, gives the
-- link a fresh 30 days if it ran out, and replaces the secret key so older
-- emails stop working. Returns what the email needs, but never the key: the
-- server reads that with its private key.
create function public.prepare_invitation_email(p_id uuid)
returns table (
  email         text,
  role          public.event_staff_role,
  as_host       boolean,
  token         uuid,
  expires_at    timestamptz,
  event_name    text,
  starts_on     date,
  ends_on       date,
  venue_name    text,
  organization  text,
  station_name  text,
  inviter_name  text
)
language plpgsql security definer set search_path = public
as $$
declare
  inv invitations;
begin
  select * into inv from invitations i where i.id = p_id for update;
  if inv.id is null
     or not coalesce(public.is_event_admin(inv.event_id)
                     or (inv.role = 'section_lead' and public.can_manage_volunteers(inv.event_id)), false) then
    raise exception 'You don''t have permission to send that invitation' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'That invitation has already been accepted' using errcode = 'P0001';
  end if;

  update invitations i
     set email_token = gen_random_uuid(),
         sent_at = now(),
         expires_at = greatest(i.expires_at, now() + interval '30 days')
   where i.id = inv.id;

  return query
    select i.email::text, i.role, i.as_host, i.token, i.expires_at, e.name, e.starts_on, e.ends_on, e.venue_name,
           o.name, s.name, nullif(p.full_name, '')
      from invitations i
      join events e on e.id = i.event_id
      join organizations o on o.id = e.organization_id
      left join stations s on s.id = i.station_id
      left join profiles p on p.id = auth.uid()
     where i.id = inv.id;
end;
$$;
revoke execute on function public.prepare_invitation_email(uuid) from public, anon;
grant execute on function public.prepare_invitation_email(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Removed team members
-- -----------------------------------------------------------------------------
create table public.team_removals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  -- Co-hosts belong to the whole organization; leads to one event.
  event_id         uuid references public.events (id) on delete cascade,
  role             text not null check (role in ('co_host', 'volunteer_director', 'section_lead')),
  user_id          uuid not null,
  email            text not null,
  full_name        text not null default '',
  removed_by       uuid,
  removed_at       timestamptz not null default now(),
  check ((role = 'co_host') = (event_id is null))
);
create index on public.team_removals (event_id);
create index on public.team_removals (organization_id);

alter table public.team_removals enable row level security;
revoke all on public.team_removals from anon, authenticated;
grant select on public.team_removals to authenticated;
create policy "team removals: hosts see removed co-hosts" on public.team_removals
  for select to authenticated using (role = 'co_host' and public.is_org_admin(organization_id));
create policy "team removals: managers see removed leads" on public.team_removals
  for select to authenticated using (event_id is not null and public.can_manage_volunteers(event_id));

-- Removing someone records it; adding them back clears the record.
create function public.event_staff_record_removal()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  org uuid;
  person profiles;
begin
  -- Not when the whole event or the person's account is being deleted.
  select organization_id into org from events where id = old.event_id;
  select * into person from profiles where id = old.user_id;
  if org is null or person.id is null then
    return old;
  end if;
  delete from team_removals where event_id = old.event_id and user_id = old.user_id and role = old.role::text;
  insert into team_removals (organization_id, event_id, role, user_id, email, full_name, removed_by)
  values (org, old.event_id, old.role::text, old.user_id, person.email, person.full_name, auth.uid());
  return old;
end;
$$;
create trigger event_staff_record_removal
  after delete on public.event_staff
  for each row execute function public.event_staff_record_removal();

create function public.event_staff_clear_removal()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from team_removals where event_id = new.event_id and user_id = new.user_id and role = new.role::text;
  return new;
end;
$$;
create trigger event_staff_clear_removal
  after insert on public.event_staff
  for each row execute function public.event_staff_clear_removal();

create function public.org_members_record_removal()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  person profiles;
begin
  if old.role <> 'admin' or not exists (select 1 from organizations where id = old.organization_id) then
    return old;
  end if;
  select * into person from profiles where id = old.user_id;
  if person.id is null then
    return old;
  end if;
  delete from team_removals where organization_id = old.organization_id and user_id = old.user_id and role = 'co_host';
  insert into team_removals (organization_id, role, user_id, email, full_name, removed_by)
  values (old.organization_id, 'co_host', old.user_id, person.email, person.full_name, auth.uid());
  return old;
end;
$$;
create trigger org_members_record_removal
  after delete on public.organization_members
  for each row execute function public.org_members_record_removal();

create function public.org_members_clear_removal()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from team_removals where organization_id = new.organization_id and user_id = new.user_id and role = 'co_host';
  return new;
end;
$$;
create trigger org_members_clear_removal
  after insert on public.organization_members
  for each row execute function public.org_members_clear_removal();
