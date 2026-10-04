-- =============================================================================
-- Phase 3: band registration, performance order, public schedule.
-- =============================================================================

-- Directors may edit their registration only while registration is open;
-- after that, changes go through the host.
drop policy "bands: director update own" on public.bands;
create policy "bands: director update own" on public.bands
  for update to authenticated
  using (
    director_user_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.band_registration_open)
  )
  with check (director_user_id = auth.uid());

-- Directors can withdraw while registration is open.
create policy "bands: director withdraw" on public.bands
  for delete to authenticated
  using (
    director_user_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.band_registration_open)
  );

-- A performance slot must belong to a band at the same event.
create or replace function public.performance_slots_validate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from bands where id = new.band_id and event_id = new.event_id) then
    raise exception 'That band is registered for a different event' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger performance_slots_validate
  before insert or update on public.performance_slots
  for each row execute function public.performance_slots_validate();

-- Save the whole running order in one go (all or nothing). Runs as the
-- caller, so only the event's host can do it.
--   p_slots: [{"band_id": "...", "warm_up_at": "...", "perform_at": "...", "warm_up_location": "..."}, ...]
--   in performance order.
create or replace function public.save_performance_order(p_event_id uuid, p_slots jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'Only the event''s host can set the performance order' using errcode = '42501';
  end if;
  delete from performance_slots where event_id = p_event_id;
  insert into performance_slots (band_id, event_id, performance_order, warm_up_at, perform_at, warm_up_location)
  select (s.value ->> 'band_id')::uuid,
         p_event_id,
         s.ordinality::int,
         nullif(s.value ->> 'warm_up_at', '')::timestamptz,
         nullif(s.value ->> 'perform_at', '')::timestamptz,
         nullif(s.value ->> 'warm_up_location', '')
    from jsonb_array_elements(p_slots) with ordinality as s(value, ordinality);
end;
$$;

-- The public schedule: only what spectators should see, and only once the
-- host has published the order. No contact details, no counts.
create or replace function public.public_schedule(p_slug text)
returns table (
  performance_order int,
  perform_at        timestamptz,
  school_name       text,
  band_name         text,
  classification    text,
  status            public.band_status
)
language sql stable security definer set search_path = public
as $$
  select ps.performance_order, ps.perform_at, b.school_name, b.band_name, b.classification, b.status
    from events e
    join performance_slots ps on ps.event_id = e.id
    join bands b on b.id = ps.band_id
   where e.slug = p_slug
     and e.status = 'published'
     and e.performance_order_published
   order by ps.performance_order;
$$;

revoke execute on function public.save_performance_order(uuid, jsonb), public.public_schedule(text)
  from public, anon;
grant execute on function public.save_performance_order(uuid, jsonb) to authenticated;
grant execute on function public.public_schedule(text) to anon, authenticated;
