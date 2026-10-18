-- An account's color, taken from its logo when the logo is uploaded (the host
-- can pick a different one). Used for the VOLUNTEER band on badges and for the
-- public event pages: the colored band behind the event name, buttons, and
-- links. Only the account's hosts and co-hosts can set it.

alter table public.organizations
  add column brand_color text
  constraint organizations_brand_color_hex check (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$');

create or replace function public.set_org_brand_color(p_org uuid, p_color text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only the account''s hosts can change its color.' using errcode = 'insufficient_privilege';
  end if;
  if p_color is not null and p_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'That isn''t a color.' using errcode = 'invalid_parameter_value';
  end if;
  update organizations set brand_color = p_color where id = p_org;
end;
$$;
revoke all on function public.set_org_brand_color(uuid, text) from public, anon;
grant execute on function public.set_org_brand_color(uuid, text) to authenticated;
