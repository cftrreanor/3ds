-- =============================================================================
-- Who gets an event's notifications.
--
-- Hosts pick who hears about the event: booking emails with their calendar
-- invites (conferences and meetings) and alerts like a band withdrawing. They
-- can tick people on the account (hosts and co-hosts) and add up to five other
-- addresses, like a front office.
--   * no row here: as before (bookings go to the event's creator; alerts go to
--     the director contact, or else every host on the account);
--   * member_ids: people on the account (the app skips anyone who has left);
--   * extra_emails: other addresses, each a plain email.
--
-- A separate table, like event_email_settings: hosts only, never the public
-- or the event team.
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
  event_id      uuid primary key references public.events (id) on delete cascade,
  member_ids    uuid[] not null default '{}',
  extra_emails  text[] not null default '{}'
                check (cardinality(extra_emails) <= 5 and public.valid_email_list(extra_emails)),
  updated_at    timestamptz not null default now()
);

alter table public.event_notification_recipients enable row level security;
revoke all on public.event_notification_recipients from anon, authenticated;
grant select on public.event_notification_recipients to authenticated;
grant insert (event_id, member_ids, extra_emails, updated_at) on public.event_notification_recipients to authenticated;
grant update (member_ids, extra_emails, updated_at) on public.event_notification_recipients to authenticated;
grant select, insert, update, delete on public.event_notification_recipients to service_role;

-- Hosts only: Volunteer Leads, Section Leads and the public never see it.
create policy "notification recipients: hosts read" on public.event_notification_recipients
  for select to authenticated using (public.is_event_admin(event_id));
create policy "notification recipients: hosts add" on public.event_notification_recipients
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "notification recipients: hosts edit" on public.event_notification_recipients
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
