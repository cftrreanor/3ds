-- =============================================================================
-- Contest day, for people outside the team:
--   * A band's director sees their own band's progress along the check-in
--     path (which stops they've reached and when), to show their next step.
--   * The public schedule shows who has performed, who's at the gate and who
--     withdrew, from the gate's taps instead of the clock. Only for rounds the
--     public can already see (published order, revealed finalists).
-- The team's notes, activity log and other bands' details stay private.
-- =============================================================================

create function public.my_band_progress(p_band_id uuid)
returns table (
  station_id        uuid,
  name              text,
  checkpoint_kind   public.checkpoint_kind,
  checkpoint_order  int,
  due_minutes_before_warm_up int,
  round             text,
  performed         boolean,
  reached_at        timestamptz
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.checkpoint_kind, s.checkpoint_order, s.due_minutes_before_warm_up,
         st.round, coalesce(st.performed, false), st.reached_at
    from bands b
    join stations s on s.event_id = b.event_id and s.checkpoint_kind is not null
    left join band_stops st on st.station_id = s.id and st.band_id = b.id
   where b.id = p_band_id
     and (b.director_user_id = auth.uid() or public.is_event_staff(b.event_id))
   order by s.checkpoint_order, st.round nulls first, st.performed;
$$;

create function public.public_progress(p_slug text)
returns table (
  round      text,
  number     int,
  at_gate    boolean,
  performed  boolean,
  scratched  boolean
)
language sql stable security definer set search_path = public
as $$
  with e as (
    select id, performance_order_published, finalists_revealed
      from events where slug = p_slug and status = 'published'
  ),
  gate as (
    select st.band_id, st.round, bool_or(not st.performed) as here, bool_or(st.performed) as done
      from band_stops st
      join stations s on s.id = st.station_id and s.checkpoint_kind = 'gate'
      join e on e.id = st.event_id
     group by st.band_id, st.round
  )
  select 'prelims', ps.performance_order, coalesce(g.here, false), coalesce(g.done, false), b.scratched_at is not null
    from e
    join performance_slots ps on ps.event_id = e.id
    join bands b on b.id = ps.band_id
    left join gate g on g.band_id = ps.band_id and g.round = 'prelims'
   where e.performance_order_published
  union all
  select 'finals', f.slot_number, coalesce(g.here, false), coalesce(g.done, false), b.scratched_at is not null
    from e
    join finals_slots f on f.event_id = e.id
    join bands b on b.id = f.band_id
    left join gate g on g.band_id = f.band_id and g.round = 'finals'
   where e.finalists_revealed;
$$;

revoke execute on function public.my_band_progress(uuid), public.public_progress(text) from public;
revoke execute on function public.my_band_progress(uuid) from anon;
grant execute on function public.my_band_progress(uuid) to authenticated;
grant execute on function public.public_progress(text) to anon, authenticated;
