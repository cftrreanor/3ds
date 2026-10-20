-- =============================================================================
-- Event emails carry the organizer's name, and replies can go to them.
--
-- Emails still come from our own address (email apps reject mail that claims
-- someone else's domain), shown as "Lone Star Band Boosters via Field Command
-- Events". Reply-To is where a reply goes:
--   * no row here: the event's creator (for a conference, the teacher);
--   * replies = false: nowhere (our no-reply address);
--   * replies = true: reply_to, or the creator's account email when blank.
--
-- A separate table, not a column on events: published events are readable by
-- anyone, and a personal email must not be.
--
-- calendar_entries also returns event_id now, so volunteer emails know which
-- event's settings to use.
-- =============================================================================

create table public.event_email_settings (
  event_id    uuid primary key references public.events (id) on delete cascade,
  replies     boolean not null,
  reply_to    text check (reply_to is null or (char_length(reply_to) <= 254 and reply_to ~* '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$')),
  updated_at  timestamptz not null default now()
);

alter table public.event_email_settings enable row level security;
revoke all on public.event_email_settings from anon, authenticated;
grant select on public.event_email_settings to authenticated;
grant insert (event_id, replies, reply_to, updated_at) on public.event_email_settings to authenticated;
grant update (replies, reply_to, updated_at) on public.event_email_settings to authenticated;

-- Hosts only: Volunteer Leads, Section Leads and the public never see it.
create policy "event email settings: hosts read" on public.event_email_settings
  for select to authenticated using (public.is_event_admin(event_id));
create policy "event email settings: hosts add" on public.event_email_settings
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "event email settings: hosts edit" on public.event_email_settings
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- The same signups, with their event.
drop function public.calendar_entries(uuid[], boolean);
create function public.calendar_entries(p_assignment_ids uuid[], p_bump boolean default false)
returns table (
  assignment_id     uuid,
  manage_token      uuid,
  access_token      uuid,
  calendar_sequence int,
  volunteer_name    text,
  volunteer_email   text,
  event_name        text,
  timezone          text,
  venue_name        text,
  venue_address     text,
  station_name      text,
  station_location  text,
  instructions      text,
  shift_title       text,
  shift_description text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  lead_name         text,
  lead_phone        text,
  event_id          uuid
)
language plpgsql security definer set search_path = public
as $$
begin
  if p_bump then
    update volunteer_assignments va set calendar_sequence = va.calendar_sequence + 1
     where va.id = any (p_assignment_ids);
  end if;
  return query
    select va.id, va.manage_token, v.access_token, va.calendar_sequence, v.full_name, v.email::text,
           e.name, e.timezone, e.venue_name, e.venue_address, st.name, st.location, st.instructions,
           s.title, s.description, s.starts_at, s.ends_at, p.full_name, p.phone, e.id
      from volunteer_assignments va
      join volunteers v on v.id = va.volunteer_id
      join shifts s on s.id = va.shift_id
      join stations st on st.id = s.station_id
      join events e on e.id = v.event_id
      left join profiles p on p.id = st.lead_user_id
     where va.id = any (p_assignment_ids)
     order by s.starts_at;
end;
$$;
revoke execute on function public.calendar_entries(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.calendar_entries(uuid[], boolean) to service_role;
