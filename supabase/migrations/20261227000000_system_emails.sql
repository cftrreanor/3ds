-- =============================================================================
-- Editable system emails.
--
-- The emails the app sends on its own (invitations, booking notices, and so
-- on) have built-in wording in the code. An admin can replace an email's
-- words (subject, heading, message, and button text) from the admin
-- dashboard; links, times, calendar invites and the footer stay in the code.
--   * system_email_overrides: one row per customized email, by its key
--     (src/lib/system-emails.ts lists them). No row: the built-in wording.
--   * admin_save_system_email() / admin_reset_system_email(): platform
--     admins only, logged in admin_log.
-- The app reads the rows with the server key when it sends an email.
-- =============================================================================

create table public.system_email_overrides (
  key           text primary key check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  subject       text not null check (char_length(trim(subject)) between 1 and 300),
  heading       text not null check (char_length(trim(heading)) between 1 and 200),
  body          text not null check (char_length(trim(body)) between 1 and 5000),
  button_label  text check (button_label is null or char_length(trim(button_label)) between 1 and 60),
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now()
);
alter table public.system_email_overrides enable row level security;
revoke all on public.system_email_overrides from anon, authenticated;
grant select on public.system_email_overrides to authenticated;
grant select, insert, update, delete on public.system_email_overrides to service_role;
create policy "system emails: admins read" on public.system_email_overrides
  for select to authenticated using (public.is_platform_admin());

create function public.admin_save_system_email(p_key text, p_subject text, p_heading text, p_body text, p_button_label text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change system emails.' using errcode = '42501';
  end if;
  insert into system_email_overrides (key, subject, heading, body, button_label, updated_by, updated_at)
  values (p_key, trim(p_subject), trim(p_heading), trim(p_body), nullif(trim(coalesce(p_button_label, '')), ''), auth.uid(), now())
  on conflict (key) do update
    set subject = excluded.subject, heading = excluded.heading, body = excluded.body,
        button_label = excluded.button_label, updated_by = excluded.updated_by, updated_at = now();
  insert into admin_log (admin_id, action, details)
  values (auth.uid(), 'system_email_changed', jsonb_build_object('key', p_key));
end;
$$;
revoke execute on function public.admin_save_system_email(text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_system_email(text, text, text, text, text) to authenticated;

create function public.admin_reset_system_email(p_key text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can change system emails.' using errcode = '42501';
  end if;
  delete from system_email_overrides where key = p_key;
  if found then
    insert into admin_log (admin_id, action, details)
    values (auth.uid(), 'system_email_reset', jsonb_build_object('key', p_key));
  end if;
end;
$$;
revoke execute on function public.admin_reset_system_email(text) from public, anon;
grant execute on function public.admin_reset_system_email(text) to authenticated;
