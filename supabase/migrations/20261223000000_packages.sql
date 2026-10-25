-- =============================================================================
-- Packages and one-time event passes.
--
--   * Every account has a package (free, schedule, volunteer, event, district),
--     separate from its payment status (Pilot, Trial, Paid, ...), and a rate
--     (teacher or standard) for billing later. The rate changes no features.
--   * Each package's limits, and each event pass's price, live in one table,
--     plan_tiers, which the database and the app both read. Change a number
--     there (Table Editor) and it applies everywhere, with no rebuild.
--   * An event pass lets an account publish ONE event of a type its package
--     doesn't include. Passes expire 12 months after they're bought, and each
--     account keeps a running total of what it has paid for passes.
--   * The database enforces it all:
--       - org_can_publish(event): null when the event may be published, or the
--         reason it can't, in plain words. Only new publishing is checked;
--         published events stay live and editable when a package changes.
--       - Team limits when someone is invited or added. Nobody is removed on
--         a downgrade; adding more is blocked, with the reason.
--       - Volunteer history needs Volunteer Command or higher to view; it's
--         still recorded on every package, so it's there after an upgrade.
--   * set_account_package() and add_event_pass() are the only ways a package
--     changes or a pass is added, by an admin, or by a payment (the service
--     role, for a future Stripe webhook). Each is written to admin_log.
--   * Today's accounts: free teacher accounts become Free; every other
--     account (Pilot, Trial, Paid, and the rest) becomes Event Command, so
--     nothing anyone uses today goes away.
--   * When a paid package's plan isn't active (a pilot that ended, a canceled
--     plan), the account publishes as Free until it's renewed, as before:
--     one parent-teacher conference at a time.
-- =============================================================================

-- 1. The packages, the passes, and their limits -----------------------------------
create table public.plan_tiers (
  code               text primary key,
  kind               text not null check (kind in ('package', 'pass')),
  name               text not null,
  -- Packages: the event types they publish. Passes: the one type the pass is for.
  event_types        text[] not null,
  -- Packages: types published one at a time (more can be drafts).
  one_at_a_time      text[] not null default '{}',
  -- Packages: weekly hours for conferences and meetings.
  weekly_hours       boolean not null default false,
  -- Packages: distinct people on the team (hosts, co-hosts, Volunteer Leads and
  -- Section Leads). Null is unlimited.
  max_team           integer check (max_team is null or max_team >= 1),
  -- Packages: Volunteer Leads and Section Leads allowed.
  event_staff        boolean not null default false,
  -- Packages: the Volunteer tracking page (volunteer history).
  volunteer_history  boolean not null default false,
  -- Passes: the price, in cents.
  price_cents        integer check (price_cents is null or price_cents >= 0),
  -- Smallest first: the upgrade suggested is the first package that fits.
  sort               integer not null,
  check (kind = 'package' or (price_cents is not null and cardinality(event_types) = 1))
);

alter table public.plan_tiers enable row level security;
create policy "plan tiers: everyone reads" on public.plan_tiers for select using (true);
revoke all on public.plan_tiers from anon, authenticated, service_role;
grant select on public.plan_tiers to anon, authenticated, service_role;

insert into public.plan_tiers (code, kind, name, event_types, one_at_a_time, weekly_hours, max_team, event_staff, volunteer_history, price_cents, sort) values
  ('free',      'package', 'Free',              '{conference}',                     '{conference}', false, 2,    false, false, null, 10),
  ('schedule',  'package', 'Schedule Command',  '{conference,meeting,volunteer}',   '{volunteer}',  true,  2,    false, false, null, 20),
  ('volunteer', 'package', 'Volunteer Command', '{conference,meeting,volunteer}',   '{}',           true,  5,    true,  true,  null, 30),
  ('event',     'package', 'Event Command',     '{band_contest,group_event,fair,school_visit,volunteer,conference,meeting}', '{}', true, null, true, true, null, 40),
  ('district',  'package', 'District Command',  '{band_contest,group_event,fair,school_visit,volunteer,conference,meeting}', '{}', true, null, true, true, null, 50),
  ('pass_school_visit', 'pass', 'School visitor day pass', '{school_visit}', '{}', false, null, false, false,  5000, 110),
  ('pass_volunteer',    'pass', 'Volunteer event pass',    '{volunteer}',    '{}', false, null, false, false,  7500, 120),
  ('pass_fair',         'pass', 'Fair pass',               '{fair}',         '{}', false, null, false, false, 10000, 130),
  ('pass_group_event',  'pass', 'Group event pass',        '{group_event}',  '{}', false, null, false, false, 12500, 140),
  ('pass_band_contest', 'pass', 'Band contest pass',       '{band_contest}', '{}', false, null, false, false, 15000, 150);

-- 2. Each account's package, rate, and pass total ----------------------------------
alter table public.organizations
  add column package text not null default 'event' references public.plan_tiers (code),
  add column rate text not null default 'standard' check (rate in ('teacher', 'standard')),
  add column pass_total_cents integer not null default 0 check (pass_total_cents >= 0),
  -- Set once the account has been on a package with volunteer tracking. After a
  -- downgrade, it keeps seeing the tracking it built up (volunteer_tracking_open).
  add column had_volunteer_tracking boolean not null default true;

-- Today's accounts: free teacher accounts are Free, everything else Event Command.
update public.organizations set package = 'free', rate = 'teacher', had_volunteer_tracking = false where account_kind = 'teacher';

-- A new free teacher account starts on Free.
create function public.teacher_accounts_start_free()
returns trigger
language plpgsql
as $$
begin
  if new.account_kind = 'teacher' then
    new.package := 'free';
    new.rate := 'teacher';
  end if;
  new.had_volunteer_tracking := coalesce((select volunteer_history from plan_tiers where code = new.package), false);
  return new;
end;
$$;
create trigger teacher_accounts_start_free
  before insert on public.organizations
  for each row execute function public.teacher_accounts_start_free();
revoke execute on function public.teacher_accounts_start_free() from public, anon, authenticated;

-- The package, rate and pass total change only through set_account_package()
-- and add_event_pass(), which say so for this transaction.
create function public.package_changes_go_through_admin()
returns trigger
language plpgsql
as $$
begin
  if (new.package, new.rate, new.pass_total_cents, new.had_volunteer_tracking)
     is distinct from (old.package, old.rate, old.pass_total_cents, old.had_volunteer_tracking)
     and current_setting('app.package_change', true) is distinct from 'on' then
    raise exception 'Packages change only through set_account_package() or add_event_pass().' using errcode = '42501';
  end if;
  if new.package is distinct from old.package
     and not exists (select 1 from plan_tiers where code = new.package and kind = 'package') then
    raise exception 'That isn''t a package.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger package_changes_go_through_admin
  before update of package, rate, pass_total_cents, had_volunteer_tracking on public.organizations
  for each row execute function public.package_changes_go_through_admin();
revoke execute on function public.package_changes_go_through_admin() from public, anon, authenticated;

-- 3. Event passes ---------------------------------------------------------------
create table public.event_passes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  event_type       public.event_type not null,
  price_cents      integer not null check (price_cents >= 0),
  source           text not null check (source in ('admin', 'payment')),
  note             text check (note is null or char_length(note) <= 500),
  purchased_at     timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '12 months',
  -- The event it was used on (null until used). Kept if the event is deleted later.
  event_id         uuid references public.events (id) on delete set null,
  used_at          timestamptz,
  created_by       uuid references public.profiles (id) on delete set null
);
create index on public.event_passes (organization_id, event_type);
create unique index event_passes_one_per_event on public.event_passes (event_id) where event_id is not null;

alter table public.event_passes enable row level security;
create policy "event passes: hosts and admins read" on public.event_passes
  for select to authenticated using (public.is_org_admin(organization_id) or public.is_platform_admin());
revoke all on public.event_passes from anon, authenticated, service_role;
grant select on public.event_passes to authenticated, service_role;

-- 4. Reading the rules -----------------------------------------------------------
-- How an event type is named in a sentence.
create function public.event_type_words(p_type text, p_many boolean default false)
returns text
language sql immutable
as $$
  select case p_type
    when 'band_contest' then case when p_many then 'band contests' else 'band contest' end
    when 'group_event'  then case when p_many then 'group events' else 'group event' end
    when 'fair'         then case when p_many then 'school fairs' else 'school fair' end
    when 'school_visit' then case when p_many then 'school visitor events' else 'school visitor event' end
    when 'volunteer'    then case when p_many then 'volunteer events' else 'volunteer event' end
    when 'conference'   then case when p_many then 'parent-teacher conferences' else 'parent-teacher conference' end
    when 'meeting'      then case when p_many then 'meetings' else 'meetings event' end
    else p_type
  end;
$$;

-- The package an account publishes under right now: its own, or Free while a
-- paid package's plan isn't active.
create function public.org_tier(p_org uuid)
returns public.plan_tiers
language sql stable security definer set search_path = public
as $$
  select t.* from organizations o
    join plan_tiers t on t.code = case when o.package = 'free' or public.org_has_active_plan(o.id) then o.package else 'free' end
   where o.id = p_org;
$$;
revoke execute on function public.org_tier(uuid) from public, anon, authenticated;

-- The account's own package, whether or not its plan is active: what drafts,
-- the team, and volunteer history follow. (Only publishing needs an active plan.)
create function public.package_tier(p_org uuid)
returns public.plan_tiers
language sql stable security definer set search_path = public
as $$
  select t.* from organizations o join plan_tiers t on t.code = o.package where o.id = p_org;
$$;
revoke execute on function public.package_tier(uuid) from public, anon, authenticated;

-- The smallest package that does what's asked: publish p_type without a
-- one-at-a-time limit, or (p_feature) have weekly hours, staff, or history.
create function public.upgrade_for(p_type text, p_feature text default null)
returns text
language sql stable security definer set search_path = public
as $$
  select name from plan_tiers
   where kind = 'package'
     and (p_type is null or (p_type = any (event_types) and not p_type = any (one_at_a_time)))
     and (p_feature is null
          or (p_feature = 'weekly_hours' and weekly_hours)
          or (p_feature = 'event_staff' and event_staff)
          or (p_feature = 'volunteer_history' and volunteer_history))
   order by sort limit 1;
$$;
revoke execute on function public.upgrade_for(text, text) from public, anon, authenticated;

-- An unused, unexpired pass for this type, or the one already on this event.
create function public.org_pass_for(p_org uuid, p_type text, p_event uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from event_passes
   where organization_id = p_org and event_type::text = p_type
     and (event_id = p_event or (event_id is null and expires_at > now()))
   order by (event_id = p_event) desc nulls last, expires_at
   limit 1;
$$;
revoke execute on function public.org_pass_for(uuid, text, uuid) from public, anon, authenticated;

-- Why this event can't be published, or null when it can.
create function public.org_publish_reason(p_org uuid, p_type text, p_event uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.org_tier(p_org);
  chosen text;
  other text;
  pass_price integer;
begin
  if tier.code is null then
    return 'That account wasn''t found.';
  end if;
  chosen := (select package from organizations where id = p_org);
  if not p_type = any (tier.event_types) then
    if public.org_pass_for(p_org, p_type, p_event) is not null then
      return null;
    end if;
    if chosen <> tier.code then
      return format('Your %s plan isn''t active right now, so you can publish %s only. Write to us to renew it.',
                    (select name from plan_tiers where code = chosen), public.event_type_words('conference', true));
    end if;
    pass_price := (select price_cents from plan_tiers where kind = 'pass' and p_type = any (event_types));
    if pass_price is not null then
      return format('Your %s plan doesn''t include %s. Add a %s pass or upgrade to %s.',
                    tier.name, public.event_type_words(p_type, true), public.event_type_words(p_type), public.upgrade_for(p_type));
    end if;
    return format('Your %s plan doesn''t include %s. Upgrade to %s.', tier.name, public.event_type_words(p_type, true), public.upgrade_for(p_type));
  end if;
  if p_type in ('conference', 'meeting') and not tier.weekly_hours
     and exists (select 1 from conference_settings where event_id = p_event and schedule = 'weekly') then
    return format('Your %s plan doesn''t include weekly hours. Upgrade to %s for them.', tier.name, public.upgrade_for(p_type, 'weekly_hours'));
  end if;
  if p_type = any (tier.one_at_a_time) then
    select name into other from events
     where organization_id = p_org and event_type::text = p_type and status = 'published' and id is distinct from p_event
     order by starts_on limit 1;
    if other is not null then
      return format('Your %s plan publishes one %s at a time, and %s is published. Unpublish it or upgrade to %s.',
                    tier.name, public.event_type_words(p_type), other, public.upgrade_for(p_type));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.org_publish_reason(uuid, text, uuid) from public, anon, authenticated;

/** For the app and tests: null when this event may be published, or why not. Hosts, and admins. */
create function public.org_can_publish(p_event uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  ev events;
begin
  select * into ev from events where id = p_event;
  if ev.id is null or not (public.is_org_admin(ev.organization_id) or public.is_platform_admin()
                           or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    return 'That event wasn''t found.';
  end if;
  return public.org_publish_reason(ev.organization_id, ev.event_type::text, ev.id);
end;
$$;
revoke execute on function public.org_can_publish(uuid) from public, anon;
grant execute on function public.org_can_publish(uuid) to authenticated, service_role;

-- 5. Publishing ------------------------------------------------------------------
-- Uses the pass for this event (once), when the package doesn't include its type.
create function public.org_use_pass(p_org uuid, p_type text, p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  pass uuid;
begin
  if p_type = any ((public.org_tier(p_org)).event_types) or exists (select 1 from event_passes where event_id = p_event) then
    return;
  end if;
  select id into pass from event_passes
   where organization_id = p_org and event_type::text = p_type and event_id is null and expires_at > now()
   order by expires_at
   limit 1
   for update skip locked;
  if pass is null then
    raise exception 'That event pass was just used. Add another pass, or upgrade.' using errcode = '42501';
  end if;
  update event_passes set event_id = p_event, used_at = now() where id = pass;
end;
$$;
revoke execute on function public.org_use_pass(uuid, text, uuid) from public, anon, authenticated;

-- What the publish check calls (it runs as the person publishing): the reason
-- this can't be published, or null after using a pass if one is needed. Only
-- for the account's own hosts.
create function public.publish_gate(p_org uuid, p_type text, p_event uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  reason text;
begin
  if not public.is_org_admin(p_org) then
    return 'Only the account''s hosts can publish its events.';
  end if;
  reason := public.org_publish_reason(p_org, p_type, p_event);
  if reason is null then
    perform public.org_use_pass(p_org, p_type, p_event);
  end if;
  return reason;
end;
$$;
revoke execute on function public.publish_gate(uuid, text, uuid) from public, anon;
grant execute on function public.publish_gate(uuid, text, uuid) to authenticated;

create or replace function public.events_publish_needs_plan()
returns trigger
language plpgsql
as $$
declare
  missing_step text;
  reason text;
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.event_type::text in ('conference', 'meeting') then
      missing_step := public.conference_not_ready(new.id);
      if missing_step is not null then
        raise exception '%', missing_step using errcode = 'P0001';
      end if;
    end if;
    -- One at a time, even if two are published at once.
    perform pg_advisory_xact_lock(hashtext('publish:' || new.organization_id::text || ':' || new.event_type::text));
    reason := public.publish_gate(new.organization_id, new.event_type::text, new.id);
    if reason is not null then
      raise exception '%', reason using errcode = case when reason like '%at a time%' then 'P0001' else '42501' end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists events_publish_needs_plan on public.events;
create trigger events_publish_needs_plan
  before insert or update of status on public.events
  for each row execute function public.events_publish_needs_plan();

-- Making an event: its type has to be in the package, or there's a pass for it.
-- (Replaces "free teacher accounts host conferences only", which Free now says.)
drop trigger if exists teacher_accounts_host_conferences on public.events;
drop function if exists public.teacher_accounts_host_conferences();
create function public.events_type_in_package()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  -- The account's own package, even while its plan isn't active: drafts are always free.
  tier plan_tiers;
  v_type text := coalesce(new.event_type::text, 'band_contest');
begin
  -- For everyone, the server too, as the free teacher rule was.
  if tg_op = 'INSERT' or new.event_type is distinct from old.event_type then
    tier := public.package_tier(new.organization_id);
    if not v_type = any (tier.event_types) and public.org_pass_for(new.organization_id, v_type, new.id) is null then
      if exists (select 1 from plan_tiers where kind = 'pass' and v_type = any (event_types)) then
        raise exception 'Your % plan doesn''t include %. Add a % pass or upgrade to %.',
          tier.name, public.event_type_words(v_type, true), public.event_type_words(v_type), public.upgrade_for(v_type) using errcode = '42501';
      end if;
      raise exception 'Your % plan doesn''t include %. Upgrade to %.',
        tier.name, public.event_type_words(v_type, true), public.upgrade_for(v_type) using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_type_in_package
  before insert or update of event_type on public.events
  for each row execute function public.events_type_in_package();
revoke execute on function public.events_type_in_package() from public, anon, authenticated;

-- 6. Team limits -----------------------------------------------------------------
-- The people on an account's team: hosts, co-hosts, Volunteer Leads and Section
-- Leads, each counted once. Demo people don't count.
create function public.org_team(p_org uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select t.user_id from (
    select m.user_id from organization_members m where m.organization_id = p_org
    union
    select s.user_id from event_staff s join events e on e.id = s.event_id where e.organization_id = p_org
  ) t
  join profiles p on p.id = t.user_id
  where p.email::text not like '%@demo.fieldcommandevents.com';
$$;
revoke execute on function public.org_team(uuid) from public, anon, authenticated;

-- Why this person can't join the team in this role, or null when they can.
-- p_staff: as a Volunteer Lead or Section Lead (not a host or co-host).
create function public.team_add_reason(p_org uuid, p_user uuid, p_email text, p_staff boolean)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.package_tier(p_org);
  who uuid := coalesce(p_user, (select id from profiles where email = p_email::citext));
begin
  if tier.code is null or coalesce(p_email, (select email::text from profiles where id = p_user), '') like '%@demo.fieldcommandevents.com' then
    return null;
  end if;
  if p_staff and not tier.event_staff then
    return format('Your %s plan doesn''t include Volunteer Leads or Section Leads. Upgrade to %s to add them.',
                  tier.name, public.upgrade_for(null, 'event_staff'));
  end if;
  if who is not null and who in (select public.org_team(p_org)) then
    return null;
  end if;
  if tier.max_team is not null and (select count(*) from public.org_team(p_org)) >= tier.max_team then
    return format('Your %s plan includes a team of %s. Upgrade to %s for a bigger team.',
                  tier.name,
                  case when tier.max_team = 2 and not tier.event_staff then '2 (a host and a co-host)' else 'up to ' || tier.max_team || ' people' end,
                  (select name from plan_tiers where kind = 'package' and sort > tier.sort
                     and (max_team is null or max_team > tier.max_team) order by sort limit 1));
  end if;
  return null;
end;
$$;
revoke execute on function public.team_add_reason(uuid, uuid, text, boolean) from public, anon, authenticated;

create function public.team_limits_on_members()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reason text;
begin
  if tg_table_name = 'organization_members' then
    -- The account's owner is always on it.
    if new.role::text = 'owner' then
      return new;
    end if;
    reason := public.team_add_reason(new.organization_id, new.user_id, null, false);
  else
    reason := public.team_add_reason((select organization_id from events where id = new.event_id), new.user_id, null, true);
  end if;
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger team_limits
  before insert on public.organization_members
  for each row execute function public.team_limits_on_members();
create trigger team_limits
  before insert on public.event_staff
  for each row execute function public.team_limits_on_members();
revoke execute on function public.team_limits_on_members() from public, anon, authenticated;

-- Inviting someone is checked too, so the host hears it when they invite.
create function public.team_limits_on_invitations()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reason text := public.team_add_reason((select organization_id from events where id = new.event_id), null, new.email::text, not new.as_host);
begin
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger team_limits
  before insert on public.invitations
  for each row execute function public.team_limits_on_invitations();
revoke execute on function public.team_limits_on_invitations() from public, anon, authenticated;

-- 7. Volunteer history -----------------------------------------------------------
-- Still recorded on every package (purge_volunteers is unchanged). Viewing or
-- downloading it needs a package with volunteer_history, or one the account had
-- before a downgrade (volunteer_tracking_open). This builds the rows; only
-- volunteer_report, which checks that, calls it.
create function public.volunteer_history_export(p_org uuid)
returns table (email text, full_name text, events int, signed_up int, checked_in int, last_event_name text, last_event_on date)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_see_volunteer_history(p_org) then
    raise exception 'Only the account''s hosts and Volunteer Leads can see volunteer history.' using errcode = '42501';
  end if;
  return query
    with hist as (
      select h.email, h.event_id, h.event_name, h.event_on, h.full_name, h.signed_up, h.checked_in
        from volunteer_history h
       where h.organization_id = p_org
      union all
      select c.email, c.event_id, c.event_name, c.event_on, c.full_name, c.signed_up, c.checked_in
        from public.volunteer_event_counts(p_org, now()) c
       where not exists (select 1 from volunteer_history h
                          where h.organization_id = p_org and h.email = c.email and h.event_id = c.event_id)
         and not exists (select 1 from volunteer_history_removed r
                          where r.organization_id = p_org and r.email = c.email and r.removed_at >= c.event_on)
    ),
    latest as (
      select distinct on (r.email) r.email, r.full_name, r.event_name, r.event_on
        from hist r
       order by r.email, r.event_on desc
    )
    select r.email::text, l.full_name, count(*)::int, sum(r.signed_up)::int, sum(r.checked_in)::int, l.event_name, l.event_on
      from hist r join latest l on l.email = r.email
     where r.signed_up > 0
     group by r.email, l.full_name, l.event_name, l.event_on;
end;
$$;
revoke execute on function public.volunteer_history_export(uuid) from public, anon, authenticated;

-- Volunteer tracking shows when the package includes it, or when the account had
-- it before a downgrade and has history to show. Otherwise the page is a preview.
create function public.volunteer_tracking_open(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select t.volunteer_history from organizations o join plan_tiers t on t.code = o.package where o.id = p_org), false)
      or (coalesce((select had_volunteer_tracking from organizations where id = p_org), false)
          and (exists (select 1 from volunteer_history where organization_id = p_org)
               or exists (select 1 from public.volunteer_event_counts(p_org, now()) where signed_up > 0)));
$$;
revoke execute on function public.volunteer_tracking_open(uuid) from public, anon, authenticated;

create or replace function public.volunteer_report(p_org uuid)
returns table (email text, full_name text, events int, signed_up int, checked_in int, last_event_name text, last_event_on date)
language plpgsql stable security definer set search_path = public
as $$
declare
  tier plan_tiers := public.package_tier(p_org);
begin
  if not public.can_see_volunteer_history(p_org) then
    raise exception 'Only the account''s hosts and Volunteer Leads can see volunteer history.' using errcode = '42501';
  end if;
  if not public.volunteer_tracking_open(p_org) then
    raise exception 'Your % plan doesn''t include volunteer tracking. Upgrade to % to see it.',
      tier.name, public.upgrade_for(null, 'volunteer_history') using errcode = '42501';
  end if;
  return query select * from public.volunteer_history_export(p_org);
end;
$$;

-- 8. What an account has and uses, for the app ------------------------------------
-- Its hosts, its Volunteer Leads (for the history page), and admins.
create function public.account_plan(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  o organizations;
  tier plan_tiers := public.org_tier(p_org);
  own plan_tiers := public.package_tier(p_org);
begin
  select * into o from organizations where id = p_org;
  if o.id is null or not (public.is_org_admin(p_org) or public.is_platform_admin() or public.can_see_volunteer_history(p_org)
                          or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Only the account''s hosts can see its plan.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'package', o.package,
    'package_name', (select name from plan_tiers where code = o.package),
    -- What it publishes under now: Free while a paid package's plan isn't active.
    'active', tier.code,
    'active_name', tier.name,
    'rate', o.rate,
    'event_types', to_jsonb(tier.event_types),
    -- What it can make drafts of: its own package's types (plus any with a pass).
    'own_event_types', to_jsonb(own.event_types),
    'one_at_a_time', to_jsonb(tier.one_at_a_time),
    'weekly_hours', tier.weekly_hours,
    -- The team and volunteer history follow the package itself.
    'max_team', own.max_team,
    'event_staff', own.event_staff,
    'volunteer_history', own.volunteer_history,
    -- Whether the Volunteer tracking page shows (also after a downgrade, with history).
    'volunteer_tracking', public.volunteer_tracking_open(p_org),
    'team', (select count(*) from public.org_team(p_org)),
    'published', coalesce((select jsonb_object_agg(t, n) from (
                   select event_type::text t, count(*) n from events
                    where organization_id = p_org and status = 'published' group by event_type) x), '{}'::jsonb),
    'passes_unused', coalesce((select jsonb_object_agg(t, n) from (
                   select event_type::text t, count(*) n from event_passes
                    where organization_id = p_org and event_id is null and expires_at > now() group by event_type) x), '{}'::jsonb),
    'pass_total_cents', o.pass_total_cents
  );
end;
$$;
revoke execute on function public.account_plan(uuid) from public, anon;
grant execute on function public.account_plan(uuid) to authenticated, service_role;

-- 9. The only ways a package changes or a pass is added -----------------------------
-- p_source: 'admin' (a Field Command Events admin) or 'payment' (the service
-- role, e.g. a future Stripe webhook).
create function public.package_caller_ok(p_source text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case p_source
    when 'admin' then public.is_platform_admin()
    when 'payment' then coalesce(auth.jwt() ->> 'role', '') = 'service_role' or current_setting('role', true) = 'service_role'
    else false
  end;
$$;
revoke execute on function public.package_caller_ok(text) from public, anon, authenticated;

create function public.set_account_package(p_org uuid, p_package text, p_rate text, p_note text, p_source text default 'admin')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  before organizations;
begin
  if not public.package_caller_ok(p_source) then
    raise exception 'Only Field Command Events admins or a payment can change packages.' using errcode = '42501';
  end if;
  if not exists (select 1 from plan_tiers where code = p_package and kind = 'package') then
    raise exception 'Pick a package.' using errcode = 'P0001';
  end if;
  if coalesce(p_rate, '') not in ('teacher', 'standard') then
    raise exception 'Pick a rate.' using errcode = 'P0001';
  end if;
  select * into before from organizations where id = p_org for update;
  if before.id is null then
    raise exception 'Organization not found' using errcode = 'P0001';
  end if;
  if before.package = p_package and before.rate = p_rate then
    return;
  end if;
  perform set_config('app.package_change', 'on', true);
  update organizations
     set package = p_package, rate = p_rate,
         had_volunteer_tracking = had_volunteer_tracking or (select volunteer_history from plan_tiers where code = p_package)
   where id = p_org;
  perform set_config('app.package_change', 'off', true);
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'package_changed', p_org, jsonb_build_object(
    'from', jsonb_build_object('package', before.package, 'rate', before.rate),
    'to', jsonb_build_object('package', p_package, 'rate', p_rate),
    'source', p_source,
    'note', nullif(trim(coalesce(p_note, '')), '')
  ));
end;
$$;
revoke execute on function public.set_account_package(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_account_package(uuid, text, text, text, text) to authenticated, service_role;

-- p_price_cents: what was paid. Null is the list price; 0 for a pass given free.
create function public.add_event_pass(p_org uuid, p_event_type text, p_note text, p_source text default 'admin', p_price_cents integer default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  price integer := (select price_cents from plan_tiers where kind = 'pass' and p_event_type = any (event_types));
  paid integer;
  pass uuid;
begin
  if not public.package_caller_ok(p_source) then
    raise exception 'Only Field Command Events admins or a payment can add event passes.' using errcode = '42501';
  end if;
  if price is null then
    raise exception 'There''s no event pass for that kind of event.' using errcode = 'P0001';
  end if;
  paid := coalesce(p_price_cents, price);
  if paid < 0 then
    raise exception 'The price can''t be negative.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from organizations where id = p_org) then
    raise exception 'Organization not found' using errcode = 'P0001';
  end if;
  insert into event_passes (organization_id, event_type, price_cents, source, note, created_by)
  values (p_org, p_event_type::public.event_type, paid, p_source, nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid())
  returning id into pass;
  perform set_config('app.package_change', 'on', true);
  update organizations set pass_total_cents = pass_total_cents + paid where id = p_org;
  perform set_config('app.package_change', 'off', true);
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'pass_added', p_org, jsonb_build_object(
    'event_type', p_event_type, 'price_cents', paid, 'source', p_source, 'note', nullif(trim(coalesce(p_note, '')), '')));
  return pass;
end;
$$;
revoke execute on function public.add_event_pass(uuid, text, text, text, integer) from public, anon;
grant execute on function public.add_event_pass(uuid, text, text, text, integer) to authenticated, service_role;

-- Upgrading a free teacher account now picks its package.
drop function if exists public.admin_upgrade_teacher(uuid, text);
create function public.admin_upgrade_teacher(p_org uuid, p_package text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can upgrade accounts.' using errcode = '42501';
  end if;
  if not exists (select 1 from plan_tiers where code = p_package and kind = 'package' and code <> 'free') then
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
revoke execute on function public.admin_upgrade_teacher(uuid, text, text) from public, anon;
grant execute on function public.admin_upgrade_teacher(uuid, text, text) to authenticated;
