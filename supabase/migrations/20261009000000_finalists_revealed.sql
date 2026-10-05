-- Finals happen in three stages:
--   1. finals_published: the finals times are public, slots show as
--      "Finalist 1, 2…, to be announced", so schools can plan their day.
--   2. The host saves finalist bands as judges pick them; names stay private.
--   3. finalists_revealed: the names show on the public schedule and on each
--      finalist's director page.
alter table public.events add column finalists_revealed boolean not null default false;
-- Events whose finals were already published showed their names; keep that.
update public.events set finalists_revealed = true where finals_published;
alter table public.events
  add constraint finalists_revealed_needs_finals_published check (not finalists_revealed or finals_published);

-- Raw finals rows (which band is in which slot) reach directors and the
-- public only once the finalists are revealed. The public schedule of times
-- comes from public_finals() below.
drop policy "finals: read when published" on public.finals_slots;
create policy "finals: read when revealed" on public.finals_slots
  for select to anon, authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_id and e.status = 'published' and e.finalists_revealed));

-- Times once the finals are published; names only once they're revealed.
create or replace function public.public_finals(p_slug text)
returns table (
  slot_number     int,
  perform_at      timestamptz,
  school_name     text,
  band_name       text,
  classification  text
)
language sql stable security definer set search_path = public
as $$
  select f.slot_number, f.perform_at,
         case when e.finalists_revealed then b.school_name end,
         case when e.finalists_revealed then b.band_name end,
         case when e.finalists_revealed then b.classification end
    from events e
    join finals_slots f on f.event_id = e.id
    left join bands b on b.id = f.band_id
   where e.slug = p_slug
     and e.status = 'published'
     and e.finals_published
   order by f.slot_number;
$$;
