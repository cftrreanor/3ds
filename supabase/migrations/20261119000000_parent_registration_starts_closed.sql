-- =============================================================================
-- Parent registration starts closed: the host opens it when they're ready
-- (like band registration and volunteer signup), so publishing a school
-- visitor event no longer opens registration on its own.
-- =============================================================================

alter table public.events alter column parent_registration_open set default false;

-- Events that haven't taken a registration yet start closed too: anything not
-- published, and anything that isn't a school visitor event (should it become
-- one later).
update public.events set parent_registration_open = false
 where parent_registration_open and (status <> 'published' or event_type::text <> 'school_visit');
