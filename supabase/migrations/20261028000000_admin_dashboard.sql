-- =============================================================================
-- Admin dashboard (part 1): plans for each organization, set by FieldCommand
-- admins, and a log of what admins change.
--
--   * organizations.free_until: the last day of a free pilot or trial. After
--     it, publishing new events pauses; events already published stay live
--     and editable.
--   * admin_set_plan(): the only way to change a plan (admins only), and it
--     records the change in admin_log.
-- =============================================================================

alter table public.organizations add column free_until date;
-- (Not grantable: hosts can still only change their organization's name and time zone.)

-- An active plan: paid (even if a payment is late), or a pilot/trial whose
-- last free day (in the organization's time zone) hasn't passed.
create or replace function public.org_has_active_plan(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from organizations
     where id = org
       and (
         subscription_status in ('active', 'past_due')
         or (subscription_status in ('comped', 'trialing')
             and (free_until is null or free_until >= (now() at time zone default_timezone)::date))
       )
  );
$$;

-- Publishing needs an active plan, but a plan ending mustn't lock hosts out
-- of the events they've already published: only the switch to "published"
-- is checked, not every later edit.
drop policy "events: hosts update" on public.events;
create policy "events: hosts update" on public.events
  for update to authenticated
  using (public.is_event_admin(id))
  with check (public.is_org_admin(organization_id));

create function public.events_publish_needs_plan()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'published' and old.status is distinct from 'published'
     and not public.org_has_active_plan(new.organization_id) then
    raise exception 'Publishing needs an active FieldCommand plan' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger events_publish_needs_plan
  before update of status on public.events
  for each row execute function public.events_publish_needs_plan();

-- What FieldCommand admins changed, and when.
create table public.admin_log (
  id               uuid primary key default gen_random_uuid(),
  admin_id         uuid references public.profiles (id) on delete set null,
  action           text not null,
  organization_id  uuid references public.organizations (id) on delete set null,
  details          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);
create index on public.admin_log (created_at desc);

alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;
grant select on public.admin_log to authenticated;
create policy "admin log: admins read" on public.admin_log
  for select to authenticated using (public.is_platform_admin());

-- Set an organization's plan. Pilots and trials need their last free day.
create function public.admin_set_plan(p_org uuid, p_status public.subscription_status, p_free_until date, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before organizations;
begin
  if not public.is_platform_admin() then
    raise exception 'Only FieldCommand admins can change plans' using errcode = '42501';
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

revoke execute on function public.admin_set_plan(uuid, public.subscription_status, date, text) from public, anon;
grant execute on function public.admin_set_plan(uuid, public.subscription_status, date, text) to authenticated;
