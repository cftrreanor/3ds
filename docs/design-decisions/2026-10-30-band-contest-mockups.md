# Decisions: band contest setup and the run-up to contest day (mock-ups)

Review: docs/design-reviews/2026-10-30-band-contest-mockups.md
Owner decisions, 2026-10-30.

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Invite directors hides most recipients; no "already invited" state; re-sending breaks old links | 3 | Take the advice | Full searchable list, "Invited <date>" and "Registered" tags left unticked, "N of M chosen", re-sends keep the existing link working, confirmation after sending |
| 2 | "Anyone else?" paste box would email sign-in links to any address | 3 | Take the advice | Remove the box; link to the existing spreadsheet import |
| 3 | No path for a first-time host with no past directors | 3 | Take the advice | "Import your director list and invite them in one step"; Copy link and QR code always; list labeled "directors from your earlier contests" |
| 4 | Volunteers can't be shared and have no place on the event page | 3 | Take the advice | Volunteers row in "Get the word out" (Copy link, QR code); standing Volunteers card; Copy link on the jobs page; drop "Optional" |
| 5 | No standing way back to the event's parts | 3 | Take the advice | Always-visible section list (Bands, Schedule, Check-in stops, Volunteer jobs, Team, Event settings), each with a status line |
| 6 | Hosts can't start from last year's contest | 3 | Fix it differently | Separate project, built right after the new setup |
| 7 | Dark mode placeholders look filled in | 3 | Take the advice | Mock-up only (the app's placeholders are dimmer); long example text becomes a hint under the label |
| 8 | Registration autosave as drawn would fail and overwrite | 3 | Take the advice | Save field by field; Saving / Couldn't save (Retry) / typed-but-not-added states; classifications added on Enter, comma, or leaving the box |
| 9 | Removing a used classification strands bands | 3 | Take the advice | Database refuses it, with a security test; chip shows the band count and "Move bands…" |
| 10 | Shared job editor drops check-in stops | 3 | Take the advice | Band contests keep the stop type in More options and the Check-in order tab |
| 11 | "Publish, open registration later" leads nowhere | 3 | Take the advice | Dropped for now: one button, "Publish and open registration" |
| 12 | Closing and reopening registration not designed | 3 | Take the advice | "Close registration early" with a confirmation; "Reopen registration" asks for a new deadline |
| Sev 2 | The "Should fix" list | 2 | Take the advice | Applied in the revised mock-ups, then a light check |

## Light check on the revised mock-ups (owner, 2026-10-30)

Review: docs/design-reviews/2026-10-30-band-contest-mockups-v2.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | The event page's numbers disagree; status repeated | 3 | Take the advice | "Your contest" cards are navigation with one neutral fact each; status lives in the stage bar and main card; one source for every count; mock-up data fixed |
| 2 | Check-in stops set in two places | 3 | Fix it differently | Owner: set inside each volunteer job (More options), plus a small "Check-in order" list. The event page counts those jobs, so it never says "not set" when a job has a stop |
| 3 | A failed save still lets the host move on | 3 | Take the advice | Finish or retry saves before leaving; stay if one fails; mark the field |
| 4 | Dark mode: white text on red buttons | 3 | Take the advice | Dark text on red in dark mode, one shared color |
| 5 | Invitation sign-in links expire after 7 days | 3 | Take the advice | Keep 7 days; after that directors confirm with a code; add "Send a reminder" (a fresh link) for invited directors who haven't registered; stop promising "one tap" |
| 6 | Server rules (publish needs deadline and classification; used classifications can't be removed; field-by-field saves; reopening needs a deadline) | 3 | Take the advice | With security tests |
| 7 | Volunteer link before any jobs exist | 3 | Take the advice | "Add jobs first" until a job has open spots |
| — | New contests start with 1A–6A filled in | 2 | Fix it differently | Owner: start empty, with guidance under the field showing the formats people use (like 1A–6A, Class AA, or Division I) |
| — | Entry fee "Paid" tracking | 2 | Keep as is | Owner: not needed; hosts track payment elsewhere. The optional payment link stays |
| Sev 2 | The rest of the "Should fix" list | 2 | Take the advice | Built in, then checked in the screenshot review before the PR |
