-- When anything on the public schedule changes, so open pages can show
-- "The schedule has been updated - Refresh now".
alter table public.events add column schedule_updated_at timestamptz not null default now();

-- Times, breaks or finals changed: bump the event's timestamp. Saves rewrite
-- many rows in one transaction; now() is the same for all of them, so only
-- the first row actually updates the event.
create or replace function public.touch_schedule()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update events set schedule_updated_at = now()
   where id = coalesce(new.event_id, old.event_id) and schedule_updated_at <> now();
  return null;
end;
$$;

create trigger performance_slots_touch_schedule after insert or update or delete on public.performance_slots
  for each row execute function public.touch_schedule();
create trigger finals_slots_touch_schedule after insert or update or delete on public.finals_slots
  for each row execute function public.touch_schedule();
create trigger schedule_breaks_touch_schedule after insert or update or delete on public.schedule_breaks
  for each row execute function public.touch_schedule();

-- Publishing, unpublishing, revealing or a new ready position also counts.
create or replace function public.events_touch_schedule()
returns trigger
language plpgsql
as $$
begin
  if (new.performance_order_published, new.finals_published, new.finalists_revealed,
      new.ready_minutes_before, new.finals_ready_minutes_before, new.status)
     is distinct from
     (old.performance_order_published, old.finals_published, old.finalists_revealed,
      old.ready_minutes_before, old.finals_ready_minutes_before, old.status) then
    new.schedule_updated_at := now();
  end if;
  return new;
end;
$$;
create trigger events_touch_schedule before update on public.events
  for each row execute function public.events_touch_schedule();

-- What open pages poll: just the timestamp, for published events.
create or replace function public.schedule_version(p_slug text)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select schedule_updated_at from events where slug = p_slug and status = 'published';
$$;

revoke execute on function public.touch_schedule(), public.events_touch_schedule() from public, anon, authenticated;
revoke execute on function public.schedule_version(text) from public;
grant execute on function public.schedule_version(text) to anon, authenticated;
