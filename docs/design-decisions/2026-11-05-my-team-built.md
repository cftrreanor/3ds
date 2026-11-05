# Decisions: My team, built pages (2026-11-05)

Review: docs/design-reviews/2026-11-05-my-team-built.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Expired invitation looks live; Copy link hands out a dead link | 3 | Take the advice | Owner said yes on the report page. Expired rows show a "Link expired" badge first, no Copy link, and "Send a new link" first in the row |
| 2 | Resend on an expired invitation gets around the team limit | 3 | Take the advice | Owner said yes on the report page. Resending an expired invitation now needs a free spot (20270115000000_resend_checks_team.sql, with security tests); on a full team the row says "Free a team spot to send a new link" |
| 3 | Nobody is told when a helper leaves | 3 | Take the advice (both) | Owner chose the fuller fix on top of the smallest: the leave window names the job and says who's told; Event teams flags jobs with no Coordinator; leaving emails the Account Host and the event's Volunteer Lead; removing offers "Let them know by email". To build next |
| 4 | "Every role" deletes past-event history | 3 | Take the advice | Owner: "keep the historical". The window sends exactly the roles it lists, and the server never removes roles on events that are over |
| 5 | Someone on two accounts only sees the older one | 3 | Fix it differently | Owner chose option A (fix on My team now) with the accounts as a menu on the left to choose from (above the page on phones). Each account shows its own team; accounts you own come first, then co-host, then event-team accounts. The rest of the app (an account picker everywhere) is a separate project |
| 6 | "Can't see those events anymore" isn't true | 3 | _Waiting for the owner_ | |
| 7 | An edited co-host email can break | 3 | Take the advice | Co-host invitations (now always for the whole account) use general access words; saved wording that names an event falls back to the built-in email; the editor's starting text no longer mentions an event and says "Account Host" |
| 8 | "Ask us about a bigger team" is a bare email link | 3 | Take the advice | The full-team banner names the smallest plan with more spots; the plan note names the plan that includes Volunteer Leads and Coordinators; both link to the plan card on the Account page and show our email address as text. Without event teams on the plan, that one line replaces the explanation and empty box |

Severity 2 findings are listed in the review report and get their decisions after these.
