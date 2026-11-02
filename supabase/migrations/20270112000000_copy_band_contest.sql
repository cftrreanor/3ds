-- =============================================================================
-- Start from a previous contest.
--   copy_band_contest_setup(from, to): a new band contest (a draft, nothing set up
--   yet) takes its setup from any earlier contest on the same account:
--     * registration settings: classifications, information for directors, the
--       payment link, the chaperone limit, meals, and the director contact;
--     * the registration deadline and opening day, moved by the same number of
--       days as contest day (dropped if that lands in the past);
--     * ready positions and equipment spots;
--     * volunteer jobs with their shifts (moved to the new days) and things to
--       bring, and the check-in stops in their order.
--   Not copied: bands, invitations, the performance schedule, Coordinators, or
--   anyone who signed up. Only a host of both contests can do it.
-- =============================================================================

create function public.copy_band_contest_setup(p_from uuid, p_to uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  src     public.events;
  dst     public.events;
  shift_d int;
  today   date;
  deadline date;
  opens   date;
  st      public.stations;
  new_id  uuid;
  jobs    int := 0;
  slots   int := 0;
begin
  select * into src from events where id = p_from;
  select * into dst from events where id = p_to for update;
  if src.id is null or dst.id is null
     or not public.is_event_admin(p_from) or not public.is_event_admin(p_to) then
    raise exception 'Only a host of both contests can copy one into the other.' using errcode = '42501';
  end if;
  if src.organization_id <> dst.organization_id then
    raise exception 'You can only start from a contest on the same account.' using errcode = 'P0001';
  end if;
  if src.event_type::text <> 'band_contest' or dst.event_type::text <> 'band_contest' then
    raise exception 'Both events need to be band contests.' using errcode = 'P0001';
  end if;
  if src.id = dst.id then
    raise exception 'Pick a different contest to start from.' using errcode = 'P0001';
  end if;
  if dst.status <> 'draft' or exists (select 1 from stations where event_id = p_to) or exists (select 1 from bands where event_id = p_to) then
    raise exception 'This contest is already set up, so it can''t start from another one.' using errcode = 'P0001';
  end if;

  -- Days between the two contest days: dates move by the same amount, in the new contest's time zone.
  shift_d := dst.starts_on - src.starts_on;
  today := (now() at time zone dst.timezone)::date;
  deadline := src.band_registration_deadline + shift_d;
  if deadline is not null and (deadline < today or deadline >= dst.starts_on) then
    deadline := null;
  end if;
  opens := src.band_registration_opens_on + shift_d;
  if opens is not null and (opens < today or deadline is null or opens > deadline) then
    opens := null;
  end if;

  update events set
    classifications            = src.classifications,
    director_info              = src.director_info,
    payment_link               = src.payment_link,
    chaperone_limit            = src.chaperone_limit,
    ready_minutes_before       = src.ready_minutes_before,
    finals_ready_minutes_before = src.finals_ready_minutes_before,
    equipment_spots            = src.equipment_spots,
    meals_offered              = src.meals_offered,
    meal_price_cents           = src.meal_price_cents,
    meal_details               = src.meal_details,
    meal_options               = src.meal_options,
    band_registration_deadline = deadline,
    band_registration_opens_on = opens
  where id = p_to;

  insert into event_director_contacts (event_id, name, phone, email)
  select p_to, name, phone, email from event_director_contacts where event_id = p_from
  on conflict (event_id) do nothing;

  -- Volunteer jobs, in their order, each with its shifts (moved to the new days) and things to bring.
  perform set_config('timezone', dst.timezone, true);
  for st in select * from stations where event_id = p_from order by sort_order, created_at loop
    insert into stations (event_id, name, station_type, location, instructions, sort_order, checkpoint_kind,
                          checkpoint_order, due_minutes_before_warm_up, adults_only, zone, details_saved_at,
                          signup_kind, showing, min_adults)
    values (p_to, st.name, st.station_type, st.location, st.instructions, st.sort_order, st.checkpoint_kind,
            st.checkpoint_order, st.due_minutes_before_warm_up, st.adults_only, st.zone,
            case when st.details_saved_at is not null then now() end, st.signup_kind, st.showing, st.min_adults)
    returning id into new_id;
    jobs := jobs + 1;
    insert into shifts (station_id, event_id, title, description, starts_at, ends_at, max_capacity, adults_only, min_age)
    select new_id, p_to, title, description, starts_at + make_interval(days => shift_d), ends_at + make_interval(days => shift_d),
           max_capacity, adults_only, min_age
      from shifts where station_id = st.id;
    get diagnostics slots = row_count;
    insert into station_items (station_id, event_id, name, needed, sort_order)
    select new_id, p_to, name, needed, sort_order from station_items where station_id = st.id;
  end loop;

  return jsonb_build_object('jobs', jobs, 'deadline', deadline);
end;
$$;
revoke execute on function public.copy_band_contest_setup(uuid, uuid) from public, anon;
grant execute on function public.copy_band_contest_setup(uuid, uuid) to authenticated;
