-- =============================================================================
-- Invite a host from one panel: who they are, their package and pilot, sent at once.
--
-- admin_send_host_invitation() is what the admin's "Invite a host" panel calls.
-- It saves the person on a pilot request card (their open card for that email,
-- the card it was opened from, or a new one) and invites them with their
-- package and free period (admin_invite_host, 20261224000000_invitation_plan.sql),
-- so the card lands under Invited before the welcome email goes out. The app
-- sends the email the admin picked.
--
-- The organization name is optional. Until they set up, the card shows the
-- person's name; when they set up, it shows their organization's name (or
-- their school, for a teacher account).
-- =============================================================================

create function public.admin_send_host_invitation(
  p_email text,
  p_name text,
  p_organization text,
  p_phone text,
  p_package text,
  p_plan_status public.subscription_status,
  p_free_until date,
  p_request uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  addr citext := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_org text := nullif(trim(coalesce(p_organization, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  req uuid := p_request;
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can invite hosts.' using errcode = '42501';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 200 then
    raise exception 'Please enter the host''s name.' using errcode = 'P0001';
  end if;
  if v_org is not null and char_length(v_org) > 200 then
    raise exception 'That organization name is too long.' using errcode = 'P0001';
  end if;
  if v_phone is not null and char_length(v_phone) > 30 then
    raise exception 'That phone number is too long.' using errcode = 'P0001';
  end if;
  if p_package is null or p_plan_status is null or p_free_until is null then
    raise exception 'Pick a package, a free pilot or trial, and its last free day.' using errcode = 'P0001';
  end if;

  if req is not null then
    if not exists (select 1 from pilot_requests where id = req) then
      raise exception 'That pilot request wasn''t found.' using errcode = 'P0001';
    end if;
  else
    -- Their open card, if they already asked to join.
    select id into req from pilot_requests
     where lower(email) = addr::text and status in ('new', 'contacted', 'invited', 'declined')
     order by created_at desc limit 1;
  end if;

  if req is null then
    insert into pilot_requests (name, email, organization, phone, notes)
    values (v_name, addr::text, coalesce(v_org, v_name), v_phone, 'Invited by an admin.')
    returning id into req;
  else
    update pilot_requests
       set name = v_name,
           organization = coalesce(v_org, organization),
           phone = coalesce(v_phone, phone)
     where id = req;
  end if;

  perform public.admin_invite_host(addr::text, req, p_package, p_plan_status, p_free_until);
  return req;
end;
$$;
revoke execute on function public.admin_send_host_invitation(text, text, text, text, text, public.subscription_status, date, uuid) from public, anon;
grant execute on function public.admin_send_host_invitation(text, text, text, text, text, public.subscription_status, date, uuid) to authenticated;

-- When they set up, a card that showed only their name shows their organization (or school).
create or replace function public.apply_invitation_plan(p_org uuid, inv public.host_invitations)
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
  update pilot_requests r
     set organization = left(coalesce(nullif(trim(o.school), ''), o.name), 200)
    from organizations o
   where o.id = p_org and r.id = inv.pilot_request_id and r.organization = r.name;
end;
$$;
revoke execute on function public.apply_invitation_plan(uuid, public.host_invitations) from public, anon, authenticated;
