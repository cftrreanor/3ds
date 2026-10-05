-- Ready position: how many minutes before performing each band must be lined up.
-- Set per event by the host (it used to be a fixed 5 minutes).
alter table public.events
  add column ready_minutes_before int not null default 5
    check (ready_minutes_before between 0 and 60);
