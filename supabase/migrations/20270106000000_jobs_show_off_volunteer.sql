-- A volunteer event's new jobs start hidden (20270105000000_volunteer_jobs_showing.sql).
-- Only volunteer events have a Show button, so when an event stops being a
-- volunteer event, its jobs show again. Otherwise they'd stay hidden with no
-- way to show them, and the event could publish an empty sign-up page.

create function public.events_show_jobs_off_volunteer()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.event_type::text = 'volunteer' and new.event_type::text <> 'volunteer' then
    update stations set showing = true where event_id = new.id and not showing;
  end if;
  return new;
end;
$$;
revoke execute on function public.events_show_jobs_off_volunteer() from public, anon, authenticated;
create trigger events_show_jobs_off_volunteer
  after update of event_type on public.events
  for each row execute function public.events_show_jobs_off_volunteer();
