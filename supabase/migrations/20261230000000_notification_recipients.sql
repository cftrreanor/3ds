-- =============================================================================
-- Who gets an event's notifications, for each kind of email.
--
-- Hosts pick, under Edit details → Email settings, who gets each kind of
-- email the event sends its organizers. Each kind is its own row:
--   * bookings: a meeting is booked, changed, or canceled, with its calendar
--     invite (conferences and meetings);
--   * band_registered: a band or group registers;
--   * band_withdrew: a band or group withdraws;
--   * volunteer_digest: a daily summary of volunteer sign-ups and cancellations.
-- Each row lists people (hosts, co-hosts, and the event's Volunteer Leads; the
-- app skips anyone who has left) and up to five other addresses.
--   * no row for a kind: as before (bookings go to the event's creator;
--     withdrawals to the director contact, or else every host); new kinds
--     (registrations, the volunteer summary) go to no one until picked.
--
-- volunteer_dropped_shifts: who stopped being signed up for a shift, for the
-- daily summary (a cancelled sign-up is deleted, so this is the only record).
-- Only the server reads it, and the daily job deletes rows after 7 days.
--
-- Separate tables, like event_email_settings: hosts only, never the public or
-- the event team.
-- =============================================================================

-- True when every entry is one plain email address (no names, commas or extra recipients).
create function public.valid_email_list(emails text[])
returns boolean
language sql immutable set search_path = public
as $$
  select coalesce(bool_and(char_length(e) <= 254 and e ~* '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$'), true)
  from unnest(emails) e;
$$;
grant execute on function public.valid_email_list(text[]) to authenticated, service_role;

create table public.event_notification_recipients (
  event_id      uuid not null references public.events (id) on delete cascade,
  kind          text not null check (kind in ('bookings', 'band_registered', 'band_withdrew', 'volunteer_digest')),
  member_ids    uuid[] not null default '{}',
  extra_emails  text[] not null default '{}'
                check (cardinality(extra_emails) <= 5 and public.valid_email_list(extra_emails)),
  updated_at    timestamptz not null default now(),
  primary key (event_id, kind)
);

alter table public.event_notification_recipients enable row level security;
revoke all on public.event_notification_recipients from anon, authenticated;
grant select on public.event_notification_recipients to authenticated;
grant insert (event_id, kind, member_ids, extra_emails, updated_at) on public.event_notification_recipients to authenticated;
grant update (member_ids, extra_emails, updated_at) on public.event_notification_recipients to authenticated;
grant select, insert, update, delete on public.event_notification_recipients to service_role;

-- Hosts only: Volunteer Leads, Section Leads and the public never see it.
create policy "notification recipients: hosts read" on public.event_notification_recipients
  for select to authenticated using (public.is_event_admin(event_id));
create policy "notification recipients: hosts add" on public.event_notification_recipients
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "notification recipients: hosts edit" on public.event_notification_recipients
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- No foreign keys: a row outlives its shift (that's the point), and the daily job clears it.
create table public.volunteer_dropped_shifts (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null,
  shift_id    uuid not null,
  full_name   text not null,
  dropped_at  timestamptz not null default now()
);
create index on public.volunteer_dropped_shifts (event_id, dropped_at);
alter table public.volunteer_dropped_shifts enable row level security;
revoke all on public.volunteer_dropped_shifts from anon, authenticated;
grant select, insert, delete on public.volunteer_dropped_shifts to service_role;

-- A sign-up ends (the volunteer cancels, or a host takes them off): note it. Not
-- when the whole shift, volunteer, or event is deleted (nothing left to tell).
create function public.note_dropped_shift()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ev uuid;
  who text;
begin
  select s.event_id into ev from shifts s where s.id = old.shift_id;
  select v.full_name into who from volunteers v where v.id = old.volunteer_id;
  if ev is not null and who is not null then
    insert into volunteer_dropped_shifts (event_id, shift_id, full_name) values (ev, old.shift_id, who);
  end if;
  return old;
end;
$$;
revoke execute on function public.note_dropped_shift() from public, anon, authenticated;
create trigger volunteer_assignments_note_dropped
  after delete on public.volunteer_assignments
  for each row execute function public.note_dropped_shift();

-- The daily job: forget dropped sign-ups after a week.
create function public.purge_dropped_shifts()
returns int
language sql security definer set search_path = public
as $$
  with gone as (delete from volunteer_dropped_shifts where dropped_at < now() - interval '7 days' returning 1)
  select count(*)::int from gone;
$$;
revoke execute on function public.purge_dropped_shifts() from public, anon, authenticated;
grant execute on function public.purge_dropped_shifts() to service_role;
