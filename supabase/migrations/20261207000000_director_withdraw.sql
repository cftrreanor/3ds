-- =============================================================================
-- A band director withdraws their own band after registration closed or the
-- schedule was posted. The band stays on the schedule, marked withdrawn (the
-- same mark the organizer's team uses on contest day), so the posted order
-- isn't left with a gap. Only the organizer can undo it.
-- (While registration is open and before times are posted, directors can
-- still remove the registration outright: "bands: director withdraw".)
-- =============================================================================

create or replace function public.withdraw_my_band(p_band uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b bands%rowtype;
begin
  select * into b from bands where id = p_band for update;
  if not found or b.director_user_id is distinct from auth.uid() then
    raise exception 'Only the band''s director can withdraw it' using errcode = 'insufficient_privilege';
  end if;
  if b.scratched_at is not null then
    return;
  end if;
  update bands set scratched_at = now() where id = p_band;
end;
$$;

revoke all on function public.withdraw_my_band(uuid) from public, anon;
grant execute on function public.withdraw_my_band(uuid) to authenticated;
