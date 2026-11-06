# Decisions: My team, built pages (2026-11-05)

Review: docs/design-reviews/2026-11-05-my-team-built.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Expired invitation looks live; Copy link hands out a dead link | 3 | Take the advice | Owner said yes on the report page. Expired rows show a "Link expired" badge first, no Copy link, and "Send a new link" first in the row |
| 2 | Resend on an expired invitation gets around the team limit | 3 | Take the advice | Owner said yes on the report page. Resending an expired invitation now needs a free spot (20270115000000_resend_checks_team.sql, with security tests); on a full team the row says "Free a team spot to send a new link" |
| 3 | Nobody is told when a helper leaves | 3 | Take the advice (both) | Owner chose the fuller fix on top of the smallest. Leaving emails the Account Host and the event's other Volunteer Leads, naming the jobs left without anyone; the leave window says so; removing offers "Let them know by email" (ticked to start); Event teams lists jobs left without a Coordinator after someone left or was removed in the last 30 days |
| 4 | "Every role" deletes past-event history | 3 | Take the advice | Owner: "keep the historical". The window sends exactly the roles it lists, and the server never removes roles on events that are over |
| 5 | Someone on two accounts only sees the older one | 3 | Fix it differently | Owner chose option A (fix on My team now) with the accounts as a menu on the left to choose from (above the page on phones). Each account shows its own team; accounts you own come first, then co-host, then event-team accounts. The rest of the app (an account picker everywhere) is a separate project |
| 6 | "Can't see those events anymore" isn't true | 3 | Take the advice (b) | Owner pointed out volunteers' details are deleted 10 days after an event (true), then chose b: people on a past event's team stop seeing it, its team, and their contact details 10 days after it ends (20270117000000_past_helpers_access.sql, with tests); hosts keep everything; the Past events note says so |
| 7 | An edited co-host email can break | 3 | Take the advice | Co-host invitations (now always for the whole account) use general access words; saved wording that names an event falls back to the built-in email; the editor's starting text no longer mentions an event and says "Account Host" |
| 8 | "Ask us about a bigger team" is a bare email link | 3 | Take the advice | The full-team banner names the smallest plan with more spots; the plan note names the plan that includes Volunteer Leads and Coordinators; both link to the plan card on the Account page and show our email address as text. Without event teams on the plan, that one line replaces the explanation and empty box |

## Severity 2

| Finding | Decision | Notes |
|---|---|---|
| The windows don't match | Take the advice | One window for every confirm on My team: question as title, bullets, an outlined way out naming what you keep, red for taking access away, a team-spot line on every removal |
| Coordinator's page leads with Leave | Take the advice | Rows show the jobs they lead; the leave window names them and says who's told |
| Invite again: no job, no role, event picked for you | Fix it differently | Owner didn't like it; agreed fuller window: name, last time, "Choose an event" with dates, role, job (same-name job picked), team-spot line |
| Send invitation looks switched off | Take the advice | Short windows' main button stays filled (data-solid); the dashed "not ready" look stays elsewhere |
| Buttons vanish without a reason | Take the advice | Each says why ("Free a team spot to invite again", "Not on your plan", "Only the Account Host invites co-hosts"); Volunteer Leads see a full team first (team_is_full(), with tests) |
| The spot count doesn't say what counts | Fix it differently | Owner: the old words contradicted "invitations count". One rule: an invitation takes a spot as soon as it's sent; the count says it includes you; the database message matches |
| Plan without event teams explains, then denies | Take the advice | One line naming the plan that includes them (done with decision 8) |
| Screen readers can't tell row buttons apart | Take the advice | Spoken names start with the visible words, then whose row |
| Messages point to a "Pending" list | Take the advice | "on their invitation"; removing a co-host who's already gone says so |
| Button outlines nearly invisible | Take the advice | Secondary buttons use the field-border color (3:1+) app-wide |
| No database-update page; failed loads look empty | Take the advice | missing() when the update hasn't run; the error page otherwise |
| Privacy note not quite true; Account Host lookup outside the database | Take the advice | Note says what's true; account_contacts() with tests |
| The 11 single-reviewer items | Take the advice | Event buttons with dates; one name per place; "Account Host and co-hosts" in notes; one-event hint in Invite a co-host; focus to the section heading after removing; past year only and map lookups; Volunteer Lead security tests; full team can promote someone already on it; co-host sentence and invitation wording; wrapping and dates on one line; remaining states in the light check |
| Windows blend into the page in dark mode | _Not yet decided_ | |
| Co-host sentence vague; invitation sells rules | Take the advice | Covered by the 11 above |
| Polish (severity 1) | _Not yet decided_ | |

## Light check (docs/design-reviews/2026-11-05-my-team-light-check.md)

| Finding | Severity | Decision | Notes |
|---|---|---|---|
| Full team: Invite a co-host asks for an email instead of picking someone | 3 | Take the advice | Owner: pick from a list. On a full team the button becomes "Make someone a co-host", listing Volunteer Leads, Coordinators, and open invitations by name and role |
| Removal email says "off the team" when they keep a role | 3 | Fixed (bug) | Names what was actually removed and what they still are |
| Rows crushed on tablets with the accounts menu | 3 | Fixed (bug) | Rows lay out by the card's width |
| Past Volunteer Leads still saw volunteer history | 3 | Fixed (part of decision 6) | Same 10-day cut-off, with tests; past roles can't be left |
| Full team: blocked actions still offered to Volunteer Leads and in the no-Coordinator note | 2 | Fixed (bug) | |
| Unlimited plans mention team spots | 2 | Fixed (bug) | |
| Lead and event-team loads fail as empty pages | 2 | Fixed (project rule) | |
| Removing someone doesn't tell the event's Volunteer Lead | 2 | Take the advice | Removal emails the event's other Volunteer Leads, and the Account Host when someone else removed them |
| Coordinators can't see their Volunteer Lead | 2 | Take the advice | Name and email (no phone) via event_volunteer_leads(), with tests; the Account Host second; the privacy note says so |
| Dark-mode windows, faint radios, remove window defaults to "every role", calm "Link expired" | 2 | Take the advice | Raised window color and darker backdrop in dark mode; drawn radios; nothing picked to start; warning badge for expired |
| Wording leftovers and the accounts menu | 1-2 | Take the advice | "Removed or left recently"; co-host email editor text; "canceled"; bullet periods; real role in the menu; a label, not a heading; one-line Switch on phones |
| Full team shows blocked actions three ways | 2 | Partly done | Blocked actions now say why in place; making someone on a full team a co-host still works as a button, on purpose |
| Leave window's "Volunteer Leads" when there's only one, and other polish (Feedback tab overlap, "led" and "leads") | 1 | Later | Logged, not in this PR |
