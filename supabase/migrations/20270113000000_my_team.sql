-- =============================================================================
-- My team: one place for the account's whole team, with the removal ladder the
-- owner decided, enforced here rather than by which buttons a page shows.
--
--   * Who removes whom: the Account Host removes co-hosts; co-hosts (and the
--     Account Host) remove Volunteer Leads and Coordinators; Volunteer Leads
--     remove Coordinators on their events. Anyone can leave. Nobody removes the
--     Account Host. Only the Account Host invites co-hosts.
--   * A co-host who leaves or is removed also stops leading jobs on the
--     account's events (before, they kept event-day access to those jobs'
--     volunteers through their job leads).
--   * Co-host invitations belong to the account, not to one event.
--   * Team spots: open invitations hold a spot until they're accepted,
--     cancelled, or expire. Volunteer Leads and Coordinators stop counting once
--     their event is over (co-hosts always count).
--   * The Account Host can hand the account on to a co-host, who accepts.
--   * Volunteer Leads see removed Coordinators only, not other removed leads.
-- =============================================================================

-- 1. The Account Host ----------------------------------------------------------
create function public.is_org_owner(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from organization_members
                  where organization_id = org and user_id = auth.uid() and role = 'owner');
$$;
revoke execute on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- 2. Removing co-hosts: the Account Host, or the co-host themself --------------
drop policy "org members: hosts remove co-hosts" on public.organization_members;
create policy "org members: owner removes co-hosts, co-hosts leave" on public.organization_members
  for delete to authenticated
  using (role = 'admin' and (user_id = auth.uid() or public.is_org_owner(organization_id)));

-- A co-host who leaves stops leading jobs on the account's events, unless they're
-- also on that event's team in their own right.
create function public.org_members_clear_leads()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from station_leads sl
   using events e
   where e.id = sl.event_id
     and e.organization_id = old.organization_id
     and sl.user_id = old.user_id
     and not exists (select 1 from event_staff s where s.event_id = sl.event_id and s.user_id = old.user_id);
  return null;
end;
$$;
revoke execute on function public.org_members_clear_leads() from public, anon, authenticated;
create trigger org_members_clear_leads
  after delete on public.organization_members
  for each row execute function public.org_members_clear_leads();

-- 3. Volunteer Leads and Coordinators can leave ---------------------------------
create policy "staff: leave" on public.event_staff
  for delete to authenticated using (user_id = auth.uid());

-- 4. Co-host invitations belong to the account ----------------------------------
alter table public.invitations add column organization_id uuid references public.organizations (id) on delete cascade;
update public.invitations i set organization_id = e.organization_id from public.events e where e.id = i.event_id;
alter table public.invitations alter column organization_id set not null;
alter table public.invitations alter column event_id drop not null;
alter table public.invitations add constraint invitations_event_unless_host check (event_id is not null or as_host);
create index on public.invitations (organization_id);
grant insert (organization_id) on public.invitations to authenticated;

-- An event's invitation takes the event's account; an account invitation names its own.
create function public.invitations_set_org()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.event_id is not null then
    new.organization_id := (select organization_id from events where id = new.event_id);
  end if;
  if new.organization_id is null then
    raise exception 'Choose the account or the event for this invitation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.invitations_set_org() from public, anon, authenticated;
-- Named to run before the other insert triggers (they go in name order).
create trigger invitations_0_set_org
  before insert on public.invitations
  for each row execute function public.invitations_set_org();

-- One open co-host invitation per person per account (older duplicates go).
delete from public.invitations a
 using public.invitations b
 where a.as_host and b.as_host and a.accepted_at is null and b.accepted_at is null
   and a.organization_id = b.organization_id and a.email = b.email
   and (a.created_at, a.id) < (b.created_at, b.id);
drop index public.invitations_one_open_host;
create unique index invitations_one_open_host on public.invitations (organization_id, email) where as_host and accepted_at is null;

drop policy "invitations: managers read" on public.invitations;
create policy "invitations: managers read" on public.invitations
  for select to authenticated
  using (public.is_org_admin(organization_id) or (not as_host and public.can_manage_volunteers(event_id)));
drop policy "invitations: hosts invite anyone" on public.invitations;
create policy "invitations: hosts invite" on public.invitations
  for insert to authenticated
  with check (invited_by = auth.uid()
              and ((not as_host and public.is_event_admin(event_id))
                   or (as_host and public.is_org_owner(organization_id))));
drop policy "invitations: hosts cancel" on public.invitations;
create policy "invitations: hosts cancel" on public.invitations
  for delete to authenticated
  using (accepted_at is null
         and ((not as_host and public.is_event_admin(event_id))
              or (as_host and public.is_org_owner(organization_id))));

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
    join organizations o on o.id = i.organization_id
    left join events e on e.id = i.event_id
    left join stations s on s.id = i.station_id
   where i.token = p_token;
$$;
revoke execute on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to anon, authenticated;

-- Accepting: a co-host joins the invitation's account. Returns the event, or null
-- for an account invitation.
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

  -- Still open while they join, so the spot it holds is theirs (the team-limit check sees them on the team).
  if inv.as_host then
    insert into organization_members (organization_id, user_id, role)
    values (inv.organization_id, auth.uid(), 'admin')
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

create or replace function public.prepare_invitation_email(p_id uuid)
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
     or not coalesce(case when inv.as_host then public.is_org_owner(inv.organization_id)
                          else public.is_event_admin(inv.event_id)
                               or (inv.role = 'section_lead' and public.can_manage_volunteers(inv.event_id)) end, false) then
    raise exception 'You don''t have permission to send that invitation' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'That invitation has already been accepted' using errcode = 'P0001';
  end if;
  if inv.sent_at > now() - interval '5 minutes' then
    raise exception 'That invitation was just sent. Please wait a few minutes before sending it again.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('invitation_sends:' || inv.organization_id::text));
  if (select count(*) from invitation_sends s
       where s.organization_id = inv.organization_id and s.sent_at > now() - interval '1 hour') >= 40 then
    raise exception 'That''s a lot of invitations in a short time. Please try again in an hour, or email us for help.'
      using errcode = 'P0001';
  end if;
  insert into invitation_sends (organization_id) values (inv.organization_id);

  update invitations i
     set email_token = gen_random_uuid(),
         sent_at = now(),
         expires_at = greatest(i.expires_at, now() + interval '30 days')
   where i.id = inv.id;

  return query
    select i.email::text, i.role, i.as_host, i.token, i.expires_at, e.name, e.starts_on, e.ends_on, e.venue_name,
           o.name, s.name, nullif(p.full_name, '')
      from invitations i
      join organizations o on o.id = i.organization_id
      left join events e on e.id = i.event_id
      left join stations s on s.id = i.station_id
      left join profiles p on p.id = auth.uid()
     where i.id = inv.id;
end;
$$;

-- 5. Team spots ------------------------------------------------------------------
-- Everyone holding a spot, once each, by email: hosts and co-hosts; Volunteer Leads
-- and Coordinators until their event is over (in its own time zone); and open,
-- unexpired invitations. Demo people don't count.
-- (Replaces the old list of user ids: the Account page's "Team: 3 of 5" counts the same way.)
drop function public.org_team(uuid);
create function public.org_team(p_org uuid)
returns setof text
language sql stable security definer set search_path = public
as $$
  select distinct lower(t.email) from (
    select p.email::text as email
      from organization_members m join profiles p on p.id = m.user_id
     where m.organization_id = p_org
    union
    select p.email::text
      from event_staff s join events e on e.id = s.event_id join profiles p on p.id = s.user_id
     where e.organization_id = p_org
       and e.ends_on >= (now() at time zone e.timezone)::date
    union
    select i.email::text
      from invitations i left join events e on e.id = i.event_id
     where i.organization_id = p_org and i.accepted_at is null and i.expires_at > now()
       and (e.id is null or e.ends_on >= (now() at time zone e.timezone)::date)
  ) t
  where t.email not like '%@demo.fieldcommandevents.com';
$$;
revoke execute on function public.org_team(uuid) from public, anon, authenticated;

create or replace function public.team_add_reason(p_org uuid, p_user uuid, p_email text, p_staff boolean)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.package_tier(p_org);
  addr text := lower(coalesce(p_email, (select email::text from profiles where id = p_user), ''));
begin
  if tier.code is null or addr like '%@demo.fieldcommandevents.com' then
    return null;
  end if;
  if p_staff and not tier.event_staff then
    return format('Your %s plan doesn''t include Volunteer Leads or Coordinators. Ask us about a plan that does.', tier.name);
  end if;
  -- Already holding a spot (on the team, or invited): adding them again doesn't take another.
  if addr <> '' and addr in (select public.org_team(p_org)) then
    return null;
  end if;
  if tier.max_team is not null and (select count(*) from public.org_team(p_org)) >= tier.max_team then
    return format('Your team is full: your %s plan includes %s team spots, and invitations count until they''re accepted. Remove someone or cancel an invitation to free a spot, or ask us about a bigger team.',
                  tier.name, tier.max_team);
  end if;
  return null;
end;
$$;

-- Invitations are checked against the invitation's account.
create or replace function public.team_limits_on_invitations()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reason text := public.team_add_reason(new.organization_id, null, new.email::text, not new.as_host);
begin
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The account's team count, for the page: spots in use (invitations included),
-- open invitations, and the plan's limit. Hosts and co-hosts only.
create function public.team_spots(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.package_tier(p_org);
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only the account''s hosts can see its team' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'used', (select count(*) from public.org_team(p_org)),
    'invited', (select count(distinct lower(i.email::text)) from invitations i left join events e on e.id = i.event_id
                 where i.organization_id = p_org and i.accepted_at is null and i.expires_at > now()
                   and (e.id is null or e.ends_on >= (now() at time zone e.timezone)::date)
                   and lower(i.email::text) not in (select lower(p.email::text) from profiles p
                                                     where p.id in (select m.user_id from organization_members m where m.organization_id = p_org)
                                                        or p.id in (select s.user_id from event_staff s join events ev on ev.id = s.event_id
                                                                     where ev.organization_id = p_org
                                                                       and ev.ends_on >= (now() at time zone ev.timezone)::date))),
    'max', tier.max_team,
    'plan', tier.name,
    'event_staff', coalesce(tier.event_staff, true)
  );
end;
$$;
revoke execute on function public.team_spots(uuid) from public, anon;
grant execute on function public.team_spots(uuid) to authenticated;

-- 6. Removed people: Volunteer Leads see removed Coordinators only ---------------
drop policy "team removals: managers see removed leads" on public.team_removals;
create policy "team removals: managers see removed leads" on public.team_removals
  for select to authenticated
  using (event_id is not null
         and (public.is_event_admin(event_id) or (role = 'section_lead' and public.can_manage_volunteers(event_id))));

-- 7. Handing the account on ------------------------------------------------------
-- The Account Host offers the role to a co-host; the co-host accepts. The old
-- Account Host stays on as a co-host.
create table public.account_host_handoffs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  to_user          uuid not null references public.profiles (id) on delete cascade,
  offered_by       uuid references public.profiles (id) on delete set null,
  token            uuid not null unique default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_at      timestamptz,
  cancelled_at     timestamptz
);
create unique index account_host_handoffs_one_open
  on public.account_host_handoffs (organization_id) where accepted_at is null and cancelled_at is null;
alter table public.account_host_handoffs enable row level security;
create policy "handoffs: hosts and the co-host read" on public.account_host_handoffs
  for select to authenticated using (public.is_org_admin(organization_id) or to_user = auth.uid());
revoke all on public.account_host_handoffs from anon, authenticated;
grant select on public.account_host_handoffs to authenticated;
grant all on public.account_host_handoffs to service_role;

-- Offer the account to a co-host (replacing any open offer). Returns the offer's token.
create function public.offer_account_host(p_org uuid, p_user uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  t uuid;
begin
  if not public.is_org_owner(p_org) then
    raise exception 'Only the Account Host can hand on the account' using errcode = '42501';
  end if;
  if not exists (select 1 from organization_members where organization_id = p_org and user_id = p_user and role = 'admin') then
    raise exception 'You can hand the account on to a co-host. Invite them as a co-host first.' using errcode = 'P0001';
  end if;
  update account_host_handoffs set cancelled_at = now()
   where organization_id = p_org and accepted_at is null and cancelled_at is null;
  insert into account_host_handoffs (organization_id, to_user, offered_by)
  values (p_org, p_user, auth.uid())
  returning token into t;
  return t;
end;
$$;
revoke execute on function public.offer_account_host(uuid, uuid) from public, anon;
grant execute on function public.offer_account_host(uuid, uuid) to authenticated;

-- Withdraw (the Account Host) or decline (the co-host) an open offer.
create function public.cancel_account_host_offer(p_org uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update account_host_handoffs set cancelled_at = now()
   where organization_id = p_org and accepted_at is null and cancelled_at is null
     and (public.is_org_owner(p_org) or to_user = auth.uid());
  if not found then
    raise exception 'There''s no open offer you can cancel' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.cancel_account_host_offer(uuid) from public, anon;
grant execute on function public.cancel_account_host_offer(uuid) to authenticated;

-- The co-host accepts: they become the Account Host, and the old one a co-host.
create function public.accept_account_host(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  h account_host_handoffs;
begin
  select * into h from account_host_handoffs where token = p_token for update;
  if h.id is null or h.to_user <> auth.uid() then
    raise exception 'This link isn''t for your account. Sign in as the person it was sent to.' using errcode = '42501';
  end if;
  if h.accepted_at is not null then
    return h.organization_id;
  end if;
  if h.cancelled_at is not null or h.expires_at < now() then
    raise exception 'This offer is no longer open. Ask the Account Host to offer it again.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from organization_members where organization_id = h.organization_id and user_id = auth.uid() and role = 'admin') then
    raise exception 'You''re no longer a co-host on this account, so you can''t become its Account Host.' using errcode = 'P0001';
  end if;
  update organization_members set role = 'admin' where organization_id = h.organization_id and role = 'owner';
  update organization_members set role = 'owner' where organization_id = h.organization_id and user_id = auth.uid();
  update account_host_handoffs set accepted_at = now() where id = h.id;
  return h.organization_id;
end;
$$;
revoke execute on function public.accept_account_host(uuid) from public, anon;
grant execute on function public.accept_account_host(uuid) to authenticated;

-- What an offer link shows before accepting (to the person it's for).
create function public.get_account_host_offer(p_token uuid)
returns table (organization text, offered_by text, open boolean, accepted boolean, for_you boolean)
language sql stable security definer set search_path = public
as $$
  select o.name, coalesce(nullif(p.full_name, ''), p.email::text),
         h.accepted_at is null and h.cancelled_at is null and h.expires_at > now(),
         h.accepted_at is not null, h.to_user = auth.uid()
    from account_host_handoffs h
    join organizations o on o.id = h.organization_id
    left join profiles p on p.id = h.offered_by
   where h.token = p_token;
$$;
revoke execute on function public.get_account_host_offer(uuid) from public, anon;
grant execute on function public.get_account_host_offer(uuid) to authenticated;
