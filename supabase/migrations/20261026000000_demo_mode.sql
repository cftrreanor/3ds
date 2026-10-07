-- =============================================================================
-- Demo mode: a FieldCommand admin (platform_admins) can try an event as each
-- role without juggling email addresses.
--
--   * Each admin gets one demo account per role ("persona"), with an email at
--     demo.fieldcommandevents.com that is never emailed.
--   * demo_events lists the events an admin has turned demo mode on for. A
--     demo account can only be added to those events, and only by the server.
--   * demo_join() puts a persona on an event (co-host, team member, a demo
--     band, a volunteer shift); demo_leave() takes all of them back off.
--
-- Everything here is server-only: browsers can't read or change it.
-- =============================================================================

create table public.demo_accounts (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  persona     text not null check (persona in ('host', 'volunteer_lead', 'section_lead', 'director', 'volunteer', 'parent')),
  created_at  timestamptz not null default now(),
  unique (owner_id, persona)
);

create table public.demo_events (
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  last_used_at  timestamptz not null default now(),
  primary key (owner_id, event_id)
);

alter table public.demo_accounts enable row level security;
alter table public.demo_events enable row level security;
revoke all on public.demo_accounts, public.demo_events from anon, authenticated;

-- Puts a demo persona on an event. Returns the demo band's id for a director.
create function public.demo_join(p_owner uuid, p_event uuid, p_user uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  acct    public.demo_accounts;
  ev      public.events;
  who     public.profiles;
  band_id uuid;
  vol_id  uuid;
  sh      public.shifts;
begin
  select * into acct from demo_accounts where user_id = p_user and owner_id = p_owner;
  if not found then
    raise exception 'Not a demo account' using errcode = 'P0001';
  end if;
  if not exists (select 1 from demo_events where owner_id = p_owner and event_id = p_event) then
    raise exception 'Demo mode is not on for this event' using errcode = 'P0001';
  end if;
  select * into ev from events where id = p_event;
  select * into who from profiles where id = p_user;

  if acct.persona = 'host' then
    insert into organization_members (organization_id, user_id, role)
    values (ev.organization_id, p_user, 'admin')
    on conflict do nothing;

  elsif acct.persona = 'volunteer_lead' then
    insert into event_staff (event_id, user_id, role) values (p_event, p_user, 'volunteer_director')
    on conflict do nothing;

  elsif acct.persona = 'section_lead' then
    insert into event_staff (event_id, user_id, role) values (p_event, p_user, 'section_lead')
    on conflict do nothing;
    -- Leads the first two stations (check-in path first), the first time.
    if not exists (select 1 from station_leads where event_id = p_event and user_id = p_user) then
      insert into station_leads (station_id, user_id, event_id)
      select id, p_user, p_event from stations
       where event_id = p_event
       order by checkpoint_order nulls last, sort_order, created_at
       limit 2;
    end if;

  elsif acct.persona = 'director' then
    select id into band_id from bands where event_id = p_event and director_user_id = p_user;
    if band_id is null then
      if cardinality(ev.classifications) = 0 then
        raise exception 'Add a classification to the event first' using errcode = 'P0001';
      end if;
      insert into bands (event_id, director_user_id, school_name, band_name, classification, school_address,
                         contact_email, head_director_name, head_director_email, head_director_phone,
                         student_count, chaperone_count, bus_count, box_truck_count)
      values (p_event, p_user, 'Demo High School', 'Demo Marching Band', ev.classifications[1],
              '100 Demo Way', who.email, who.full_name, who.email, '+15125550100',
              60, least(4, ev.chaperone_limit), 2, 1)
      returning id into band_id;
    end if;

  elsif acct.persona = 'volunteer' then
    select id into vol_id from volunteers where event_id = p_event and email = who.email;
    if vol_id is null then
      insert into volunteers (event_id, full_name, email, phone)
      values (p_event, who.full_name, who.email, '+15125550100')
      returning id into vol_id;
      -- One shift: the first with an open spot (or simply the first).
      select * into sh from shifts where event_id = p_event
       order by (registered_count >= max_capacity), starts_at
       limit 1
       for update;
      if found then
        insert into volunteer_assignments (shift_id, volunteer_id) values (sh.id, vol_id);
        update shifts set registered_count = registered_count + 1,
                          max_capacity = greatest(max_capacity, registered_count + 1)
         where id = sh.id;
      end if;
    end if;
  end if;
  -- 'parent' just looks at the public page: nothing to add.

  update demo_events set last_used_at = now() where owner_id = p_owner and event_id = p_event;
  return band_id;
end;
$$;

-- Takes an admin's demo people back off an event (and turns demo mode off for it).
create function public.demo_leave(p_owner uuid, p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  org uuid;
begin
  select organization_id into org from events where id = p_event;

  -- Free the demo volunteer's shift spots.
  update shifts s set registered_count = greatest(0, s.registered_count - n.cnt)
    from (
      select va.shift_id, count(*) as cnt
        from volunteer_assignments va
        join volunteers v on v.id = va.volunteer_id
        join profiles p on p.email = v.email
        join demo_accounts d on d.user_id = p.id and d.owner_id = p_owner
       where v.event_id = p_event
       group by va.shift_id
    ) n
   where s.id = n.shift_id;
  delete from volunteers v using profiles p, demo_accounts d
   where v.event_id = p_event and p.email = v.email and d.user_id = p.id and d.owner_id = p_owner;

  delete from bands b using demo_accounts d
   where b.event_id = p_event and b.director_user_id = d.user_id and d.owner_id = p_owner;
  delete from station_leads l using demo_accounts d
   where l.event_id = p_event and l.user_id = d.user_id and d.owner_id = p_owner;
  delete from event_staff s using demo_accounts d
   where s.event_id = p_event and s.user_id = d.user_id and d.owner_id = p_owner;
  -- The demo host leaves the organization unless it's demoing another of its events.
  delete from organization_members m using demo_accounts d
   where m.organization_id = org and m.user_id = d.user_id and d.owner_id = p_owner
     and not exists (
       select 1 from demo_events de join events e on e.id = de.event_id
        where de.owner_id = p_owner and de.event_id <> p_event and e.organization_id = org
     );

  -- Demo people don't linger on the Team page's "Removed" tab.
  delete from team_removals t using demo_accounts d
   where t.organization_id = org and t.user_id = d.user_id and d.owner_id = p_owner;

  delete from demo_events where owner_id = p_owner and event_id = p_event;
end;
$$;

revoke execute on function public.demo_join(uuid, uuid, uuid), public.demo_leave(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.demo_join(uuid, uuid, uuid), public.demo_leave(uuid, uuid) to service_role;
