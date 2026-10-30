# Design review: volunteer jobs, round four (built pages, light check)

| | |
|---|---|
| **What was reviewed** | 13 screens, 78 screenshots (`2026-10-30-pr3-volunteer-jobs-v4/`); fixes retaken in `-v5/` |
| **Size** | Light check: Product Manager, UX Designer, UI Designer, Software Engineer, UX Content Manager, and the consultant |
| **Date** | 2026-10-30 |

## The consultant's verdict

**Ship after fixes.** Give the job bar's "not yet" state one clear meaning that doesn't depend on color.

## Blocks people (severity 3)

1. **A published event hides an unfinished job** (PM, UX, consultant). After publishing, the event page says "Setup complete" and "4 jobs" while Litter pickup has no shift and nobody can sign up for it. *Fixed: the Volunteers card names it with "Add a shift"; setup isn't complete until it's fixed.*
2. **Autosave doesn't cover the whole job** (UX, Software Engineer). Typed things to bring, half-filled shift forms, and an open Edit shift could be lost with no warning while the bar said "Changes save automatically". A failed save jumped the cursor. *Fixed.*
3. **Greyed-out buttons look live in dark mode** (consultant; UI and PM at severity 2). Dark mode's muted text is white. *Fixed with a greyed-out color.*
4. **The phone note's privacy promise** (Content). "Only your Coordinator sees this" wasn't true. *Fixed.*

## Should fix (severity 2)

- The bar's grey "Add another job" disagreed with the working "+ Add a job" (PM, UX, UI, consultant). *Owner: both work; only Next up waits.*
- The note explained what volunteers see, not why the button was grey. *Reworded.*
- "We recommend finishing one more step first" repeated the amber box. *Removed when the box shows.*
- Saving a deleted job said "Saved"; item rows had a form inside a form (SWE). *Fixed.*
- Public "Say what you're bringing" had no box to say it in; "IT EM" header; Copy link too small. *Fixed.*
- Later: folder-tab shape and edge fade on phones, shift-row layout, daily summary placement, wording consistency across pages, the checklist's "needed to publish" count, a 6-job public sign-up screenshot.

## Polish (severity 1)

Step labels' alignment, disclosure styles, badge styles, hyphen breaks, light-mode progress track, empty "0 of 0" numbers, analytics for setup time. Logged in the reviewer notes.

## What's working well

The answer-first job form, "Fill the day with shifts", the "Not ready to publish yet" card, the publish card's "When you publish" list, the live-event banner, Delete job locked with a reason, and status on every tab in words as well as color.

## Limits

An AI review of screenshots with sample data. Before volunteer events reach real accounts, have two or three organizers set up a job and publish.
