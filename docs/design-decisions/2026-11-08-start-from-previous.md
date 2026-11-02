# Start from a previous contest (2026-11-08)

Owner request: start a new band contest from any earlier contest on the account (a format that worked
well, not just last year's), picked from a dropdown.

Light check: UX Designer, Content Manager, Software Engineer, Product Owner, and the consultant (flow
and accessibility); then a follow-up with the consultant. Screens in
docs/design-reviews/2026-11-08-start-from-previous/.

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Choosing in the dropdown reloaded the page at once: keyboard users on Windows land on the first contest; typed details replaced | 3 | Owner: dropdown + button | Choosing changes nothing; "Use this contest" fills in the form. Anything typed since the form was filled in is named in a confirm before it's replaced; the date always stays |
| 2 | Typed times, time zone, and venue name could still be replaced without asking (follow-up) | 3 | Within the owner's decision (keep what's typed) | Every field checked against what was last filled in |
| — | Phone cuts off the date in the dropdown | 2 | Take the advice | Date first in each option; the chosen contest's name, date, and venue wrap below |
| — | Copied name matches the old contest | 2 | Take the advice | Hint under the name: add the year if it helps |
| — | Moved or dropped registration dates not explained | 2 | Take the advice | The Registration note lists each: moved to (date), or blank because it would be in the past |
| — | "Pick the new date" far from the date | 2 | Take the advice | Cursor goes to the date, with "(contest) was (date)" under it, and a screen-reader announcement |
| — | Note wording (jobs "below", "this year", "came over") | 2 | Take the advice | "Copied from your (date) contest"; jobs and check-in stops counted separately, on the Volunteers step |
| — | Comes over / Starts fresh lists incomplete | 2 | Take the advice | Adds ready times and equipment spots; files and maps, email reply settings, and who gets notified start fresh. Lists show as soon as a contest is chosen |
| — | Copied fee, payment link, and meal price marked ready unchecked | 2 | Take the advice | The note names them to check |
| — | Shifts keep last time's hours | 2 | Fix it differently | The note counts shifts outside the new contest's hours and links to the Volunteers step (jobs stay "details saved") |
| — | A failed copy can't be retried | 2 | Take the advice | "Try copying again", which asks first since it replaces registration settings |
| — | No way back after the wrong pick | 2 | Take the advice | "Picked the wrong contest? Start over" deletes the new draft (no bands, not published) after asking, keeping the date |
| — | Missing security tests | 1 | Take the advice | Two accounts, a non-band event, and a deadline landing in the past |
| — | Drafts never set up are listed | 1 | Take the advice | Hidden |
| — | Screen-reader and busy states on the button | 2 | Take the advice | Live region for "Filling in…" and the result; the button stays focusable while busy |
| — | Mock data shows the same date for both contests | 1 | Keep as is | Screenshot data only |
