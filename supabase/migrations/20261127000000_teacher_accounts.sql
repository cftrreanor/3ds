-- =============================================================================
-- Free teacher accounts: a teacher signs up on their own (no invitation),
-- and can host parent-teacher conferences only. Everything else still needs
-- a pilot or a plan.
--
--   * organizations.account_kind: 'standard' (invited hosts) or 'teacher'.
--     organizations.school: the teacher's school, for the admin dashboard.
--     Hosts still can't change either (only name and time zone).
--   * create_teacher_account(): sets up the teacher's free account.
--     One account per person, and a limit on sign-ups per hour.
--   * Teacher accounts can only create conferences.
-- =============================================================================

alter table public.organizations
  add column account_kind text not null default 'standard' check (account_kind in ('standard', 'teacher')),
  add column school text check (school is null or char_length(school) <= 160);

create function public.create_teacher_account(p_full_name text, p_school text, p_tz text)
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
  return org;
end;
$$;
revoke execute on function public.create_teacher_account(text, text, text) from public, anon;
grant execute on function public.create_teacher_account(text, text, text) to authenticated;

-- Teacher accounts host conferences only, whoever adds the event.
create function public.teacher_accounts_host_conferences()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.event_type::text, '') <> 'conference'
     and exists (select 1 from organizations where id = new.organization_id and account_kind = 'teacher') then
    raise exception 'Free teacher accounts host parent-teacher conferences. Request a pilot for other kinds of events.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger teacher_accounts_host_conferences
  before insert or update of event_type, organization_id on public.events
  for each row execute function public.teacher_accounts_host_conferences();
revoke execute on function public.teacher_accounts_host_conferences() from public, anon, authenticated;
