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
--   * Try-it events can't send invitations outside the account (band and group
--     director invitations here; the app also holds back import emails). Team
--     invitations still work.

-- 1. A try-it event: its type isn't in the account's package, and no pass covers it.
create function public.event_is_trial(p_event uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not e.event_type::text = any ((public.package_tier(e.organization_id)).event_types)
         and public.org_pass_for(e.organization_id, e.event_type::text, e.id) is null
    from events e
   where e.id = p_event;
$$;
revoke execute on function public.event_is_trial(uuid) from public, anon, authenticated;

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
