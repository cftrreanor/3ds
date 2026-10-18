-- An account's logo, for printed volunteer badges (one per account, used on
-- every event's badges). The image lives in a private storage bucket; our
-- server reads it for the people who can print badges (hosts and Volunteer
-- Leads). Only the account's hosts and co-hosts can set or remove it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-logos', 'org-logos', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

alter table public.organizations
  add column logo_path text
  constraint organizations_logo_in_own_folder check (logo_path is null or logo_path like id::text || '/%');

-- Set (or, with null, remove) the logo. Returns the previous file's path so
-- the server can delete it.
create or replace function public.set_org_logo(p_org uuid, p_path text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  old_path text;
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Only the account''s hosts can change its logo.' using errcode = 'insufficient_privilege';
  end if;
  if p_path is not null and p_path not like p_org::text || '/%' then
    raise exception 'That logo file belongs to another account.' using errcode = 'invalid_parameter_value';
  end if;
  select logo_path into old_path from organizations where id = p_org for update;
  update organizations set logo_path = p_path where id = p_org;
  return old_path;
end;
$$;
revoke all on function public.set_org_logo(uuid, text) from public, anon;
grant execute on function public.set_org_logo(uuid, text) to authenticated;
