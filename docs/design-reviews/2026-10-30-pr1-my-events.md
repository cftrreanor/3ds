# Design review: My events and the new-event picker (built pages, light check)

| | |
|---|---|
| **What was reviewed** | Built pages for build piece 1: My events draft cards, the plan-ended notice (Account Host and Co-host), the New event picker (window and page, folded and open, active and ended plan), and the "You're trying…" setup note. 8 changed screens plus 1 unchanged neighbor (`2026-10-30-pr1-my-events/`, 54 screenshots) |
| **Stage** | Screenshots of built pages, before the PR |
| **Size** | Light check: Product Manager, UX Designer, UI Designer, Software Engineer, UX Content Manager, and the consultant |
| **Coverage** | UI Designer and consultant: all 54. Others: 27 each (every screen at phone and desktop, plus one dark shot per screen) |
| **Date** | 2026-10-30 |

## The consultant's verdict

**Ship after fixes.** "The structure is sound. The fixes are wording plus one sticky header and a focus ring." The one change that would help most: name what ended the same way everywhere, and drop "Free during the pilot" once the free period is over.

## Blocks people (severity 3)

### 1. Three names for what ended, and a "free" claim that contradicts the notice · 4 of 6
- **What happens:** On one account at one moment, My events says "Your free period ended", the New event window says "Your Volunteer Command plan has ended", and the conference card still says "Free during the pilot". Readers can't tell what they're on, or whether conferences are still free.
- **Fix:** One sentence for what ended, from one source, in both places ("Your free pilot ended Oct 15" or "Your Volunteer Command plan ended Oct 15"). Remove "Free during the pilot" from the in-app conference card.
- **Engineer's catch:** a Free (teacher) account whose free period ends gets the amber "Without a plan…" notice even though nothing changes for it. Skip the notice for the Free package.

### 2. "Try it" events can still email people outside the account · Software Engineer (checked in code)
- **What happens:** Band invitations and import emails are blocked, but an organizer can import volunteers onto a try-it event (no email) and then reach them through an emergency announcement or a "share a file" notice. Neither checks for try-it events. If the try-it check itself fails, import emails go out.
- **Fix:** Enforce the rule in one place: the shared email sender refuses event emails to anyone outside the account when the event is a try-it event (team invitations allowed), and refuses when the check fails. Add a test.
- **Also:** the setup note should say who is held back: "it won't email anyone outside your team".

## Should fix (severity 2)

- **The notice doesn't say the conference slot is taken** (4 of 6): add "Fall Conferences is using it until Nov 12" when it is. Reuse the picker's sentence.
- **"Publishing needs a plan" on an account that has one** (4 of 6): when the active plan doesn't include the kind, say "Your plan doesn't include school fairs" (or "Publishing needs a plan with school fairs"). In the picker, use the same amber style as on the cards.
- **"1 of 3 needed to publish" is unclear** (4 of 6): "2 steps left to publish".
- **Phone picker** (4 of 6): "Interested in more?" sits below the fold, and the title and close button scroll away. Make the header sticky and the phone cards more compact.
- **After a plan ends, the one kind they can publish is buried** (3 of 6): put conferences first, with a positive note.
- **Co-host can't reach the Account Host** (2 of 6): show her email, or add a "Let Dana know" button.
- **Account Host lookup goes around the database's privacy rules** (Engineer): replace with a database function that returns only a display name to account members, with a test. Keep "ask your Account Host" wording when the lookup fails.
- **Try-it rule edges** (Engineer): a published event shouldn't become "try it" after a package change; owner to decide whether an ended plan's own drafts may email outsiders.
- **Dialog counts another account's conference** (Engineer): filter the picker notes to this account.
- **My events gets slower with many drafts** (Engineer): about 15 database calls per draft. Load the progress lines separately or in one call.
- **"One at a time" worked out three ways** (Engineer): one answer from the database; the Account page's "published" count should skip finished events.
- **Changing a published event's kind can let one pass cover two events** (Engineer): only skip pass use when the existing pass is for the same kind.
- **Ready drafts have no "done" look; the renewal button is the faintest control; the try-it note looks like a form card** (UI Designer).
- **Faint keyboard focus on type cards** (consultant): use the standard focus ring.
- **Test gaps** (Engineer): plan-ended publishing, time-zone boundary, downgrade, pass on type change.
- **Fair setup shows a marching-band example name** (5 of 6, severity 1–2): add a fair example.
- **"Try it" tag looks like a status badge and moves around** (3 of 6).

## Polish (severity 1)

Card order by date; "Interested in more? 4 more…" says "more" twice; uneven grid with an odd number of cards; tiny "›" arrow; picker subtitle punctuation; "deleted 30 days after" needs "the visit"; one page with four names (Your events, My events, Events, All events); measures for try-it and "Email us" (Product Manager); dark-mode empty logo box (existing, not from this change).

## What's working well

- Draft cards answer "what's next?" and "can I publish?" in two short lines.
- "Fall Conferences runs until Nov 12. You can set up another now and publish it after that." (named best sentence by three reviewers)
- Different notices for the Account Host and Co-hosts, naming a real person.
- The notice leads with reassurance: published events stay up, and any kind can be set up.
- The picker is honest before any work starts. Nothing is grayed out or locked.
- Publishing stays enforced in the database, including on type changes; finished events don't count, in each event's own time zone.

## Limits

This is an AI review of screenshots with demo data, not testing with real people. Before the plan-ended state matters to real accounts (mid-November), have a PTO president and a teacher read the notice and picker.
