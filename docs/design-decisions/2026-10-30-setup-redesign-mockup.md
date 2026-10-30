# Decisions: setup redesign mock-up (2026-10-30)

Review: docs/design-reviews/2026-10-30-setup-redesign-mockup.md

Owner decided 1, 2, and 10 on 2026-10-30. Conference rule clarified: after the pilot, an account without a plan can publish one one-time conference at a time (not weekly recurring); during the pilot, every account has the full Schedule Command package. Finding 6 is still open. Findings 3, 4, 5, 6, 8, and 9 are mock-up fixes Claude will make in version 2 unless the owner says otherwise.

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Plan words promise what the product can't do | 3 | Fix it differently (later) | Not decided yet: owner is focused on pilot users. Logged as a critical item to decide by mid-November 2026 (docs/ROADMAP.md, Next 0). Until then, honest placeholder wording: "write to us", no "as soon as", no self-serve promise |
| 2 | Hidden draft jobs need a database rule and a preview mode | 3 | Take the advice | Database rule plus preview mode. Previews: Hosts, Co-hosts, Volunteer Leads (the app's name for the database's volunteer_director role), and that job's own Coordinator |
| 3 | Job editor shows another job's shifts | 3 | | Mock-up error; fix in v2 |
| 4 | No way forward from jobs to publish | 3 | | Fix in v2 |
| 5 | Disabled buttons look usable in dark mode | 3 | | Fix in v2 |
| 6 | "Keep sign-up closed" doesn't change the button | 3 | | Needs: keep at publish or move to Event settings |
| 7 | Live page drops Unpublish and settings; unpublish can be one-way | 3 | | Fix in v2 with the republish warning |
| 8 | Phone: color-only steps, missing Account, small targets | 3 | | Fix in v2 |
| 9 | Empty time boxes look filled in dark | 3 | | Fix in v2 |
| 10 | Ready job back to draft after sign-ups | 3 | Take the advice, adjusted | Blocked while anyone is signed up. Spots can still be raised or lowered, never below the number signed up |
| 11 | Missing states and sub-flows | 3 | | Design in v2 |
