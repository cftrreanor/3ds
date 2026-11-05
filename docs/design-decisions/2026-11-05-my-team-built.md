# Decisions: My team, built pages (2026-11-05)

Review: docs/design-reviews/2026-11-05-my-team-built.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Expired invitation looks live; Copy link hands out a dead link | 3 | Take the advice | Owner said yes on the report page. Expired rows show a "Link expired" badge first, no Copy link, and "Send a new link" first in the row |
| 2 | Resend on an expired invitation gets around the team limit | 3 | Take the advice | Owner said yes on the report page. Resending an expired invitation now needs a free spot (20270115000000_resend_checks_team.sql, with security tests); on a full team the row says "Free a team spot to send a new link" |
| 3 | Nobody is told when a helper leaves | 3 | Take the advice (both) | Owner chose the fuller fix on top of the smallest: the leave window names the job and says who's told; Event teams flags jobs with no Coordinator; leaving emails the Account Host and the event's Volunteer Lead; removing offers "Let them know by email". To build next |
| 4 | "Every role" deletes past-event history | 3 | Take the advice | Owner: "keep the historical". The window sends exactly the roles it lists, and the server never removes roles on events that are over |
| 5 | Someone on two accounts only sees the older one | 3 | _Waiting for the owner_ | |
| 6 | "Can't see those events anymore" isn't true | 3 | _Waiting for the owner_ | |
| 7 | An edited co-host email can break | 3 | _Waiting for the owner_ | |
| 8 | "Ask us about a bigger team" is a bare email link | 3 | _Waiting for the owner_ | |

Severity 2 findings are listed in the review report and get their decisions after these.
