-- Public volunteer pages use the event's slug in the link, e.g.
-- fieldcommandevents.com/e/cedar-ridge-invitational-x7k2/volunteer
-- Slugs already carry a random suffix; make them unique across all events.
create unique index if not exists events_slug_unique on public.events (slug);
