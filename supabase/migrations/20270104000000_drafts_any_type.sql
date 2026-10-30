-- Drafts of any event type, and the plan checked only at publishing.
--
--   * Any account can set up a draft of any event type. Types outside its
--     package are "try it" events: they can be set up and previewed, and
--     publishing needs a plan (or a pass) that includes the type.
--   * Changing the type of a published event checks the plan for the new type
--     (before, the check ran only when an event was made).
--   * "One at a time" counts only events that haven't ended yet, in the
--     event's own time zone. A finished conference doesn't block the next one,
--     and the message no longer suggests unpublishing a live event.
--   * Try-it events don't email anyone outside the account: band and group
--     director invitations are refused here, and every other event email checks
--     event_email_blocked() before it goes out. Team invitations still work.
--   * A published event is never a try-it event (published events stay up and
--     keep working after a plan changes).
--   * account_host(): the Account Host's name and email, for the account's own
--     team (so a Co-host knows who to ask about a plan).

-- 1. A try-it event: its type isn't in the account's package, and no pass covers it.
create function public.event_is_trial(p_event uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select e.status <> 'published'
         and not e.event_type::text = any ((public.package_tier(e.organization_id)).event_types)
         and public.org_pass_for(e.organization_id, e.event_type::text, e.id) is null
    from events e
   where e.id = p_event;
$$;
revoke execute on function public.event_is_trial(uuid) from public, anon, authenticated;
-- The server checks it once per event before sending event emails (src/lib/email.ts).
grant execute on function public.event_is_trial(uuid) to service_role;

/** For the app: whether this is a try-it event. The event's team only; false for anyone else. */
create function public.event_trial(p_event uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_event_staff(p_event) and public.event_is_trial(p_event), false);
$$;
revoke execute on function public.event_trial(uuid) from public, anon;
grant execute on function public.event_trial(uuid) to authenticated, service_role;

-- 2. Making or changing an event's type ------------------------------------------
-- Any type can be a draft. A published event that changes type needs a plan for
-- the new type, the same as publishing it would.
create or replace function public.events_type_in_package()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reason text;
begin
  -- For everyone, the server too.
  if tg_op = 'UPDATE' and new.event_type is distinct from old.event_type
     and old.status = 'published' and new.status = 'published' then
    -- An event holds one pass, for the kind it was published as.
    if exists (select 1 from event_passes where event_id = new.id and event_type::text <> new.event_type::text) then
      raise exception 'This event was published with a % pass, so it stays a % while it''s published.',
        public.event_type_words(old.event_type::text), public.event_type_words(old.event_type::text) using errcode = 'P0001';
    end if;
    perform pg_advisory_xact_lock(hashtext('publish:' || new.organization_id::text || ':' || new.event_type::text));
    reason := public.org_publish_reason(new.organization_id, new.event_type::text, new.id);
    if reason is not null then
      raise exception '%', reason using errcode = case when reason like '%at a time%' then 'P0001' else '42501' end;
    end if;
    perform public.org_use_pass(new.organization_id, new.event_type::text, new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.events_type_in_package() from public, anon, authenticated;

-- 3. Why an event can't be published ------------------------------------------------
-- Same as before, except "one at a time" counts only events that haven't ended.
create or replace function public.org_publish_reason(p_org uuid, p_type text, p_event uuid)
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
       and ends_on >= (now() at time zone timezone)::date
     order by starts_on limit 1;
    if other is not null then
      return format('Your %s plan publishes one %s at a time, and %s is published. You can publish this one after %s ends, or upgrade to %s.',
                    tier.name, public.event_type_words(p_type), other, other, public.upgrade_for(p_type));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.org_publish_reason(uuid, text, uuid) from public, anon, authenticated;

-- 4. Try-it events don't invite people from outside the account ---------------------
create function public.band_invitations_need_plan()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ev events;
begin
  if public.event_is_trial(new.event_id) then
    select * into ev from events where id = new.event_id;
    raise exception 'Your plan doesn''t include %, so this event can''t send invitations yet. You can keep setting it up and preview it.',
      public.event_type_words(ev.event_type::text, true) using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.band_invitations_need_plan() from public, anon, authenticated;
create trigger band_invitations_need_plan
  before insert on public.band_invitations
  for each row execute function public.band_invitations_need_plan();

-- 5. Every other email from a try-it event ---------------------------------------------
-- The server asks before sending an event's email: which of these addresses are
-- outside the account (not one of its hosts, or on this event's team)? Those are
-- held back. Nothing is held back for other events.
create function public.event_email_blocked(p_event uuid, p_emails text[])
returns text[]
language sql stable security definer set search_path = public
as $$
  select case when not coalesce(public.event_is_trial(p_event), false) then '{}'::text[]
    else coalesce(array(
      select x from unnest(p_emails) x
       where lower(x) not in (
         select lower(p.email) from profiles p
          where p.email is not null and (
            p.id in (select m.user_id from organization_members m join events e on e.organization_id = m.organization_id where e.id = p_event)
            or p.id in (select s.user_id from event_staff s where s.event_id = p_event)))
    ), '{}'::text[]) end;
$$;
revoke execute on function public.event_email_blocked(uuid, text[]) from public, anon, authenticated;
grant execute on function public.event_email_blocked(uuid, text[]) to service_role;

-- 6. A pass is used for the event's current type -------------------------------------
-- Before, any pass already on the event counted for any type. (A published event
-- with a pass can't change kind: see events_type_in_package.)
create or replace function public.org_use_pass(p_org uuid, p_type text, p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  pass uuid;
begin
  if p_type = any ((public.org_tier(p_org)).event_types)
     or exists (select 1 from event_passes where event_id = p_event and event_type::text = p_type) then
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

-- 7. The Account Host, for the account's own hosts ---------------------------------------
/** The Account Host's display name and email, for someone on the same account; null for anyone else. */
create function public.account_host(p_org uuid)
returns table (user_id uuid, name text, email text)
language sql stable security definer set search_path = public
as $$
  select m.user_id, coalesce(nullif(trim(p.full_name), ''), p.email::text), p.email::text
    from organization_members m join profiles p on p.id = m.user_id
   where m.organization_id = p_org and m.role = 'owner' and public.is_org_admin(p_org)
   order by m.created_at
   limit 1;
$$;
revoke execute on function public.account_host(uuid) from public, anon;
grant execute on function public.account_host(uuid) to authenticated;

-- 8. The plan summary counts only published events that haven't ended -----------------
do $$
declare
  src text := pg_get_functiondef('public.account_plan(uuid)'::regprocedure);
begin
  src := replace(src, $q$where organization_id = p_org and status = 'published' group by event_type$q$,
                      $q$where organization_id = p_org and status = 'published' and ends_on >= (now() at time zone timezone)::date group by event_type$q$);
  if src not like '%ends_on >= (now() at time zone timezone)::date group by event_type%' then
    raise exception 'account_plan has changed; update this migration';
  end if;
  execute src;
end $$;
