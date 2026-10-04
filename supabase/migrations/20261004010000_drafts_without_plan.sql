-- Let hosts build events before paying: drafts are free, publishing (making
-- the event visible to volunteers, bands and the public) needs an active plan.
drop policy "events: hosts insert" on public.events;
create policy "events: hosts insert" on public.events
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    and (status <> 'published' or public.org_has_active_plan(organization_id))
  );

drop policy "events: hosts update" on public.events;
create policy "events: hosts update" on public.events
  for update to authenticated
  using (public.is_event_admin(id))
  with check (
    public.is_org_admin(organization_id)
    and (status <> 'published' or public.org_has_active_plan(organization_id))
  );

-- Users may edit their name and phone, but not the email that identifies them.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Org members can see each other's names (for the team list).
create policy "profiles: read org teammates" on public.profiles
  for select to authenticated
  using (exists (
    select 1
      from public.organization_members mine
      join public.organization_members theirs on theirs.organization_id = mine.organization_id
     where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  ));
