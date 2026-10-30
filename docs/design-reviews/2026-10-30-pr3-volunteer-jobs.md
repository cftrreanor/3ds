# Design review: volunteer jobs, setup steps, and folder tabs (built pages, light check)

| | |
|---|---|
| **What was reviewed** | Built pages for build piece 3: the steps bar (Details, Jobs and shifts, Publish), Volunteer jobs (empty, adding, hidden, ready, showing, live with sign-ups), the team's preview, the publish card (ready and no job showing), the live event page, and the shared folder tabs on the public sign-up page and the check-in desk. 13 screens, 78 screenshots (`2026-10-30-pr3-volunteer-jobs/`) |
| **Stage** | Screenshots of built pages, before the PR |
| **Size** | Light check: Product Manager, UX Designer, UI Designer, Software Engineer, UX Content Manager, and the consultant |
| **Coverage** | UI Designer and consultant: all 78. Others: every screen at phone and desktop in light, plus one dark shot each. Screen 03 was first captured by mistake identical to 02 and has since been retaken |
| **Date** | 2026-10-30 |
| **Not reviewed** | Autosave and name-only drafts, Start from a past event, a page to move or remove people, renames, the event page outside the Volunteers and publish cards |

## The consultant's verdict

**Ship after fixes.** "The Showing/Hidden model works: each job says plainly whether volunteers can see it, the one action that changes that is right there, and the dashed preview lets the organizer see what volunteers will get." The one change that would help most: when no job is showing, replace both Publish buttons with "Show a job before you publish" and links to the hidden jobs that are ready.

The rule says a light check with severity 3 findings moves up to a full panel. Whether to do that for the follow-up is the owner's call.

## Blocks people (severity 3)

### 1. Publish buttons work when no job is showing · 6 of 6
- **Where:** event page, publish card, no job showing (screen 09)
- **What happens:** the card says "We recommend finishing one more step" and both publish buttons are full strength, the green one the loudest thing on the page. The database refuses, so the organizer learns the rule from an error after clicking. "Publish and open sign-up" also runs as two steps, so a failure halfway can leave the event live with sign-up closed.
- **Who it hurts:** the organizer at a laptop, the PTO president
- **Standard:** error prevention, action over information
- **Suggested fix:** with no job showing, replace both buttons with "Show a job to volunteers to publish" and a link to each hidden job that's ready. Publish and open sign-up in one database step.

### 2. Totals disagree · 5 of 6 (severity 3 from 3 of them)
- **Where:** live event page (11), jobs page (10), check-in desk (13), publish step (09)
- **What happens:** the event page counts shifts only ("2 of 8"), the jobs page counts shifts and things to bring ("2 of 20"). "2 jobs are hidden" and "3 jobs are hidden" on the same page. "Volunteers signed up 0" next to "2 of 8 filled" and the desk's "0/0 here" come from the sample data, not the app.
- **Who it hurts:** the organizer and the PTO president checking at a glance; the front office
- **Suggested fix:** one shared totals helper (shifts and things to bring, showing jobs only) used everywhere; one hidden-job sentence ("3 jobs are hidden, 2 ready to show")

### 3. "Save for later" next to "Save job" · 5 of 6 (severity 3 from 2)
- **Where:** every job's save bar (04–06, 10)
- **What happens:** "Save for later" saves the same changes (live at once on a published event) and only leaves the job marked unfinished. With Showing/Hidden now its own choice, there are two ideas of "not ready yet", and nothing says how they differ.
- **Suggested fix:** for volunteer jobs, drop "Save for later": Hidden is the way to keep a job private, and "Save job" saves

### 4. "Volunteers can see this job" on a draft · Content Manager
- **Where:** the Showing box, the "Next: publish" card, the message after showing a job
- **What happens:** before publishing, nobody outside the team sees anything, yet three places say volunteers can see the job
- **Suggested fix:** on drafts, "Showing: volunteers will see this job when you publish"

### 5. Changing a volunteer draft to another type leaves its jobs hidden for good · Software Engineer
- **Where:** changing the event type in Event settings
- **What happens:** new volunteer jobs start hidden; other types have no Show button, so those jobs stay hidden, and that event can publish with an empty sign-up page
- **Suggested fix:** when an event stops being a volunteer event, its jobs go back to showing, enforced in the database with a test

## Should fix (severity 2)

- **The job form is long, and Shifts are far down** (UX, PM, consultant; raised by the owner too): on a phone, Shifts sit about 1,700 px below the top; "Add a shift" isn't a link; the privacy note and job definition sit above the tabs every visit. The approved mock-up showed name, check-in place, Coordinator, and Shifts, with the rest further down.
- **"+ Add a job" off-screen on phones** (5 of 6): the tab row scrolls with no hint.
- **Old "sign-up" and "time slot" words on volunteer jobs** (5 of 6): kind-switch notes, leave-without-saving notices, delete errors, tab labels for screen readers.
- **Dead end: "Move or remove them first"** (4 of 6): no way to do that yet. Say where, or link to the sign-up list.
- **Folder tabs in dark mode** (UI): the open tab is quieter than the others (light blue text on a fill close to the rest); the open tab isn't visually joined to its panel.
- **Amber "◆" marks** (UX, UI, SWE, consultant): hidden jobs never get one, and a showing job can get one with no reason given.
- **Faint buttons** (UI, consultant): Add job, Create shifts, Save job, Review and confirm, and "Publish, open sign-up later" read as disabled; text 2.2–3.8:1.
- **Preview** (UX, UI, SWE, consultant): hidden jobs sit below the submit buttons, not where they'll appear; past shifts read "No shifts yet"; on a live event the preview still takes real sign-ups.
- **"Show to volunteers" ignores unsaved edits** (SWE): it shows the job with its last saved details.
- **Other staff screens don't know about Hidden** (SWE): the check-in desk offers walk-ups that will be refused, the Coordinator's page has no Hidden label, the import list offers hidden shifts.
- **Tabs for keyboard and screen readers** (SWE): different semantics per page; arrow keys and labels missing.
- **Page names don't match the steps** (Content): "Details" opens "Event Settings", the browser tab says "Volunteer Setup".
- **Three progress trackers on the event page** (PM, UX): steps bar, checklist, and publish card, and the publish card is far down on step 3.
- **Public sign-up page** (PM, UX, UI): with two jobs, the second hides behind a tab on desktop; phones stack them.
- **Check-in desk wording** (Content): "0 / 0 here", a question as a tab status, "turn on Fri, Feb 5" without "the day before".

## Polish (severity 1)

Steps bar empty segments too faint; shift rows lead with the word "Shift"; Delete in small grey; dashed preview border 2.9:1; locked kind choice hard to read in dark mode; new jobs should start hidden in the database too; speed (repeat queries) and very long job names in tabs; the Content Manager's line-by-line rewrites (reviewer notes).

## What's working well

- The Showing/Hidden box: state, who can preview, and the one next action, with an icon and a word, not color alone
- New jobs start hidden, and the empty state says why
- The dashed preview and its banner
- The publish card's "When you publish" list and the two choices
- The steps bar says where you are in words
- Light-mode folder tabs: readable, with counts on each tab; phones stack the public jobs
- The database is the gatekeeper for every rule, with tests

## Limits

This is an AI review of screenshots with sample data, not testing with real people. Before volunteer events go to real accounts, have two or three organizers set up a job and publish.
