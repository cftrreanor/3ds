-- =============================================================================
-- Packages page (admin): FieldCommand admins change what each package includes
-- (event types, one at a time or not, Volunteer Leads and Coordinators, volunteer
-- tracking, team spots) and each event pass's price, from the dashboard instead
-- of the Table Editor. Every change is checked, logged in admin_log, and applies
-- to every account on that package at once. Nothing anyone already has is taken
-- away: published events stay live and nobody is removed from a team (the rules
-- that check publishing and inviting already work this way).
-- =============================================================================

-- What a change would affect, before saving it. Admins only.
--   p_setting: for an event type, 'yes' (included), 'one' (one at a time), or 'no';
--   for 'event_staff' and 'volunteer_history', 'yes' or 'no'; for 'max_team', null.
create function public.admin_package_impact(p_code text, p_row text, p_setting text, p_max_team integer default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  affected jsonb := '[]';
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can see this' using errcode = '42501';
  end if;
  if p_row = 'max_team' then
    if p_max_team is not null then
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'detail', n || ' on the team') order by o.name), '[]')
        into affected
        from (select o.id, o.name, (select count(*) from public.org_team(o.id)) as n
                from organizations o where o.package = p_code) o
       where o.n > p_max_team;
    end if;
  elsif p_row = 'event_staff' then
    if p_setting = 'no' then
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'detail', x.n || ' Volunteer Lead' || case when x.n = 1 then '' else 's' end || ' or Coordinators') order by o.name), '[]')
        into affected
        from organizations o
        join lateral (select count(distinct s.user_id) as n from event_staff s join events e on e.id = s.event_id
                       where e.organization_id = o.id and e.ends_on >= current_date) x on x.n > 0
       where o.package = p_code;
    end if;
  elsif p_row = 'volunteer_history' then
    null; -- Nobody loses history they built up (volunteer_tracking_open keeps it showing).
  elsif p_setting in ('no', 'one') then
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'detail', x.names) order by o.name), '[]')
      into affected
      from organizations o
      join lateral (select string_agg(e.name, ', ' order by e.starts_on) as names, count(*) as n
                      from events e
                     where e.organization_id = o.id and e.status = 'published' and e.event_type::text = p_row) x on x.n > 0
     where o.package = p_code;
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from organizations where package = p_code),
    'affected', affected
  );
end;
$$;
revoke execute on function public.admin_package_impact(text, text, text, integer) from public, anon;
grant execute on function public.admin_package_impact(text, text, text, integer) to authenticated;

-- Change what a package includes. Admins only; logged.
create function public.admin_update_package(
  p_code text,
  p_event_types text[],
  p_one_at_a_time text[],
  p_max_team integer,
  p_event_staff boolean,
  p_volunteer_history boolean,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before plan_tiers;
  known text[] := (select array_agg(t::text) from unnest(enum_range(null::public.event_type)) t);
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change packages' using errcode = '42501';
  end if;
  select * into before from plan_tiers where code = p_code and kind = 'package' for update;
  if before.code is null then
    raise exception 'That package doesn''t exist' using errcode = 'P0001';
  end if;
  if not (coalesce(p_event_types, '{}') <@ known) or not (coalesce(p_one_at_a_time, '{}') <@ coalesce(p_event_types, '{}')) then
    raise exception 'Those event types don''t add up' using errcode = 'P0001';
  end if;
  if p_max_team is not null and (p_max_team < 1 or p_max_team > 10000) then
    raise exception 'Team spots must be at least 1, or unlimited' using errcode = 'P0001';
  end if;

  update plan_tiers
     set event_types = (select coalesce(array_agg(t order by array_position(known, t)), '{}') from unnest(p_event_types) t),
         one_at_a_time = (select coalesce(array_agg(t order by array_position(known, t)), '{}') from unnest(p_one_at_a_time) t),
         max_team = p_max_team,
         event_staff = p_event_staff,
         volunteer_history = p_volunteer_history
   where code = p_code;

  -- Accounts gaining volunteer tracking keep what they build, as after an upgrade.
  if p_volunteer_history and not before.volunteer_history then
    perform set_config('app.package_change', 'on', true);
    update organizations set had_volunteer_tracking = true where package = p_code and not had_volunteer_tracking;
    perform set_config('app.package_change', 'off', true);
  end if;

  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'package_edited', jsonb_build_object(
    'code', p_code,
    'from', jsonb_build_object('event_types', before.event_types, 'one_at_a_time', before.one_at_a_time, 'max_team', before.max_team,
                               'event_staff', before.event_staff, 'volunteer_history', before.volunteer_history),
    'to', (select jsonb_build_object('event_types', event_types, 'one_at_a_time', one_at_a_time, 'max_team', max_team,
                                     'event_staff', event_staff, 'volunteer_history', volunteer_history) from plan_tiers where code = p_code),
    'note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;
revoke execute on function public.admin_update_package(text, text[], text[], integer, boolean, boolean, text) from public, anon;
grant execute on function public.admin_update_package(text, text[], text[], integer, boolean, boolean, text) to authenticated;

-- Change an event pass's list price. Admins only; logged. Passes already added keep their price.
create function public.admin_set_pass_price(p_code text, p_price_cents integer, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  was integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change prices' using errcode = '42501';
  end if;
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 10000000 then
    raise exception 'Enter a price of $0 or more' using errcode = 'P0001';
  end if;
  select price_cents into was from plan_tiers where code = p_code and kind = 'pass' for update;
  if not found then
    raise exception 'That pass doesn''t exist' using errcode = 'P0001';
  end if;
  update plan_tiers set price_cents = p_price_cents where code = p_code;
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'pass_price_changed', jsonb_build_object(
    'code', p_code, 'event_type', (select event_types[1] from plan_tiers where code = p_code),
    'from', was, 'to', p_price_cents, 'note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;
revoke execute on function public.admin_set_pass_price(text, integer, text) from public, anon;
grant execute on function public.admin_set_pass_price(text, integer, text) to authenticated;

-- =============================================================================
-- Free Teacher: its own package for free teacher accounts, separate from Free.
-- It starts with what Free includes; change either one on the Packages page.
-- New teacher accounts start on it, and today's teacher accounts on Free move to it.
-- =============================================================================
insert into public.plan_tiers (code, kind, name, event_types, one_at_a_time, weekly_hours, max_team, event_staff, volunteer_history, price_cents, sort)
select 'free_teacher', 'package', 'Free Teacher', event_types, one_at_a_time, weekly_hours, max_team, event_staff, volunteer_history, null, 5
  from public.plan_tiers where code = 'free';

select set_config('app.package_change', 'on', true);
update public.organizations set package = 'free_teacher' where account_kind = 'teacher' and package = 'free';
select set_config('app.package_change', 'off', true);

create or replace function public.teacher_accounts_start_free()
returns trigger
language plpgsql
as $$
begin
  if new.account_kind = 'teacher' then
    new.package := 'free_teacher';
    new.rate := 'teacher';
  end if;
  new.had_volunteer_tracking := coalesce((select volunteer_history from plan_tiers where code = new.package), false);
  return new;
end;
$$;

-- Both free packages publish as themselves, with no plan needed.
create or replace function public.org_tier(p_org uuid)
returns public.plan_tiers
language sql stable security definer set search_path = public
as $$
  select t.* from organizations o
    join plan_tiers t on t.code = case when o.package in ('free', 'free_teacher') or public.org_has_active_plan(o.id) then o.package else 'free' end
   where o.id = p_org;
$$;

-- Upgrading a teacher moves them to a paid package, not either free one.
create or replace function public.admin_upgrade_teacher(p_org uuid, p_package text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can upgrade accounts.' using errcode = '42501';
  end if;
  if not exists (select 1 from plan_tiers where code = p_package and kind = 'package' and code not in ('free', 'free_teacher')) then
    raise exception 'Pick the package to move them to.' using errcode = 'P0001';
  end if;
  update organizations set account_kind = 'standard' where id = p_org and account_kind = 'teacher';
  if not found then
    raise exception 'That account isn''t a free teacher account.' using errcode = 'P0001';
  end if;
  -- Teachers keep the teacher rate.
  perform public.set_account_package(p_org, p_package, 'teacher', p_note, 'admin');
  update pilot_requests
     set status = case when exists (select 1 from events where organization_id = p_org and status = 'published') then 'active' else 'set_up' end
   where organization_id = p_org and status = 'teacher';
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'teacher_upgraded', p_org, jsonb_build_object('package', p_package, 'note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;

-- =============================================================================
-- Package names and prices. Each package has a monthly and a yearly price
-- (one rate for everyone); Schedule Command also has teacher-rate prices.
-- Shown in the admin area for now; nothing charges from them yet.
-- =============================================================================
alter table public.plan_tiers
  add column price_month_cents integer check (price_month_cents is null or price_month_cents >= 0),
  add column price_year_cents integer check (price_year_cents is null or price_year_cents >= 0),
  add column teacher_month_cents integer check (teacher_month_cents is null or teacher_month_cents >= 0),
  add column teacher_year_cents integer check (teacher_year_cents is null or teacher_year_cents >= 0),
  -- Whether the package has a separate teacher rate (Schedule Command does).
  add column teacher_rate boolean not null default false;
update public.plan_tiers set teacher_rate = true where code = 'schedule';

-- Rename a package or set its prices. Admins only; logged. Prices in cents; null is "not set".
create function public.admin_update_package_details(
  p_code text,
  p_name text,
  p_month_cents integer,
  p_year_cents integer,
  p_teacher_month_cents integer,
  p_teacher_year_cents integer,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before plan_tiers;
  clean text := trim(coalesce(p_name, ''));
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change packages' using errcode = '42501';
  end if;
  select * into before from plan_tiers where code = p_code and kind = 'package' for update;
  if before.code is null then
    raise exception 'That package doesn''t exist' using errcode = 'P0001';
  end if;
  if length(clean) < 2 or length(clean) > 60 then
    raise exception 'Give the package a name of 2 to 60 characters' using errcode = 'P0001';
  end if;
  if exists (select 1 from plan_tiers where lower(name) = lower(clean) and code <> p_code) then
    raise exception 'Another package or pass already has that name' using errcode = 'P0001';
  end if;
  if least(p_month_cents, p_year_cents, p_teacher_month_cents, p_teacher_year_cents) < 0
     or greatest(p_month_cents, p_year_cents, p_teacher_month_cents, p_teacher_year_cents) > 100000000 then
    raise exception 'Enter prices of $0 or more' using errcode = 'P0001';
  end if;
  update plan_tiers
     set name = clean,
         price_month_cents = p_month_cents,
         price_year_cents = p_year_cents,
         teacher_month_cents = case when teacher_rate then p_teacher_month_cents end,
         teacher_year_cents = case when teacher_rate then p_teacher_year_cents end
   where code = p_code;
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'package_details_changed', jsonb_build_object(
    'code', p_code,
    'from', jsonb_build_object('name', before.name, 'month', before.price_month_cents, 'year', before.price_year_cents,
                               'teacher_month', before.teacher_month_cents, 'teacher_year', before.teacher_year_cents),
    'to', (select jsonb_build_object('name', name, 'month', price_month_cents, 'year', price_year_cents,
                                     'teacher_month', teacher_month_cents, 'teacher_year', teacher_year_cents) from plan_tiers where code = p_code),
    'note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;
revoke execute on function public.admin_update_package_details(text, text, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.admin_update_package_details(text, text, integer, integer, integer, integer, text) to authenticated;
