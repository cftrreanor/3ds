-- =============================================================================
-- Event emails come from a person on the team, not just the organization.
--
-- Emails show as from "Becca Smith, Cedar Ridge Band Boosters via Field
-- Command Events": the person first (what a phone shows), then who they're
-- with. event_email_settings.sender_id is that person, chosen in Email
-- settings; with none chosen, it's the event's creator.
--
-- Only one of the account's hosts (owner or co-host) can be named: a trigger
-- checks, so no one can send under a stranger's name. Removing a co-host from
-- the account (or deleting their profile) falls back to the creator.
-- =============================================================================

alter table public.event_email_settings
  add column sender_id uuid references public.profiles (id) on delete set null;

grant insert (sender_id), update (sender_id) on public.event_email_settings to authenticated;

create function public.check_email_sender()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.sender_id is not null and not exists (
    select 1
      from events e
      join organization_members m on m.organization_id = e.organization_id
     where e.id = new.event_id and m.user_id = new.sender_id
  ) then
    raise exception 'Emails can only come from one of the account''s hosts.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_email_sender() from public, anon, authenticated;

create trigger event_email_settings_sender
  before insert or update of sender_id on public.event_email_settings
  for each row execute function public.check_email_sender();

-- A co-host leaving the account stops sending as them on its events.
create function public.forget_email_sender()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update event_email_settings s set sender_id = null
    from events e
   where e.id = s.event_id and e.organization_id = old.organization_id and s.sender_id = old.user_id;
  return old;
end;
$$;
revoke execute on function public.forget_email_sender() from public, anon, authenticated;

create trigger organization_members_forget_email_sender
  after delete on public.organization_members
  for each row execute function public.forget_email_sender();
