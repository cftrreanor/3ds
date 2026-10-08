-- =============================================================================
-- Band invitations: a host invites directors who registered bands at the
-- organization's earlier events to register for a new one.
--
--   * past_band_directors(event) lists those directors (hosts only).
--   * band_invitations records who was emailed. Each email carries a secret
--     token: tapping it once (within 30 days) signs the director in, straight
--     to registration with their saved band details. The server checks and
--     uses the token; browsers never see it.
-- =============================================================================

create table public.band_invitations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  email       citext not null,
  token       uuid not null default gen_random_uuid() unique,
  invited_by  uuid references public.profiles (id) on delete set null,
  sent_at     timestamptz not null default now(),
  -- When its sign-in link was used (it works once).
  used_at     timestamptz,
  unique (event_id, email)
);
create index on public.band_invitations (event_id);

alter table public.band_invitations enable row level security;
revoke all on public.band_invitations from anon, authenticated;
-- Hosts can see who was invited and when; never the tokens. Sending is done by the server.
grant select (id, event_id, email, invited_by, sent_at, used_at) on public.band_invitations to authenticated;
create policy "band invitations: hosts read" on public.band_invitations
  for select to authenticated using (public.is_event_admin(event_id));

-- Directors who registered a band at another of this event's organization's
-- events, newest first. Empty for anyone but the event's hosts.
create function public.past_band_directors(p_event uuid)
returns table (
  email         text,
  full_name     text,
  bands         text[],
  last_event    text,
  last_event_on date,
  registered    boolean,
  invited_at    timestamptz
)
language sql stable security definer set search_path = public
as $$
  with ev as (
    select organization_id from events where id = p_event and public.is_event_admin(p_event)
  ),
  past as (
    select b.director_user_id, b.band_name, b.school_name, e.name as event_name, e.starts_on
      from bands b
      join events e on e.id = b.event_id
     where e.organization_id = (select organization_id from ev)
       and e.id <> p_event
  )
  select p.email::text,
         p.full_name,
         array_agg(distinct past.band_name || ' (' || past.school_name || ')'),
         (array_agg(past.event_name order by past.starts_on desc))[1],
         max(past.starts_on),
         exists (select 1 from bands b2 where b2.event_id = p_event and b2.director_user_id = p.id),
         (select i.sent_at from band_invitations i where i.event_id = p_event and i.email = p.email)
    from past
    join profiles p on p.id = past.director_user_id
   -- Demo directors (demo mode) aren't real people to invite.
   where p.email::text not like '%@demo.fieldcommandevents.com'
   group by p.id, p.email, p.full_name
   order by max(past.starts_on) desc, p.full_name;
$$;

revoke execute on function public.past_band_directors(uuid) from public, anon;
grant execute on function public.past_band_directors(uuid) to authenticated;
