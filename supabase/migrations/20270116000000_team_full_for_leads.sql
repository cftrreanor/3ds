-- =============================================================================
-- My team, design review 2026-11-05:
--   * Volunteer Leads can ask whether the account's team is full, so their page
--     says so before they try to invite (they can't read team_spots, which
--     shows the hosts' count).
--   * The full-team and no-event-teams messages name the plan that fixes them,
--     and say an invitation takes a spot as soon as it's sent (accepting doesn't
--     free it: the person then holds that spot).
-- =============================================================================

create function public.team_is_full(p_org uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.package_tier(p_org);
begin
  if not (public.is_org_admin(p_org)
          or exists (select 1 from events e where e.organization_id = p_org and public.can_manage_volunteers(e.id))) then
    raise exception 'Only the account''s hosts and Volunteer Leads can see that' using errcode = '42501';
  end if;
  return tier.max_team is not null and (select count(*) from public.org_team(p_org)) >= tier.max_team;
end;
$$;
revoke execute on function public.team_is_full(uuid) from public, anon;
grant execute on function public.team_is_full(uuid) to authenticated;

create or replace function public.team_add_reason(p_org uuid, p_user uuid, p_email text, p_staff boolean)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.package_tier(p_org);
  addr text := lower(coalesce(p_email, (select email::text from profiles where id = p_user), ''));
  bigger text;
  staff_plan text;
begin
  if tier.code is null or addr like '%@demo.fieldcommandevents.com' then
    return null;
  end if;
  if p_staff and not tier.event_staff then
    staff_plan := public.upgrade_for(null, 'event_staff');
    return format('Your %s plan doesn''t include Volunteer Leads or Coordinators. %s', tier.name,
                  coalesce(staff_plan || ' includes them. See your plan on the Account page.', 'Write to us about a plan that does.'));
  end if;
  -- Already holding a spot (on the team, or invited): adding them again doesn't take another.
  if addr <> '' and addr in (select public.org_team(p_org)) then
    return null;
  end if;
  if tier.max_team is not null and (select count(*) from public.org_team(p_org)) >= tier.max_team then
    select name into bigger from plan_tiers
     where kind = 'package' and (max_team is null or max_team > tier.max_team) order by sort limit 1;
    return format('Your team is full: your %s plan includes %s team spots, and an invitation takes one as soon as it''s sent. Remove someone or cancel an invitation to free a spot%s',
                  tier.name, tier.max_team,
                  coalesce(', or move to ' || bigger || ' for more spots.', ', or write to us about a bigger team.'));
  end if;
  return null;
end;
$$;

-- Who to ask: an account's name and its Account Host's name and email, for people on that
-- account's event teams (who can't read the account's members). Only while one of their
-- events there isn't over; hosts and co-hosts read their own account directly.
create function public.account_contacts(p_orgs uuid[])
returns table (organization_id uuid, organization text, host_name text, host_email text)
language sql stable security definer set search_path = public
as $$
  select o.id, o.name, coalesce(nullif(p.full_name, ''), p.email::text), p.email::text
    from organizations o
    left join organization_members m on m.organization_id = o.id and m.role = 'owner'
    left join profiles p on p.id = m.user_id
   where o.id = any (p_orgs)
     and exists (select 1 from event_staff s join events e on e.id = s.event_id
                  where s.user_id = auth.uid() and e.organization_id = o.id
                    and e.ends_on >= (now() at time zone e.timezone)::date);
$$;
revoke execute on function public.account_contacts(uuid[]) from public, anon;
grant execute on function public.account_contacts(uuid[]) to authenticated;
