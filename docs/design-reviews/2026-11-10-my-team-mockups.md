# Design review: My team (mock-ups, full panel)

**Date:** 2026-11-10 · **Size:** full panel (new page) · **Reviewers:** Product Manager, Product Owner,
UX Designer, UI Designer, Software Engineer, UX Content Manager, Marketing Manager, usability consultant
· **Mock-ups:** `docs/design-reviews/2026-11-10-my-team-mockups/` (8 screens, phone, tablet, desktop,
light and dark)

This is an AI review of static mock-ups, not testing with real people. Before launch, have two or three
Account Hosts (one a PTO president on a phone) remove a helper and hand the account on.

## What blocks people (severity 3)
1. **The team-spot count contradicts itself** (8 of 8). Screens disagree on whether invitations and the
   Account Host take a spot. Owner: invitations hold a spot.
2. **A removed co-host keeps their job leads** (Software Engineer). Today, removing a co-host leaves
   them leading jobs, which on event day still shows volunteers' names and phone numbers, minors
   included. Bug in the current app; fixed with this build.
3. **The removal ladder isn't in the database** (Software Engineer). Any co-host can remove or invite
   co-hosts by going around the page. Fixed in the database, with security tests.
4. **Volunteer Leads and Coordinators can't leave** (PO, plus 5 others at 2). Owner: everyone gets My team,
   with a way to leave.
5. **Helpers from past events hold spots** (PM, plus 3 others at 2). Owner: they stop counting after the
   event.
6. **Dark-mode Remove button unreadable** (consultant, UI Designer; 2.28:1). Dark text on the salmon fill.
7. **Phone menu drops Account and Volunteer tracking** (UX, consultant). My team goes in the phone menu.

## Severity 2 (all taken)
- "Cancel" means two things (5 of 8): "Cancel invitation" on rows
- "Contest" and "event" mixed (5 of 8): "event" throughout
- Remove windows don't name roles left empty (5 of 8): they list each
- No undo; "Removed recently" undesigned (5 of 8): Undo after removing; the list opens with Invite again
- Too many red buttons, Remove in two places (UX, UI): one quiet "Remove…" per person; red only to confirm
- Full team still offers adding helpers (5 of 8): one message everywhere invites happen
- "See plans" links to a page we don't have (Marketing): "Ask us about a bigger team"
- Co-host powers described three ways (PM, PO, Marketing): one sentence everywhere
- Co-host invitations are tied to one event (Software Engineer): account-level invitations
- No way to hand on the Account Host role (consultant): owner, add it now

## What's working well
- One page for "who has access", split into Hosts and Event teams; each person once with every role
- Confirm windows name the person, role, and event; "Keep Marcus", "Remove from 2 events"
- Honest notes: access goes right away, no email
- Each role's view hides what it can't do and says who can
- The empty state explains the three roles in plain words

Decisions: `docs/design-decisions/2026-11-10-my-team.md`.
