# Design review: start a band contest from a previous contest (light check)

**Date:** 2026-11-08 · **Size:** light check · **Reviewers:** UX Designer, UX Content Manager, Software
Engineer, Product Owner, usability consultant (flow and accessibility); follow-up by the consultant ·
**Screenshots:** `docs/design-reviews/2026-11-08-start-from-previous/` (phone, tablet, desktop; light and dark)

This is an AI review, not testing with real people. For the two findings rated 3, a quick check with two
or three organizers (one using only a keyboard) would confirm the fix.

## What blocks people
1. **The dropdown acted as soon as something was chosen** (consultant, 3; UX, PO, and engineer raised
   the lost-typing part at 2). Arrowing through it on Windows picks the first contest, and typed details
   were replaced. **Owner decided:** dropdown plus a "Use this contest" button; keep what's typed.
2. **Follow-up: only the name and address were protected** (consultant, 3). Fixed: every field is
   checked, and the confirm names what would be replaced.

## Severity 2 (all fixed; see the decision log)
- Phone cuts off the date that tells same-named contests apart (5 of 5)
- Moved or dropped registration dates not explained (5 of 5)
- Same name as the old contest; old and new look alike (4 of 5)
- "Pick the new date" far from the date field (3 of 5)
- Note wording; incomplete Comes over / Starts fresh lists; copied fee and payment link unchecked;
  shifts outside new hours; no retry after a failed copy; no way back after a wrong pick; screen-reader
  feedback after filling in

## What's working well
- The choice comes first on step 1, only when there's something to copy
- Comes over / Starts fresh sets expectations before anything is saved
- Only the date is left to fill in; nothing private (bands, sign-ups) comes over
- The database checks who can copy: a host of both contests, same account, a new draft

Decisions: `docs/design-decisions/2026-11-08-start-from-previous.md`.
