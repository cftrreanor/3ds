-- =============================================================================
-- Admin tools for free teacher accounts.
--
--   * Pipeline: a "teacher" stage. Each teacher sign-up adds a pipeline card
--     (linked to their account), so new teachers show up next to pilot
--     requests. Teachers who already signed up get one too.
--   * admin_upgrade_teacher(): makes a teacher account a full account (every
--     event type). Their plan is set separately, as for any account.
--   * admin_suspend_account() / admin_unsuspend_account(): suspending takes
--     every published event offline and stops the account publishing until
--     it's unsuspended. Closing an account already exists
--     (admin_close_account).
-- =============================================================================

-- 1. Pipeline stage ------------------------------------------------------------
alter table public.pilot_requests drop constraint if exists pilot_requests_status_check;
alter table public.pilot_requests add constraint pilot_requests_status_check
  check (status in ('new', 'contacted', 'invited', 'set_up', 'active', 'teacher', 'declined'));

insert into public.pilot_requests (name, email, organization, status, organization_id, created_at, stage_changed_at, notes)
select coalesce(nullif(trim(p.full_name), ''), split_part(p.email::text, '@', 1)),
       p.email::text,
       coalesce(o.school, o.name),
       'teacher', o.id, o.created_at, o.created_at,
       'Signed up for a free teacher account.'
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
  join public.profiles p on p.id = m.user_id
 where o.account_kind = 'teacher'
   and not exists (select 1 from public.pilot_requests r where r.organization_id = o.id);

create or replace function public.create_teacher_account(p_full_name text, p_school text, p_tz text)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_name text := trim(coalesce(p_full_name, ''));
  v_school text := trim(coalesce(p_school, ''));
  org public.organizations;
begin
  if me is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your name.' using errcode = 'P0001';
  end if;
  if char_length(v_school) < 2 or char_length(v_school) > 160 then
    raise exception 'Please enter your school''s name.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'Please pick your time zone.' using errcode = 'P0001';
  end if;
  -- One account per person (also stops a double tap making two).
  perform pg_advisory_xact_lock(hashtext('create_teacher_account'), hashtext(me::text));
  if exists (select 1 from organization_members where user_id = me) then
    raise exception 'You already have an account. Go to your dashboard to see it.' using errcode = 'P0001';
  end if;
  if (select count(*) from organizations
       where account_kind = 'teacher' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'We''re getting a lot of sign-ups right now. Please try again in an hour.' using errcode = 'P0001';
  end if;

  update profiles set full_name = v_name where id = me;
  insert into organizations (name, slug, default_timezone, account_kind, school)
  values (v_name,
          trim(both '-' from left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 40)) || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
          p_tz, 'teacher', v_school)
  returning * into org;
  insert into organization_members (organization_id, user_id, role)
  values (org.id, me, 'owner');
  -- Their card in the admin pipeline.
  insert into pilot_requests (name, email, organization, status, organization_id, notes)
  values (v_name, public.current_email()::text, v_school, 'teacher', org.id, 'Signed up for a free teacher account.');
  return org;
end;
$$;

-- 2. Upgrade --------------------------------------------------------------------
create function public.admin_upgrade_teacher(p_org uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can upgrade accounts.' using errcode = '42501';
  end if;
  update organizations set account_kind = 'standard' where id = p_org and account_kind = 'teacher';
  if not found then
    raise exception 'That account isn''t a free teacher account.' using errcode = 'P0001';
  end if;
  update pilot_requests
     set status = case when exists (select 1 from events where organization_id = p_org and status = 'published') then 'active' else 'set_up' end
   where organization_id = p_org and status = 'teacher';
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'teacher_upgraded', p_org, jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;
revoke execute on function public.admin_upgrade_teacher(uuid, text) from public, anon;
grant execute on function public.admin_upgrade_teacher(uuid, text) to authenticated;

-- 3. Suspend --------------------------------------------------------------------
alter table public.organizations add column suspended_at timestamptz;

create function public.admin_suspend_account(p_org uuid, p_note text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can suspend accounts.' using errcode = '42501';
  end if;
  update organizations set suspended_at = now() where id = p_org and suspended_at is null;
  if not found then
    raise exception 'That account is already suspended, or doesn''t exist.' using errcode = 'P0001';
  end if;
  update events set status = 'draft' where organization_id = p_org and status = 'published';
  get diagnostics n = row_count;
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'account_suspended', p_org,
          jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), ''), 'unpublished', n));
  return n;
end;
$$;

create function public.admin_unsuspend_account(p_org uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only Field Command Events admins can unsuspend accounts.' using errcode = '42501';
  end if;
  update organizations set suspended_at = null where id = p_org and suspended_at is not null;
  if not found then
    raise exception 'That account isn''t suspended.' using errcode = 'P0001';
  end if;
  insert into admin_log (admin_id, action, organization_id, details)
  values (auth.uid(), 'account_unsuspended', p_org, jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), '')));
end;
$$;
revoke execute on function public.admin_suspend_account(uuid, text), public.admin_unsuspend_account(uuid, text) from public, anon;
grant execute on function public.admin_suspend_account(uuid, text), public.admin_unsuspend_account(uuid, text) to authenticated;

-- A suspended account can't publish, whoever tries.
create function public.suspended_accounts_cant_publish()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published'
     and exists (select 1 from organizations where id = new.organization_id and suspended_at is not null) then
    raise exception 'This account is suspended, so its events can''t be published. Please contact us.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger suspended_accounts_cant_publish
  before update of status on public.events
  for each row execute function public.suspended_accounts_cant_publish();
revoke execute on function public.suspended_accounts_cant_publish() from public, anon, authenticated;
