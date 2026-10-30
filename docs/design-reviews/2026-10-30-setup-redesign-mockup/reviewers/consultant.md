# Usability consultant (independent)

## Headline
This is a solid redesign. The plan limit is explained up front and honestly. Draft jobs are marked with words, an icon, and a dashed outline, not just color. "When you publish" sets expectations better than most products do, and every text color I measured passes contrast in light and dark. The weak spot is the jobs step (screen 4). It mixes a second job's shifts into the editor, and from there the way forward to publishing is hard to see. There are also a few gaps in user control after publishing, and a dark-mode button style that makes disabled buttons look like the main action.

## Findings

### Jobs editor shows another job's shifts next to the one being edited
- Where: 4 Editing a job, all widths, both modes. On desktop it's the right-hand "Parking" panel. On phone and tablet it's the "Parking" card between the Face painting form and the save bar.
- What happens: you are editing Face painting, and its tab is highlighted. Next to it (desktop) or under it (phone and tablet), a "Parking" card lists two shifts with Edit and Delete. Face painting itself says "No shifts yet." On phone the save bar ("What's left: add a shift", "Save as draft") comes right after the Parking card. People will think those shifts belong to Face painting, or that the save bar saves Parking. They could also delete a Parking shift while thinking about Face painting.
- Who it hurts: the organizer at a laptop (can't trust what they're looking at), the PTO president on a phone in the car line (scrolls past the Parking card and loses her place), and the teacher (no time to work out what it means).
- Standard: Heuristic 1 (visibility of status), 4 (consistency), 8 (minimalist design), and 5 (error prevention, since a Delete sits next to the wrong job)
- Severity: 3
- Suggested fix: show only the selected job in the editor. Put the job's own shifts inside its form, under "Shifts". To see Parking's shifts, you select the Parking tab (or pick it in the phone dropdown). If an overview of all jobs is wanted, make it a separate read-only list with no Edit or Delete.

### No clear way forward from the jobs step to publishing
- Where: 3 Jobs and shifts (empty) and 4 Editing a job, all widths
- What happens: the progress bar says "Step 2 of 3", but no button says "Next" or "Review and publish". The save bar on screen 4 belongs to one job. The only way out is the small "← Cedar Ridge Fall Festival" back link, and nothing says it leads to the publish step (screen 6). Screen 2 had "Save and continue", so people will expect the same here.
- Who it hurts: the teacher with a 30-minute lunch (she needs to finish in one sitting and can't hunt for the exit) and the organizer who sets up one event a year
- Standard: Heuristic 1, 3 (user control), 6 (recognition rather than recall), and "Action over information"
- Severity: 3
- Suggested fix: add a "Continue to publish" button to the jobs page, outside each job's form (for example under the job tabs, or as a second line in the save bar once at least one job is ready). Make the third step in the progress bar a link too. On screen 3 (empty), keep it but have it say why it's disabled ("Add a job first").

### After publishing, the promised "unpublish" and the settings disappear
- Where: 7 Event page, just published, all widths and modes. The same happens on 8 (Event settings is missing there too).
- What happens: screen 6 promises "You can keep editing, and unpublish at any time" and "nobody can sign up until you open it". On the live page there's no Unpublish, no Close sign-up, and no Event settings button. The "Before the day" panel (Invite your team, maps, daily email) is also gone. The location line drops off the header too.
- Who it hurts: the organizer who published by mistake, or before the details were right. They will panic. It also hurts the PTO president, who comes back later to invite her team and can't find where that went.
- Standard: Heuristic 3 (user control and freedom), 4 (consistency between screens 6 and 7), and 5
- Severity: 3
- Suggested fix: keep the same page layout before and after publishing. Keep "Event settings" in the header, keep "Before the day" as a side panel (or below on phone), and add a small "Sign-up open · Close sign-up" or "Unpublish" control near the Live badge. The words should match the promise on screen 6.

### Disabled buttons look like the main action in dark mode
- Where: 4 "Save and mark ready" (desktop, tablet, and phone, dark) and 8 "Publish and open sign-up" (all widths, dark)
- What happens: in light mode, disabled buttons are pale and clearly off. In dark mode the disabled button has near-white text (about 11:1 against its background). That's brighter than the enabled "Save as draft" next to it (pale blue). The button you can't use looks like the strongest choice on screen. On screen 8 it looks like a working Publish button.
- Who it hurts: the organizer and the PTO president on a phone at night in dark mode. They tap it, nothing happens, and they don't know why.
- Standard: Heuristic 1 and 4 (status shown the same way in both modes). This isn't a WCAG failure, because disabled controls are exempt, but it's a real status problem.
- Severity: 2 (dark only)
- Suggested fix: give disabled buttons in dark mode muted text (around 3:1 to 4:1 against the button background) and no border emphasis, so they match how disabled buttons look in light mode. Keep the reason line ("What's left: add a shift") next to it. Better still, keep the button enabled and have it explain what's missing when tapped.

### Done and current steps are shown by color alone on phone
- Where: progress bar on 3, 4, 6, and 8 at phone width (390 px), both modes
- What happens: at tablet and desktop, each step has a word ("done", "now", "needs a plan"). On phone those words are dropped. "Done" and "current" then differ only by bar color (green or navy, and in dark mode green or light blue). The empty bar is about 1.3:1 against white, so it is close to invisible.
- Who it hurts: the volunteer and the PTO president on a phone in bright sun, and anyone with color-blindness
- Standard: WCAG 1.4.1 (use of color) and 1.4.11 (non-text contrast)
- Severity: 2 (phone only)
- Suggested fix: keep the status words on phone. There is room if each label is set as two short lines ("Details" over "Done"), or use a check icon for done steps. Give empty bars a 3:1 outline.

### Two different meanings of "Draft" on the same screens
- Where: 3, 4, and 6. The event pill says "Draft: only your team can see this event". The job badge says "Draft: volunteers can't see this job". Badges say "Draft · hidden", "Draft · needs a shift", and in preview "Draft · volunteers won't see this".
- What happens: the event is a draft, and some jobs are drafts. When the event is published, draft jobs stay hidden. "Draft" now means two different things, and the badge wording changes from screen to screen. The organizer can't easily tell "my event isn't out yet" from "this one job isn't out yet."
- Who it hurts: the organizer at a laptop, who needs to trust what people will see, and the PTO president, who handed a job to a lead and needs to know whether it's live
- Standard: Content clarity ("same thing, same word") and Heuristic 4
- Severity: 2
- Suggested fix: keep "Draft" for the event only (or the reverse) and call a job that isn't ready "Hidden" or "Not ready". Use one badge wording everywhere, for example "Hidden · needs a shift" and "Hidden · not marked ready", with the same wording in the editor tabs and in preview.

### Money words don't line up: "free period", "free during the pilot", and "plan"
- Where: 1 Type picker (notice and Parent-teacher conferences card), and 8 Blocked
- What happens: the notice says "Your free period ended Oct 20". The card right below says "Free during the pilot". Read together, they seem to contradict each other. "Plan" is never explained, and nothing says who can add one. On phone, the header has no "Account" link, so there's no visible place to add a plan.
- Who it hurts: the organizer and the PTO president, who will wonder whether they are about to be charged. It also hurts a Host or Co-host who isn't the Account Host and can't add a plan anyway.
- Standard: Content clarity (plain words, same thing, same word), Heuristic 2 and 10, and the claims guardrails (be specific and honest)
- Severity: 2
- Suggested fix: pick one phrase, for example "Conferences stay free: one published at a time". On screen 8, add who can act: "Your Account Host can add a plan" with an "Ask them" link for anyone who isn't the Account Host. Rename "See what's included" to "See plans". Restore "Account" in the phone header (it is in the tablet and desktop headers).

### Publish button doesn't reflect the "Keep sign-up closed" checkbox
- Where: 6 Ready to publish, all widths
- What happens: the button reads "Publish and open sign-up" next to a checkbox that says the opposite ("Keep sign-up closed for now"). The mock-up doesn't show what happens when it's checked. If the label stays the same, the organizer won't trust the result.
- Who it hurts: the organizer and the band director, who want proof of exactly what will happen
- Standard: Content clarity (buttons say what happens) and Heuristic 1
- Severity: 2
- Suggested fix: change the button label live: "Publish and open sign-up" when unchecked, and "Publish with sign-up closed" when checked. Use two radio choices instead of a checkbox to make the choice explicit. Also, "Preview as a volunteer" shows draft jobs that volunteers won't see. Rename it "Preview sign-up page".

### Lead preview rules aren't shown
- Where: 5 Preview (only the Host view is shown) and the banner on 4 ("You and its lead can preview it")
- What happens: the preview shows every draft job outlined. The rule says only Hosts and that job's lead can preview a draft. The mock-up doesn't show what Maria (the Face painting lead) sees. Does she also see the Bake sale items draft? If so, that breaks the rule.
- Who it hurts: the PTO president handing jobs to other parents, and trust in the privacy rule
- Standard: Heuristic 1 and 5. This also carries out a fixed product rule.
- Severity: 2
- Suggested fix: add a lead's version of screen 5. It shows only that lead's own draft job, with banner text such as "Preview only. Only you and the event's Hosts can see Face painting." Make the preview banner stay pinned at the top while scrolling, and make it shorter on phone (one line plus Close).

### "Save and continue" on Details looks ready while two required boxes are empty
- Where: 2 Details, all widths
- What happens: the save bar says "2 boxes left: Starts and Ends", but "Save and continue" looks fully active. On screen 4, the same situation shows a disabled button. It isn't clear whether tapping it saves what's done, shows errors, or refuses. In dark mode, the placeholder "Pick a time" is nearly the same brightness as entered values, so empty boxes look filled.
- Who it hurts: the PTO president, who starts in the car line and needs a partial save, and the teacher, who might not have the times on hand
- Standard: Heuristic 4 and 5, "Interruption-proof", and WCAG 3.3.1 (errors identified next to the field)
- Severity: 2 (the placeholder problem is dark only)
- Suggested fix: let the button save partial work and move on. Keep "Starts and Ends" on the publish checklist instead of blocking here. Or, if it must block, show an error next to each empty field on tap and move focus to the first one. Dim the dark-mode placeholders, or show them in italics.

### Small and crowded tap targets on phone
- Where: 4 at phone width. The "×" to remove a lead on the "Maria Lopez" chip is about 10 px. The two save-bar buttons wrap onto two lines each. The Edit and Delete layout differs between the first and second shift. On 6 at phone width, the checkbox is about 14 px.
- What happens: the "×" is below the 24 px minimum. Pinned to the bottom of the screen, the two-line save bar takes up roughly 110 px of an 844 px screen, and more with the keyboard open, so it can cover the field in focus.
- Who it hurts: the PTO president one-handed in the car line, and the volunteer parent if leads manage jobs from phones
- Standard: WCAG 2.5.8 (target size) and 2.4.11 (focus not hidden)
- Severity: 2 (phone only)
- Suggested fix: make the whole chip a 44 px target, with a "Remove Maria Lopez" label for screen readers. On phone, stack the save-bar buttons full width with one line each ("Save draft" / "Mark ready"), or show a single primary button with the other as a link. Make sure the page scrolls the focused field above the pinned bar. Put Edit and Delete in the same spot on every shift row. Make the whole checkbox row tappable.

### Picker "publish with a plan" badge overflows the card on desktop
- Where: 1 Type picker, desktop 1440 px, light and dark
- What happens: in a four-column layout, the "Set up now, publish with a plan" badge runs past the card edges. On Volunteer event it is cut off ("publish with a plar"). Only the Volunteer card shows a lock icon. The selected-looking border on Parent-teacher conferences reads as "already chosen", but nothing tells you how to choose a card.
- Who it hurts: the organizer at a laptop. It looks broken, and it will get worse at 200% zoom.
- Standard: WCAG 1.4.10 (reflow), Heuristic 4, and 8
- Severity: 2 (desktop only for the overflow)
- Suggested fix: use a shorter badge ("Needs a plan to publish") that wraps inside the card, and use the lock icon on all three or none. Either drop the highlighted border or make each card clearly a button ("Set up conferences →").

### Small wording fixes
- Where: 7 "Finish it" link. 6 Event day card "Nov 13". 8 "Ready when your plan is". Sample data: 4 shows "2 of 4 spots filled" before publishing, while 7 shows "0 of 24".
- What happens: the link text alone doesn't say what it finishes. "Nov 13" on its own doesn't say what happens that day. "Ready when your plan is" is a little cute and vague. The counts contradict each other, which will confuse whoever builds from this.
- Who it hurts: organizer (scanning, screen-reader link lists)
- Standard: Content clarity (buttons and links say what happens), WCAG 2.4.4 (link purpose)
- Severity: 1
- Suggested fix: "Finish Bake sale items". "Opens Nov 13, 6 PM". "Ready to publish once you add a plan". Make the sample counts consistent.

## Working well
- The type picker tells an expired account the truth up front, before any work is done. "Set up now, publish with a plan" and "Everything you set up here is saved" on screen 8 respect the organizer's time.
- Draft jobs are marked three ways: an icon, words, and a dashed outline. Status is never shown by color alone, and the "Preview only" banner makes the preview hard to mistake for the real page.
- "When you publish" (screen 6), especially "Nobody is emailed. People find out when you share the link". That is exactly the reassurance the organizer needs.
- Disabled actions explain themselves ("What's left: add a shift", "2 boxes left: Starts and Ends").
- "Shifts with people in them can't be deleted" prevents a damaging mistake. "Leads see who signed up… phone numbers" is an honest privacy note at the right moment.
- "Start from a past event / Copy jobs" serves the PTO president who reuses last year's event.
- Text contrast passes everywhere I measured, in both modes: secondary gray is 6.6:1, green status is 4.8–5.4:1, draft badges are 6.6:1, and dark-mode text is 7.6–12.5:1. Input borders reach 5.3:1 (light) and 3.9:1 (dark). There are no exclamation points, the Oxford comma is used, and "sign-up" and "sign up" are used correctly.
- The empty jobs state explains what a job is with real examples and gives the first action.

## Verdict
Build after fixes. The structure is right: pick a type, enter details, add jobs, then publish, with honest plan messaging and a clear preview. Three problems would cause real failures in use: the jobs editor shows another job's shifts beside the one being edited, the jobs step has no visible way forward to publishing, and the live page drops the unpublish and settings controls that screen 6 promised. The one change that would help most is to rebuild screen 4 so it shows only the selected job, with that job's shifts inside its form, and add a clear "Continue to publish" button.

Screenshots opened: 1-picker phone, phone-dark, tablet, tablet-dark, desktop, desktop-dark; 2-details phone, phone-dark, tablet, desktop (plus desktop-dark pixel-sampled); 3-jobs-empty phone, tablet-dark, desktop (plus desktop and tablet-dark pixel-sampled); 4-job-edit phone, phone-dark, tablet, desktop, desktop-dark; 5-preview phone, phone-dark, tablet, desktop; 6-ready phone, phone-dark, tablet, desktop (plus desktop-dark pixel-sampled); 7-live phone, phone-dark, tablet, desktop; 8-blocked phone, phone-dark, tablet-dark, desktop.
