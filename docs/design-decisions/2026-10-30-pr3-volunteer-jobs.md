# Decisions: volunteer jobs, setup steps, and folder tabs, built pages (2026-10-30)

Review: docs/design-reviews/2026-10-30-pr3-volunteer-jobs.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Publish buttons work when no job is showing | 3 | Take the advice | No publish buttons until a job is showing; links to the hidden jobs that are ready. Publish and open sign-up in one step |
| 2 | Totals disagree | 3 | Take the advice | One set of totals everywhere (shifts and things to bring, showing jobs only); one hidden-jobs sentence |
| 3 | "Save for later" next to "Save job" | 3 | Fix it differently | Follow the mock-up: a hidden job's bar has "Save as hidden" and "Save and show to volunteers"; a showing job's bar has "Save job". "Save for later" goes away for volunteer jobs. Owner: "I want to follow the mock-up, I wonder if I made everything too complicated" |
| 4 | "Volunteers can see this job" on a draft | 3 | Take the advice | On drafts: "volunteers will see this job when you publish" |
| 5 | Changing a volunteer draft's type leaves its jobs hidden | 3 | Take the advice | Jobs go back to showing when an event stops being a volunteer event, in the database, with a test |
| Form length | The job form is long; Shifts far down on phones | 2 | Take the advice | Shorten to the mock-up: name, check-in place, Coordinator, Shifts first; the rest under "More options" |
| Severity 2 | Tabs on phones, old wording, dead end, dark-mode tabs, amber marks, faint buttons, preview, staff screens, tab semantics, page names, publish card placement, public page with two jobs, desk wording | 2 | Take the advice | All in this PR |
| Follow-up | Light check or full panel | | Light check | Same six reviewers, changed screens only |

## Owner changes after the follow-up check (2026-10-30)

| Change | Notes |
|---|---|
| No Showing/Hidden for jobs | "If they save it and it's published it's going to show up." A job shows once it has a shift or a thing to bring. Migration 20270106000000_jobs_always_showing.sql |
| Autosave on the job | No Save buttons for a job's details; "Saving…", "Saved", "Not saved" |
| Shifts / Things to bring first, then the name, then the shifts; Coordinators, instructions, and adults only under More options | Check-in place field removed (the event's address covers it) |
| Pinned bar: Delete job and Add another job, plus "Next up: Publish your event" | Who's signed up moves below the daily summary; Import volunteers moves to More options at the end of the page; row deletes use the shared bin icon |

## Third-round review (owner, 2026-10-30)

Review: docs/design-reviews/2026-10-30-pr3-volunteer-jobs-v3.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 8 | The bar's strongest button pulls away from a job that needs a shift | 3 | Fix it differently | While the open job has no shift or thing to bring, Add another job and Next up are disabled (and look it), with a note; Delete job stays. Once every job is ready, Next up: Publish your event is the filled button |
| 3 | Old check-in places still show to volunteers | 3 | Take the advice | Volunteer events don't show a job's own place; the event's address covers it. Stored values stay |
| 1, 2, 4–7 | Ready-but-missing jobs, lost edits, dark-mode controls, phone item rows, faded buttons, publish blocker wording | 3 | Take the advice | All in this PR |
| Severity 2 | The smaller list | 2 | Take the advice | All in this PR |
