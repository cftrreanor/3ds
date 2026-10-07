-- =============================================================================
-- Maps & documents: who uploaded each file, and when. Replacing a file counts
-- as a new upload. Set by the database, so it can't be filled in wrong.
-- =============================================================================

alter table public.event_files
  add column uploaded_by uuid references public.profiles (id) on delete set null,
  add column uploaded_at timestamptz not null default now();
update public.event_files set uploaded_by = created_by, uploaded_at = created_at;

create function public.event_files_stamp_upload()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.path is distinct from old.path then
    new.uploaded_by := auth.uid();
    new.uploaded_at := now();
  else
    new.uploaded_by := old.uploaded_by;
    new.uploaded_at := old.uploaded_at;
  end if;
  return new;
end;
$$;
create trigger event_files_stamp_upload
  before insert or update on public.event_files
  for each row execute function public.event_files_stamp_upload();
