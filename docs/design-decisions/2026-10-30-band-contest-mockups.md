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

## Event page direction (owner, 2026-11-03)

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| — | Band contests' event page as a separate stage-bar dashboard (stage bar, one main card, "Before contest day", "Your contest" grid) | — | Fix it differently | Owner: one dashboard for every event type. Band contests keep the shared event page; the mock-ups' useful facts (registration counts, invited who haven't registered, "post times by" with the reason, check-in stops due date) go into the existing cards and checklist. Supersedes decisions 5 and light-check 1 above for the event page layout |

## PR3 light check (2026-11-03)

Review: Content Manager, UX Designer, UI Designer, and the usability consultant, on the screenshots in
docs/design-reviews/2026-11-03-band-pr3/ (open, closed, and opens-later states).

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Invited counts disagree between Get the word out and Band registration | 3 | Take the advice | One count from one helper: "N invited directors haven't registered". Get the word out says "N not invited yet, and N invited who haven't registered" |
| — | "See who hasn't" and "invite directors" while registration is closed | 2 | Take the advice | Closed: "Reopen registration to remind them", and the summary drops "or invite directors" |
| — | "Bands in 3 of 4 classifications" doesn't name the empty one | 2 | Take the advice | "No bands yet in 1A"; hidden with no bands or one classification |
| — | "Closes in 320 days" | 2 | Take the advice | "Closes Fri, Sep 17", bold; "Closes in N days" only in the last two weeks; shown in the opens-later state too |
| — | "Post times by …, 2027" | 2 | Take the advice | "Publish by Sat, Sep 25, two weeks before contest day, so directors can book buses" |
| — | Check-in stops step: "Optional" next to "Due by" | 2 | Take the advice | "Like parking, check-in, and the gate. Due Sat, Sep 25 if you have volunteers, so they can be placed." |
| — | Volunteers card says "no jobs" twice; inline "Add a job" easy to miss; box inside a card | 1–2 | Take the advice | No zero-count line; "No jobs yet" sentence; the card's button becomes "Add a job"; no nested box |
| — | "Add jobs first" vs "Add a job" | 1 | Take the advice | Both say "Add a job" |

## PR4 light check (2026-11-04)

Review: Content Manager, UX Designer, UI Designer, and the usability consultant, on the screenshots in
docs/design-reviews/2026-11-04-band-pr4/ (band contests on the Volunteer jobs screen, check-in stop in
More options, Check-in order tab).

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Reorder arrows: name on a span, no confirmation, focus lost | 3 | Take the advice | Label on the button, glyph hidden; "Band parking moved to stop 2 of 3. Saved" spoken and shown; focus stays on the stop's arrow |
| 2 | A stop with no Coordinator gets no warning (only Coordinators and organizers can check bands in) | 3 | Take the advice | "Needs a Coordinator" on the job tab and "Needs a Coordinator to check bands in" on the order row |
| 3 | Count mismatch on the Volunteers card | 3 if real | No change | Sample data only (the preview had no sign-up rows) |
| — | "Check-in" means volunteers and bands on one screen | 2 | Take the advice | "Volunteer check-in" button; "Band check-in stop" field; "Band check-in order" tab |
| — | Stop setting buried in More options | 2 | Fix it differently | Owner decided More options (2026-10-30). Added "Make a job a stop" on the order tab, linking to each job with More options open, and "Set the order of stops" in the field's hint |
| — | Arrows move position row to row and look faint | 2 | Take the advice | Two fixed columns, outline buttons, larger glyphs |
| — | Dropdown options long and cut off on phones | 2 | Take the advice | Short names; the chosen stop's description under the field in plain words |
| — | Shift-lock note incomplete | 2 | Take the advice | Says to set Not a stop, then delete the shifts |
| — | Minutes field: twisted label, full width, no unit | 2 | Take the advice | "Minutes before warm-up", narrow box with "minutes" after it |
| — | Job tabs reorder with the stops | 2 | Fix it differently | Kept (stops lead on every contest-day screen); the order tab now says so |
| — | Stops not marked on tabs; badge "1" without total | 1 | Take the advice | "Stop 1 · 2 of 8 filled" on tabs; "Stop 1 of 3 · Parking" badge |
| — | Order rows hide deadlines; heading size; intro wording | 1 | Take the advice | "Due 60 minutes before warm-up" under each stop; job heading style; clearer intro |
| — | Empty-job bar not shown | 1 | Take the advice | Screenshot 6 added |
| — | Event page amber box for an optional step; stops line on the event page | 1 | Keep as is | The amber box names a job volunteers can't see yet; event page layout is out of scope |

## Setup order (owner, 2026-11-04)

Owner: a band contest sets up as 1) Event details, 2) Band registration, 3) Volunteers (optional),
4) Publish registration. Team and maps stay optional before publishing (Event settings). Check-in
order and the performance schedule come after publishing, each due two weeks before contest day.

Light check (UX Designer, usability consultant) on docs/design-reviews/2026-11-04-band-pr4-order/:

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Checklist and phone bar said "Next: Add volunteer jobs" while the step bar said Publish | 3 | Take the advice | Before publishing, only a step publishing needs can be "in progress" ahead of Publish; all three now say Publish registration |
| — | "Optional" disappeared when a job needed something | 2 | Take the advice | "Optional · Check-in table needs a shift"; darker dashed bar |
| — | Unfinished volunteer work stayed under "Before you publish" once live | 2 | Take the advice | Moves to "After you publish" as "Finish volunteer jobs", before Open volunteer sign-up |
| — | "Optional" next to a due date | 2 | Take the advice | Check-in order and the schedule show "Due Sep 25" as their tag |
| — | Draft page invites after-publish work | 2 | Take the advice | Volunteers card before Schedule; schedule card says "After you publish registration, by …"; check-in order tab says "After you publish · Due …" |
| — | Step bar cramped on phones | 2 | Take the advice | Two rows of two on phones |
| — | Sticky bar covers content; sidebar clipped with no cue | 2 | Later | Shared by every event type; separate fix |
| — | "Publish registration" narrower than what publishing does | 1 | Keep as is | Owner's name; the step's hint says the contest page goes online |
| — | Skip-to-publish link on the Registration step | 1 | Keep as is | The step bar links to Publish registration |
