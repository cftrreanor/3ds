-- =============================================================================
-- Contest day: every step is a two-state button. Tapping a done step again
-- ("✓ Buses · 8:02 AM") takes back just that step, instead of the separate
-- Undo link. New taps for band_action():
--   clear_buses, clear_equipment (frees the spot), clear_left (back to their
--   old spot if it's still free, otherwise the next free one), clear_here,
--   clear_performed.
-- Same rules as the taps they reverse: the station's Section Leads, hosts
-- and Volunteer Leads. Each one is logged like any other tap.
-- =============================================================================

create or replace function public.band_action(p_band_id uuid, p_action text, p_station_id uuid default null, p_round text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b       bands;
  st      stations;
  spot    int;
  detail  text;
  snap    jsonb;
  stop    uuid;
  parking_actions constant text[] := array['buses_here', 'equipment_here', 'away', 'back', 'left',
                                           'clear_buses', 'clear_equipment', 'clear_left'];
  stop_actions    constant text[] := array['here', 'performed', 'clear_here', 'clear_performed'];
begin
  select * into b from bands where id = p_band_id;
  if b.id is null then
    raise exception 'Band not found' using errcode = 'P0001';
  end if;

  if p_action in ('scratched', 'unscratched') then
    if not public.can_manage_volunteers(b.event_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    p_station_id := null;
    p_round := null;
  else
    select * into st from stations where id = p_station_id and event_id = b.event_id;
    if st.id is null or st.checkpoint_kind is null then
      raise exception 'That isn''t a check-in station for this event' using errcode = 'P0001';
    end if;
    if not (public.can_manage_volunteers(b.event_id)
            or exists (select 1 from station_leads where station_id = st.id and user_id = auth.uid())) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if (p_action = any (parking_actions)) <> (st.checkpoint_kind = 'parking')
       or (p_action in ('performed', 'clear_performed') and st.checkpoint_kind <> 'gate')
       or not (p_action = any (parking_actions || stop_actions)) then
      raise exception 'That tap doesn''t belong to this station' using errcode = 'P0001';
    end if;
    if st.checkpoint_kind in ('warm_up', 'gate') then
      if p_round is null or p_round not in ('prelims', 'finals') then
        raise exception 'Prelims or finals?' using errcode = 'P0001';
      end if;
    else
      p_round := null;
    end if;
  end if;

  -- One tap at a time per event, so two leads never get the same spot.
  perform 1 from events where id = b.event_id for update;
  select * into b from bands where id = p_band_id for update;
  snap := public.band_parking_snapshot(b);

  case p_action
    when 'buses_here' then
      if b.buses_at is not null then return; end if;
      update bands set buses_at = now() where id = b.id;
    when 'equipment_here' then
      if b.equipment_at is not null then return; end if;
      select min(n) into spot
        from generate_series(1, (select count(*)::int + 1 from bands where event_id = b.event_id)) n
       where not exists (select 1 from bands o where o.event_id = b.event_id and o.equipment_spot = n);
      update bands set equipment_at = now(), equipment_spot = spot where id = b.id;
      detail := 'Spot ' || spot;
    when 'away' then
      if b.away_at is not null or b.left_at is not null then return; end if;
      update bands set away_at = now() where id = b.id;
    when 'back' then
      if b.away_at is null then return; end if;
      update bands set away_at = null where id = b.id;
    when 'left' then
      if b.left_at is not null then return; end if;
      update bands set left_at = now(), away_at = null, equipment_spot = null where id = b.id;
      detail := case when b.equipment_spot is not null then 'Spot ' || b.equipment_spot || ' is free' end;
    -- Tapping a done step again takes just that step back.
    when 'clear_buses' then
      if b.buses_at is null then return; end if;
      update bands set buses_at = null where id = b.id;
    when 'clear_equipment' then
      if b.equipment_at is null then return; end if;
      update bands set equipment_at = null, equipment_spot = null where id = b.id;
      detail := case when b.equipment_spot is not null then 'Spot ' || b.equipment_spot || ' is free' end;
    when 'clear_left' then
      if b.left_at is null then return; end if;
      -- Back to the spot they had, if nobody has taken it since; otherwise the next free one.
      if b.equipment_at is not null then
        select (a.before ->> 'equipment_spot')::int into spot
          from band_activity a
         where a.band_id = b.id and a.action = 'left' and a.undone_at is null
         order by a.id desc limit 1;
        if spot is null or exists (select 1 from bands o where o.event_id = b.event_id and o.equipment_spot = spot) then
          select min(n) into spot
            from generate_series(1, (select count(*)::int + 1 from bands where event_id = b.event_id)) n
           where not exists (select 1 from bands o where o.event_id = b.event_id and o.equipment_spot = n);
        end if;
        detail := 'Spot ' || spot;
      end if;
      update bands set left_at = null, equipment_spot = spot where id = b.id;
    when 'clear_here', 'clear_performed' then
      delete from band_stops
       where band_id = b.id and station_id = st.id and round is not distinct from p_round
         and performed = (p_action = 'clear_performed')
      returning id into stop;
      if stop is null then return; end if;
      stop := null; -- nothing left to undo it back to
    when 'scratched' then
      if b.scratched_at is not null then return; end if;
      update bands set scratched_at = now() where id = b.id;
    when 'unscratched' then
      if b.scratched_at is null then return; end if;
      update bands set scratched_at = null where id = b.id;
    else -- 'here' or 'performed'
      insert into band_stops (event_id, band_id, station_id, round, performed, created_by)
      values (b.event_id, b.id, st.id, p_round, p_action = 'performed', auth.uid())
      on conflict do nothing
      returning id into stop;
      if stop is null then return; end if;
  end case;

  insert into band_activity (event_id, band_id, station_id, action, round, detail, before, stop_id, created_by, actor_name)
  values (b.event_id, b.id, p_station_id, p_action, p_round, detail, snap, stop, auth.uid(), public.my_display_name());
end;
$$;
