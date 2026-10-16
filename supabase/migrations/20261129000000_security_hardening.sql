-- Security hardening from the penetration test (October 2026).
--
-- 1. Invitation emails can't be used to flood someone's inbox: the same
--    invitation can be re-sent at most once every 5 minutes, and one
--    organization can send at most 40 invitation emails an hour (counted even
--    if invitations are cancelled and made again).
-- 2. Visitors who aren't signed in can't write to any table directly. They
--    never could get past the privacy rules (row level security), but now the
--    permission itself is gone too, so a future rule mistake can't open it up.

-- -----------------------------------------------------------------------------
-- 1. Invitation email limits
-- -----------------------------------------------------------------------------
create table public.invitation_sends (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  sent_at          timestamptz not null default now()
);
create index on public.invitation_sends (organization_id, sent_at);
alter table public.invitation_sends enable row level security;
revoke all on public.invitation_sends from anon, authenticated;

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
  org uuid;
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
  if inv.sent_at > now() - interval '5 minutes' then
    raise exception 'That invitation was just sent. Please wait a few minutes before sending it again.' using errcode = 'P0001';
  end if;
  select e.organization_id into org from events e where e.id = inv.event_id;
  perform pg_advisory_xact_lock(hashtext('invitation_sends:' || org::text));
  if (select count(*) from invitation_sends s
       where s.organization_id = org and s.sent_at > now() - interval '1 hour') >= 40 then
    raise exception 'That''s a lot of invitations in a short time. Please try again in an hour, or email us for help.'
      using errcode = 'P0001';
  end if;
  insert into invitation_sends (organization_id) values (org);

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

-- The send records only matter for an hour.
create or replace function public.purge_invitation_sends()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (delete from invitation_sends where sent_at < now() - interval '1 day' returning 1)
  select count(*)::integer from gone;
$$;
revoke execute on function public.purge_invitation_sends() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. No direct writes for visitors who aren't signed in
-- -----------------------------------------------------------------------------
-- Public sign-ups, registrations, and bookings all go through the server,
-- which checks them and uses its own key; nothing writes as "anon".
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke usage, update on all sequences in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
alter default privileges in schema public revoke usage, update on sequences from anon;
