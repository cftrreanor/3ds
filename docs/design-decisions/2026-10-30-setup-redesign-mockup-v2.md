# Decisions: setup redesign mock-up, version 2 (2026-10-30)

Review: docs/design-reviews/2026-10-30-setup-redesign-mockup-v2.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Conference already live: broken screen, risky advice, and finished conferences count toward the limit | 3 | Take the advice | Only conferences that haven't ended count toward "one at a time". Finished ones are in the past and don't block a new one. Never suggest unpublishing a live conference |
| 2 | Plan rules in the design don't match the database (drafts of other types refused) | 3 | Fix it differently | Drafts of every event type are allowed; the plan is checked only at publish. The type picker shows the account's own package types as the main cards. All other types sit in a collapsed "Interested in more?" section that opens on a click, marked as things to try (set up and preview, publishing needs a plan). When a subscription has ended, the main cards say so too |
| 10 | Half-finished details saved only on this device | 3 | Take the advice | Save a draft event to the account as soon as it has a name. Date, times, and address become checklist items needed before publishing, not before saving |
| 3–9, 11–13 | Remaining findings | 2–3 | Take the advice | Fixed in version 3 of the mock-up |
