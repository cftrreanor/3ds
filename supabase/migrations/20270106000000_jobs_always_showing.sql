-- Volunteer jobs no longer have a Showing / Hidden setting in the app (owner,
-- 2026-10-30: "If they save it and it's published it's going to show up").
-- Every job shows. A job with no shifts or things to bring still never reaches
-- the sign-up page (nothing to sign up for), and publishing still needs one job
-- with a shift or a thing to bring.
--
-- The column and its rules (20270105000000_volunteer_jobs_showing.sql) stay,
-- unused: with every job showing they never get in the way.
update public.stations set showing = true where not showing;
