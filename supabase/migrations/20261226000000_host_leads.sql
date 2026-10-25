-- =============================================================================
-- "Save and invite later" in the admin's Invite a host panel.
--
-- Saves the person as a lead (a pilot request card under "Lead", the first
-- pipeline column) with everything picked in the panel, without inviting or
-- emailing them. No host invitation is made, so they can't set up an account
-- until an admin sends one; the panel opens with these choices filled in.
--   * pilot_requests: planned_package, planned_status, planned_free_until and
--     planned_template (the welcome email picked; null is the standard one).
--   * admin_save_host_lead(): platform admins only.
-- =============================================================================

alter table public.pilot_requests
  add column planned_package text references public.plan_tiers (code),
  add column planned_status public.subscription_status
    check (planned_status is null or planned_status in ('comped', 'trialing')),
  add column planned_free_until date,
  add column planned_template uuid references public.email_templates (id) on delete set null;

create function public.admin_save_host_lead(
  p_email text,
  p_name text,
  p_organization text,
  p_phone text,
  p_package text,
  p_plan_status public.subscription_status,
  p_free_until date,
  p_template uuid,
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
    raise exception 'Only FieldCommand admins can add leads.' using errcode = '42501';
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
  if p_package is not null and not exists (select 1 from plan_tiers where code = p_package and kind = 'package') then
    raise exception 'Pick a package.' using errcode = 'P0001';
  end if;
  if p_plan_status is not null and (p_plan_status not in ('comped', 'trialing') or p_free_until is null) then
    raise exception 'Pick a free pilot or trial, and its last free day.' using errcode = 'P0001';
  end if;

  if req is not null then
    if not exists (select 1 from pilot_requests where id = req) then
      raise exception 'That pilot request wasn''t found.' using errcode = 'P0001';
    end if;
  else
    -- Their open card, if they already asked to join or were saved before.
    select id into req from pilot_requests
     where lower(email) = addr::text and status in ('new', 'contacted', 'invited', 'declined')
     order by created_at desc limit 1;
  end if;

  if req is null then
    insert into pilot_requests (name, email, organization, phone, notes, status,
                                planned_package, planned_status, planned_free_until, planned_template)
    values (v_name, addr::text, coalesce(v_org, v_name), v_phone, 'Added by an admin.', 'new',
            p_package, p_plan_status, case when p_plan_status is not null then p_free_until end, p_template)
    returning id into req;
  else
    update pilot_requests
       set name = v_name,
           organization = coalesce(v_org, organization),
           phone = coalesce(v_phone, phone),
           planned_package = p_package,
           planned_status = p_plan_status,
           planned_free_until = case when p_plan_status is not null then p_free_until end,
           planned_template = p_template
     where id = req;
  end if;

  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'lead_saved', jsonb_build_object('email', addr::text, 'pilot_request', req,
          'package', p_package, 'plan_status', p_plan_status, 'free_until', p_free_until));
  return req;
end;
$$;
revoke execute on function public.admin_save_host_lead(text, text, text, text, text, public.subscription_status, date, uuid, uuid) from public, anon;
grant execute on function public.admin_save_host_lead(text, text, text, text, text, public.subscription_status, date, uuid, uuid) to authenticated;
