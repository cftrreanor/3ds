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
--   6. A band contest's registration deadline falls before contest day.
--   7. The chaperone limit can't drop below what a registered band is bringing.
--   8. A classification can be renamed (rename_event_classification); its bands move with it.
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
  over record;
begin
  if current_setting('role', true) not in ('authenticated', 'anon') then
    return new;
  end if;

  -- 3. A classification bands are registered in stays (any event that has bands). A rename moves
  -- its bands in the same step (rename_event_classification), so it's let through.
  if tg_op = 'UPDATE' and old.classifications is distinct from new.classifications
     and coalesce(current_setting('app.renaming_classification', true), '') <> 'on' then
    select b.classification into in_use
      from bands b
     where b.event_id = new.id and b.scratched_at is null
       and not (b.classification = any (coalesce(new.classifications, '{}')))
     limit 1;
    if in_use is not null then
      raise exception 'Bands are registered in %. Move them to another classification first.', in_use using errcode = 'P0001';
    end if;
  end if;

  -- 7. The chaperone limit stays at or above what each registered band is bringing (any event).
  if tg_op = 'UPDATE' and new.chaperone_limit is distinct from old.chaperone_limit then
    select coalesce(nullif(b.band_name, ''), b.school_name) as name, b.chaperone_count into over
      from bands b
     where b.event_id = new.id and b.scratched_at is null and b.chaperone_count > new.chaperone_limit
     order by b.chaperone_count desc
     limit 1;
    if found then
      raise exception '% registered % chaperones. Set the limit to at least %.', over.name, over.chaperone_count, over.chaperone_count
        using errcode = 'P0001';
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

  -- 6. The deadline falls before contest day.
  if new.band_registration_deadline is not null and new.starts_on is not null
     and new.band_registration_deadline >= new.starts_on
     and (new.band_registration_deadline is distinct from old.band_registration_deadline
          or new.starts_on is distinct from old.starts_on or old.event_type is distinct from new.event_type) then
    raise exception 'The registration deadline needs to be before contest day (%).', to_char(new.starts_on, 'Mon FMDD')
      using errcode = 'P0001';
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
  before insert or update of status, event_type, classifications, band_registration_deadline, band_registration_open, starts_on, chaperone_limit
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
     set classifications = case when exists (select 1 from unnest(classifications) c where lower(c) = lower(v_name))
                                then classifications
                                else array_append(classifications, v_name) end
   where id = p_event
  returning classifications into result;
  if cardinality(result) > 30 then
    raise exception 'A contest can have up to 30 classifications.' using errcode = 'P0001';
  end if;
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

-- 8. Rename one, moving its bands with it (a typo fixed after bands registered). Runs as the
-- owner so the bands move too; only the event's admins may.
create function public.rename_event_classification(p_event uuid, p_old text, p_new text)
returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  v_old text := btrim(coalesce(p_old, ''));
  v_new text := btrim(coalesce(p_new, ''));
  result text[];
begin
  if not public.is_event_admin(p_event) then
    raise exception 'You don''t have permission to change this event.' using errcode = '42501';
  end if;
  if v_new = '' or length(v_new) > 40 then
    raise exception 'A classification is 1 to 40 characters, like 1A or Class AA.' using errcode = 'P0001';
  end if;
  if v_new = v_old then
    select classifications into result from events where id = p_event;
    return result;
  end if;
  if exists (select 1 from events e, unnest(e.classifications) c
              where e.id = p_event and lower(c) = lower(v_new) and c <> v_old) then
    raise exception '% is already a classification.', v_new using errcode = 'P0001';
  end if;
  perform set_config('app.renaming_classification', 'on', true);
  update events set classifications = array_replace(classifications, v_old, v_new)
   where id = p_event and v_old = any (classifications)
  returning classifications into result;
  if not found then
    raise exception '% isn''t a classification here anymore. Reload the page.', v_old using errcode = 'P0001';
  end if;
  update bands set classification = v_new where event_id = p_event and classification = v_old;
  perform set_config('app.renaming_classification', '', true);
  return result;
end;
$$;

revoke all on function public.rename_event_classification(uuid, text, text) from public, anon;
grant execute on function public.rename_event_classification(uuid, text, text) to authenticated;

revoke all on function public.add_event_classification(uuid, text) from public, anon;
revoke all on function public.remove_event_classification(uuid, text) from public, anon;
grant execute on function public.add_event_classification(uuid, text) to authenticated;
grant execute on function public.remove_event_classification(uuid, text) to authenticated;
