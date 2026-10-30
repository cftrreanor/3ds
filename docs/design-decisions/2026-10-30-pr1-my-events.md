# Decisions: My events and the new-event picker, built pages (2026-10-30)

Review: docs/design-reviews/2026-10-30-pr1-my-events.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Three names for what ended ("free period", "plan has ended", "Free during the pilot") | 3 | Fix it differently | One sentence for what ended, from one source, used in the My events notice and the picker. Keep "Free during the pilot" on the conference card |
| 2 | Try-it events can still email outsiders (announcements, file sharing) | 3 | Take the advice | One rule in the shared email sender: a try-it event emails nobody outside the account; team invitations still go; if the check fails, nothing is sent. Setup note says "it won't email anyone outside your team" |
| Severity 2 findings | Wording, phone picker, conferences first after a plan ends, reaching the Account Host, database and speed fixes, tests | 2 | Take the advice | All fixed in this PR; one-line polish items too |
