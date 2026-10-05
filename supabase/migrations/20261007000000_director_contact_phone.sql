-- The host's phone number for band directors unlocks only the day before and
-- on contest day (event time zone), like section leads' contact details.
-- Name and email stay readable as before; the phone column is no longer
-- selectable directly and comes from director_contact_phone() instead.
alter table public.event_director_contacts
  add column has_phone boolean generated always as (phone <> '') stored;

revoke select on public.event_director_contacts from authenticated;
grant select (event_id, name, email, has_phone, updated_at) on public.event_director_contacts to authenticated;

create or replace function public.director_contact_phone(ev uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select nullif(c.phone, '')
    from event_director_contacts c
    join events e on e.id = c.event_id
   where c.event_id = ev
     and (
       public.is_event_staff(ev)
       or (exists (select 1 from bands b where b.event_id = ev and b.director_user_id = auth.uid())
           and (now() at time zone e.timezone)::date between e.starts_on - 1 and e.ends_on)
     );
$$;

revoke execute on function public.director_contact_phone(uuid) from public, anon;
grant execute on function public.director_contact_phone(uuid) to authenticated;
