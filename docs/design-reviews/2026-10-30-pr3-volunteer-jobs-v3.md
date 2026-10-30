# Design review: volunteer jobs, third round (built pages, light check)

| | |
|---|---|
| **What was reviewed** | The simplified volunteer jobs page (no Hidden/Showing, autosave, pinned bar with Delete job and Add another job, import under More options), the publish step, the live event page, and the shared folder tabs on the public sign-up page and check-in desk. 13 screens, 78 screenshots (`2026-10-30-pr3-volunteer-jobs-v3/`) |
| **Stage** | Screenshots of built pages, before the PR |
| **Size** | Light check: Product Manager, UX Designer, UI Designer, Software Engineer, UX Content Manager, and the consultant |
| **Coverage** | UI Designer and consultant: all 78. Others: every screen at phone and desktop in light, plus one dark shot each |
| **Date** | 2026-10-30 |
| **Not reviewed** | Name-only drafts and autosave on Details, Start from a past event, moving or removing people, the setup checklist panel, renames |

## The consultant's verdict

**Ship after fixes.** "The setup flow works: three steps, jobs that save themselves, a clear When you publish list, and a published-event banner that explains why there's no draft. Trust breaks at the publish moment." The one change that would help most: name any job volunteers won't see, and why, on the publish card and the live event page.

## Blocks people (severity 3)

1. **"Everything is set up" while a job is missing from the sign-up page** (6 of 6). A job with no shift or thing to bring never reaches volunteers, but the publish card, the steps bar, and "Setup complete" say all is well. Fix: name each such job with a link ("Litter pickup won't show on the sign-up page until it has a shift"), and only say "everything is set up" when every job is ready.
2. **Edits can be lost** (Software Engineer, UX Designer). A dropped connection during autosave shows the error page; the last change is dropped when leaving by "+ Add a job", the steps bar, Back, or the browser; an item or shift typed but not added is dropped without a word. Fix: show "Not saved, try again" instead of the error page; save at once when a field or the page is left; warn about a typed-but-not-added item or shift.
3. **Old check-in places still show to volunteers** (Software Engineer). Jobs keep the place saved before the field was removed, and the public page shows it, but organizers can't see or change it.
4. **Dark mode checkboxes and radios look checked** (UI Designer). Fix: tell the browser the page is dark (`color-scheme`) and use the brand color for controls.
5. **Phone: things-to-bring names cut to a few letters** (4 of 6). Fix: stack each row on phones, with a labelled "Needed" box.
6. **Faded buttons that still work can't be read** (consultant). "Add job", "Create shifts", "Review and confirm". Fix: full-contrast labels with a hint saying what's missing.
7. **The publish blocker says "Add a job" when jobs exist** (Content Manager; 5 of 6 in total). Fix: "Add a shift or a thing to bring to a job first", linking to the first job that needs one, placed first in the card.
8. **The pinned bar's strongest button is "Add another job" while this job still needs a shift** (consultant; 4 of 6 in total). This touches the owner's choice of Delete job and Add another job as the bar's main buttons.

## Should fix (severity 2)

- Delete offered on a shift or job with people signed up, refused after the confirm (6 of 6)
- ✓ on a job tab next to "0 of 8 filled" reads as done (5 of 6)
- The add-a-job form and the job editor ask the same question differently (5 of 6)
- "Spots" adds people and things to bring together (4 of 6)
- Every failed save says "Check the job name" (3 of 6)
- Shift rows are titled "Shift"; the time should lead; "Edit shift" doesn't look tappable (4 of 6)
- Public sign-up: tabs hide jobs on desktop when there are only three (3 of 6)
- Steps bar: "Last" is not a status; step 1 has no "Next up"; "Event Settings" vs "Details" (3 of 6)
- "Manage volunteers" opens "Volunteer jobs"; page names drift (3 of 6)
- Import: unclear which jobs it fills and what "a full shift makes room" means (3 of 6)
- Folder tabs: open tab not joined to the panel; phone rows scroll with no cue (UI, consultant)
- Live status card buttons are 36px with 12px text; Close volunteer sign-up sits with routine buttons (UI)
- Autosave sends every field and rebuilds the page each time; half-typed text goes live on a published event (Software Engineer)
- "Who's signed up" sits below the daily summary card (PM, UX)
- Wording: "Not yet", the phone-number promise on the public page, the privacy note's "under-18 helpers are deleted", potluck help text (Content Manager)

## Polish (severity 1)

Title Case buttons, "Coordinator" mid-sentence, hyphen break in titles, "IT EM" header gap, light progress track, Event day card on an unpublishable draft, the check-in desk has no things-to-bring tab.

## What's working well

- The three-step bar and plain step notes ("Add a shift")
- Autosave states ("Saving…", "Saved") and the leave warning
- The "When you publish" list and the two publish choices
- The published-event banner that says changes go live
- The job type lock with its reason; "Fill the day with shifts"
- The folder tabs, with words beside every mark, on every page
- The public page on phones (stacked jobs, large rows)
- The database enforces the hard rules

## Limits

This is an AI review of screenshots with sample data, not testing with real people. Before volunteer events go to real accounts, have two or three organizers set up a job and publish.
