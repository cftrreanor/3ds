-- =============================================================================
-- Resending an expired invitation checks the team's limit (design review
-- 2026-11-05, finding 2). An expired invitation doesn't hold a team spot, and
-- sending it again gives it 30 more days, so it has to fit like a new one.
-- =============================================================================

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
  reason text;
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
  -- An expired invitation stopped holding a team spot. Sending it again takes one back, so it
  -- needs a free spot (and a plan that includes the role), just like a new invitation.
  if inv.expires_at < now() then
    reason := public.team_add_reason(inv.organization_id, null, inv.email::text, not inv.as_host);
    if reason is not null then
      raise exception '%', reason using errcode = '42501';
    end if;
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
