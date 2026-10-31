-- =============================================================================
-- Band registration rules, enforced here so a second tab, a co-host, or an old
-- link can't get around them (docs/design-lessons.md L4):
--   1. Publishing a band contest needs a registration deadline and at least one
--      classification; once it's live, the deadline can't be cleared and the last
--      classification can't be removed.
--   2. Opening (or reopening) band registration needs a deadline.
--   3. A classification a band is registered in (and hasn't withdrawn from) can't
--      be removed.
--   4. Classifications are added and removed one at a time
--      (add_event_classification / remove_event_classification), so two people
--      editing at once don't undo each other.
--   5. An optional payment link (https only), shown to directors.
-- Like events_publish_needs_job, rules 1 and 2 hold for people using the app
-- (signed in or not); the server's own jobs and direct database sessions aren't
-- held to them.
-- =============================================================================

-- 5. Payment link -------------------------------------------------------------------------------
alter table public.events add column payment_link text
  check (payment_link is null or (payment_link ~ '^https://[^[:space:]]+$' and length(payment_link) <= 500));

-- 1–3. The rules ---------------------------------------------------------------------------------
create function public.events_registration_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  in_use text;
begin
  if current_setting('role', true) not in ('authenticated', 'anon') then
    return new;
  end if;

  -- 3. A classification bands are registered in stays (any event that has bands).
  if tg_op = 'UPDATE' and old.classifications is distinct from new.classifications then
    select b.classification into in_use
      from bands b
     where b.event_id = new.id and b.scratched_at is null
       and not (b.classification = any (coalesce(new.classifications, '{}')))
     limit 1;
    if in_use is not null then
      raise exception 'Bands are registered in %. Move them to another classification first.', in_use using errcode = 'P0001';
    end if;
  end if;

  -- Rules 1 and 2 hold when an event changes: the app always creates events as drafts with
  -- registration closed, then publishes and opens it by updating it.
  if tg_op <> 'UPDATE' or new.event_type::text <> 'band_contest' then
    return new;
  end if;

  -- 1. Publishing, and staying published.
  if new.status = 'published' then
    if new.band_registration_deadline is null
       and (old.status is distinct from 'published' or old.band_registration_deadline is not null
            or old.event_type is distinct from new.event_type) then
      raise exception 'Publishing needs a registration deadline.' using errcode = 'P0001';
    end if;
    if cardinality(coalesce(new.classifications, '{}')) = 0
       and (old.status is distinct from 'published' or cardinality(coalesce(old.classifications, '{}')) > 0
            or old.event_type is distinct from new.event_type) then
      raise exception 'Publishing needs at least one classification.' using errcode = 'P0001';
    end if;
  end if;

  -- 2. Opening registration.
  if new.band_registration_open and new.band_registration_deadline is null
     and not old.band_registration_open then
    raise exception 'Pick a registration deadline to open registration.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
revoke execute on function public.events_registration_rules() from public, anon, authenticated;
create trigger events_registration_rules
  before insert or update of status, event_type, classifications, band_registration_deadline, band_registration_open
  on public.events
  for each row execute function public.events_registration_rules();

-- 4. One classification at a time -----------------------------------------------------------------
-- Run as the caller, so the usual "hosts can update their event" rule decides who may.
create function public.add_event_classification(p_event uuid, p_name text)
returns text[]
language plpgsql security invoker set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  result text[];
begin
  if v_name = '' or length(v_name) > 40 then
    raise exception 'A classification is 1 to 40 characters, like 1A or Class AA.' using errcode = 'P0001';
  end if;
  update events
     set classifications = case when v_name = any (classifications) then classifications
                                else array_append(classifications, v_name) end
   where id = p_event
  returning classifications into result;
  if not found then
    raise exception 'You don''t have permission to change this event.' using errcode = '42501';
  end if;
  return result;
end;
$$;

create function public.remove_event_classification(p_event uuid, p_name text)
returns text[]
language plpgsql security invoker set search_path = public
as $$
declare
  result text[];
begin
  update events
     set classifications = array_remove(classifications, btrim(coalesce(p_name, '')))
   where id = p_event
  returning classifications into result;
  if not found then
    raise exception 'You don''t have permission to change this event.' using errcode = '42501';
  end if;
  return result;
end;
$$;

revoke all on function public.add_event_classification(uuid, text) from public, anon;
revoke all on function public.remove_event_classification(uuid, text) from public, anon;
grant execute on function public.add_event_classification(uuid, text) to authenticated;
grant execute on function public.remove_event_classification(uuid, text) to authenticated;
