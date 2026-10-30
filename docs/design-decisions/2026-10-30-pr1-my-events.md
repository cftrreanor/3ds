# Decisions: My events and the new-event picker, built pages (2026-10-30)

Review: docs/design-reviews/2026-10-30-pr1-my-events.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Three names for what ended ("free period", "plan has ended", "Free during the pilot") | 3 | Fix it differently | One sentence for what ended, from one source, used in the My events notice and the picker. Keep "Free during the pilot" on the conference card |
| 2 | Try-it events can still email outsiders (announcements, file sharing) | 3 | Take the advice | One rule in the shared email sender: a try-it event emails nobody outside the account; team invitations still go; if the check fails, nothing is sent. Setup note says "it won't email anyone outside your team" |
| Severity 2 findings | Wording, phone picker, conferences first after a plan ends, reaching the Account Host, database and speed fixes, tests | 2 | Take the advice | All fixed in this PR; one-line polish items too |

## Follow-up light check (owner, 2026-10-30)

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| A | A "try it" draft on an active plan has no way to ask for a plan | 3 | Take the advice | Same as the plan-ended notice: the Account Host gets "Email us about a plan" (the subject names the kind), anyone else gets "Email <Account Host>, your Account Host, about a plan". On the "You're trying…" note and under the lock line on draft cards |
| B | Unpublishing after a plan ends can't be undone, but the button says "publish again anytime" | 3 | Take the advice | When republishing wouldn't be allowed, the Unpublish panel and confirm box say so. Unpublishing still works |
| C | A failed try-it check holds back email from published events too | 3 | Fix it differently (changes decision 2 above) | Published events always send (they're never try-it events). For drafts, retry once, then hold the email back and log the real reason. Check once per event, not once per person |
| Severity 2 | Wording, picker labels and grouping, phone descriptions, notice length, pass shared by two drafts, Account Host fallback, imported confirmations, tests | 2 | Take the advice | Larger items get the simple version now and a roadmap note |
