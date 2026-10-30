# Usability consultant (independent)

## Headline
This is a calm, honest design. Status is shown almost everywhere, the plan limits are explained without scare tactics, and the "can't hide, can't go below" rules are prevented up front instead of being reported after the fact. What's left to fix is consistency, not structure. Saving works three different ways across the flow. The word "Ready" quietly means "volunteers can see this". Disabled buttons look clickable in dark mode. A chip pushes the page sideways on phones. None of these needs a rethink, but the first two will cause real mistakes for an organizer who only does this once a year.

## Findings

### Saving works three different ways
- Where: 04 details ("We save as you go"), 07 job-edit ("Unsaved changes" plus "Save as hidden" / "Mark ready"), 08 job-items ("All changes saved" banner above a save bar that still offers "Save as hidden"), 18 job-live ("All changes saved · Last saved by Dee Nguyen" while a shift edit with its own "Save shift" button is still open). All widths, both modes.
- What happens: Details save on their own. A job needs one button to add the shift ("Add this shift") and then a second button to save the job. On a published event, the page says "All changes saved" while there is an unsaved edit on screen. After 04 promises "we save as you go", an organizer will reasonably assume that adding a shift in 07 is enough, then close the tab.
- Who it hurts: the organizer at a laptop and the PTO president, who work in short bursts and leave mid-task. They lose work they believe was saved. The teacher on a lunch break is in the same position.
- Standard: Heuristic 1 (visibility of system status), 4 (consistency), and our own "interruption-proof" rule. WCAG 4.1.3 for the status messages.
- Severity: 3
- Suggested fix: Choose one model and use it everywhere. The best fit is the 04 model: save every change on its own, and keep the job's visibility (hidden or shown) as a separate, deliberate choice. If an explicit save has to stay, the status line must count what's still open ("1 shift not added yet"). It must never read "All changes saved" while an inline editor holds changes. Also warn before someone leaves the page with changes that aren't added yet.

### "Ready" really means "volunteers can see this"
- Where: 07, 08, and 18 job chips ("Ready · 2 shifts", "Hidden · ready to mark"), the "Mark ready" button, 12 "Ready to publish", 13 "Next: mark a job ready", 15 "1 job showing" and the "Mark Supplies to bring ready" link. All widths, both modes.
- What happens: "Ready" is used for two things, an event that is ready to publish and a job that volunteers can see. "Hidden · ready to mark" reads like the job is already ready. On a published event (15, 18), "Mark ready" puts the job in front of volunteers at once, but nothing on the button says so. Elsewhere the same state is called "showing". An organizer can easily treat "Mark ready" as ticking a checklist box.
- Who it hurts: the organizer and the PTO president, who could make a half-checked job public by accident. Volunteers then see a job the organizer didn't mean to show.
- Standard: Heuristic 2 (match with the real world) and 4 (consistency). Content rule "same thing, same word" and "buttons say what happens".
- Severity: 3
- Suggested fix: Name the job state after what the volunteer sees: "Hidden" / "Showing". Make the button say what it does: "Show to volunteers" (and "Keep hidden" for the other choice). Reword the chip to "Hidden · can be shown". Keep "Ready to publish" for the event only. On a published event, add "Volunteers will see it right away" next to the button.

### Disabled buttons look active in dark mode
- Where: 07 job-edit "Mark ready", 18 job-live "Hide this job", 21 blocked "Publish". Dark mode, all widths.
- What happens: In light mode these buttons are grey and faded. In dark mode they have bright white text and a visible border, so they look as strong as the working "Save as hidden" next to them, or stronger. The small lock icon is the only clue. People will tap them and nothing will happen.
- Who it hurts: organizers using dark mode at night (often the PTO president, late at night on her phone).
- Standard: Heuristic 4 (consistency) and 5 (error prevention). WCAG 1.4.1 (the state is shown by a small icon only).
- Severity: 3
- Suggested fix: In dark mode, give disabled buttons muted text (about 50% opacity) and no strong border, to match light mode. Keep the lock icon and the reason text below the button. "Hide this job" and "Publish" already have one. Give "Mark ready" one too, such as "Add a shift first".

### The "Draft" chip pushes the page sideways on phones
- Where: 06 jobs-empty, 12 ready, 13 ready-none, 14 ready-vlead, 21 blocked. Phone, both modes. These screenshots render 404 px wide instead of 390 px, and the chip "Draft · Hosts, Co-hosts, and Volunteer Leads only" runs past the right edge.
- What happens: The chip doesn't wrap, so the whole page scrolls sideways a little and the end of the chip is cut off.
- Who it hurts: anyone on a phone. Volunteer Leads and the PTO president are the ones most likely to use these screens on a phone.
- Standard: WCAG 1.4.10 (reflow, no sideways scrolling at 320 px).
- Severity: 2
- Suggested fix: Let the chip wrap, or shorten it to "Draft · only your team can see it" and put the full list in a tooltip or help line. This also fixes a content gap: the chip leaves out the job's Coordinator, who can preview too.

### Badge cut off on the plan-ended picker
- Where: 03 picker-ended, the Parent-teacher conferences card, chip "Fall conferences runs until Feb 12". Desktop, both modes. It fits at tablet and phone widths.
- What happens: The chip runs past the card edge and "12" touches or crosses the border. The wording is also off: "Fall conferences runs" reads as a grammar mistake.
- Who it hurts: the teacher and the organizer, who need that date to know when they can publish another conference.
- Standard: WCAG 1.4.10. Heuristic 8.
- Severity: 2
- Suggested fix: Let the chip wrap within the card. Reword it to "Fall conferences: on until Feb 12" or "Your Fall conferences end Feb 12". In the banner, change "publish one one-time parent-teacher conference" to "publish one parent-teacher conference at a time (not a weekly one)".

### "Details: Done" even though 2 boxes are still empty
- Where: 04 details ("Saved as a draft · 2 boxes left to publish: Starts and Ends"), then 06 and 07, where the Details step shows a green check and "Done".
- What happens: The organizer can continue with Starts and Ends still empty, and the stepper then marks Details as done. The missing times only come back at the publish step, by which point the organizer has forgotten them.
- Who it hurts: the organizer and the teacher, who often don't have the times on hand at the start.
- Standard: Heuristic 1 (visibility of system status) and 6 (recognition rather than recall).
- Severity: 2
- Suggested fix: Show the step as "Details · 2 left" in amber until it's complete, and list the missing boxes on the publish step (12) with a link back to them. The red asterisks on Date, Starts, Ends, and Where also suggest the boxes are needed to save, but only the name is. Change these to "Needed to publish" hint text and keep the asterisk for Event name only.

### Error state hides the fix, and "Try again" will fail
- Where: 19 job-live-error. All widths, both modes.
- What happens: The Spots box shows "2 people signed up, so spots can't be lower than 2" next to a separate "Couldn't save… Try again" bar. "Try again" would send the value 1, which can't be accepted. The link that is the actual fix, "See the 2 people signed up to move them", is shown on 18 but missing here.
- Who it hurts: the organizer trying to shrink a shift.
- Standard: Heuristic 9 (help users recover from errors). WCAG 3.3.3 (error suggestion).
- Severity: 2
- Suggested fix: Make the field error point to the fix: "Enter 2 or more, or move the 2 people to another shift first", with the link. Turn off "Try again" while the field has an error, or make it retry only the change that is valid.

### Volunteer Lead's publish step has a dead-end handoff
- Where: 14 ready-vlead. All widths, both modes.
- What happens: The heading says "Ready to publish", but this person can't publish. The only action is "Copy a note for Hana", which copies text to the clipboard. The page doesn't confirm the copy or say where to paste the note. It also leaves out the 2 hidden jobs, which the Host sees on 12.
- Who it hurts: the Volunteer Lead (often a busy parent on a phone), and the Host who gets a vague note.
- Standard: Heuristic 1 (system status), the "action over information" rule, and the brand-voice rule that every page ends with a clear next step.
- Severity: 2
- Suggested fix: Change the heading to "Ready for a Host to publish". Show the hidden-jobs line from 12. Show a "Copied" message (announced to screen readers) after copying. If possible, add "Send to Hana" so the request reaches her inside the app.

### "Not the Account Host?" comes after the email button
- Where: 21 blocked and 03 picker-ended. All widths.
- What happens: A Co-host reads "Email us about a plan" and acts on it before reaching "Not the Account Host? Ask Hana Patel". That leads to the wrong person emailing, and support has to send them back to Hana.
- Who it hurts: Co-hosts and the support team.
- Standard: Content rule "answer first".
- Severity: 2
- Suggested fix: Show a different main action depending on who is looking. Account Host: "Email us about a plan". Everyone else: "Ask Hana Patel about a plan" first, with our email address as the second option.

### Small text-link targets on phone
- Where: "Show ▾" (01–03, which also wraps the arrow onto its own line), "Edit" (08, 09, 18), "Add" and "Change" (12, 15, 17), "See who" (18), and "Remove" (20). Phone.
- What happens: These targets are about 20–24 px tall. On 08 and 09 the "Edit" link sits on its own line below the item, so it isn't clear which item it edits.
- Who it hurts: the PTO president and Volunteer Leads using a phone with one hand.
- Standard: WCAG 2.5.8 (24 px minimum). Our own 44 px goal.
- Severity: 2
- Suggested fix: Give these links at least 44 px of tap area (padding works). Keep "Edit" on the same row as its item. Include the item in the accessible name ("Edit Bottled water", "Remove Ana Lopez", "Mark Supplies to bring ready"). The 13 "Mark it ready" button needs the same.

### Unpublish dialog doesn't say what happens to sign-ups
- Where: 16 unpublish. All widths, both modes.
- What happens: The dialog says links stop working and tells the organizer to tell volunteers themselves. It doesn't say whether the 2 sign-ups are kept if the event is published again, and it doesn't help them reach those 2 people. The dialog also says "offline" and "online" while the button that opened it says "Unpublish".
- Who it hurts: the organizer, and the volunteers who get stranded.
- Standard: Heuristic 5 (error prevention) and 4 (consistency).
- Severity: 2
- Suggested fix: Add "Their sign-ups are kept if you publish again" (or whatever is true). Add a "Copy their emails" link. Use "Unpublish" in the dialog title and button ("Unpublish event" / "Keep it published"), or rename the page button to "Take offline". Pick one pair of words.

### Coordinator preview is a dead end
- Where: 11 preview-coord. All widths.
- What happens: Maria sees her job with "No shifts yet", but nothing tells her what to do next or whether she can add shifts. The banner also doesn't say that the whole event isn't published yet.
- Who it hurts: Coordinators, usually parents who were handed a job.
- Standard: The brand rule that every page ends with a clear next step. Heuristic 10.
- Severity: 2
- Suggested fix: Add one line and one action. If she can edit: "Add shifts to Litter pickup". If she can't: "Hana Patel or a Volunteer Lead adds shifts". Also add "The event isn't published yet" to the banner.

### Two main buttons compete on 08
- Where: 08 job-items. All widths.
- What happens: The top banner's "Continue to publish" and the save bar's "Mark ready" are both filled main buttons. A keyboard or screen-reader user reaches "Continue to publish" first and can leave with the job still hidden.
- Who it hurts: the organizer.
- Standard: The "action over information" rule. Heuristic 8.
- Severity: 1
- Suggested fix: While the job being edited still has a pending choice, show the banner's action as a text link ("Go to publish"). Use the filled button there only once no job is in the middle of editing.

### Status messages and the pinned save bar need build care
- Where: the save bars on 04, 07, 08, and 18, the "Copied" moments on 14 and 15, and the job selector cards on 07, 08, and 18. These can't be checked in a static mock-up.
- What happens: In the real build the save bar is pinned to the bottom of the screen. On a phone it is tall (07: status line plus two full-width buttons) and can cover the focused field. The job cards act like tabs but look like cards.
- Who it hurts: keyboard and screen-reader users, and phone users at 200% zoom.
- Standard: WCAG 2.4.11 (focus not hidden), 4.1.3 (status messages), and 1.3.1 (structure).
- Severity: 2
- Suggested fix: Add bottom padding equal to the height of the bar, and scroll the focused field into view above it. Announce "Saved", "Unsaved changes", "Couldn't save", and "Copied" in a polite live region. Build the job cards as a tab list (or a list of links with aria-current) and give each a status that is read aloud.

## Working well
- The plan-ended experience is honest and calm: "You can set this up now", "Everything here is saved", and "we reply within a day" follow the claims rules, and nothing is hidden behind an upsell.
- The rules are prevented up front. "2 people signed up, so you can't go below 2" and "You can't hide this job while 2 people are signed up. See who" each come with a reason and a way forward.
- Preview is clearly a preview: a "Preview only" banner, dashed borders plus a "Hidden from volunteers" badge (not color alone), and "Sign-up opens when published" on each shift.
- 13 ready-none turns a blocked publish into a short to-do list with the exact next action for each job.
- "Start from a past event" (06) copies jobs in as hidden so they can be checked. That is a good answer to the PTO president's need to reuse last year's event.
- The publish step says what will happen ("We don't send the link for you, so share it in your group text") and separates optional items into "Before the day".
- The coordinator privacy note ("On event day they also see volunteers' phone numbers and emails") is open about who sees what.
- Light-mode contrast looks solid throughout. Muted text, amber chips, and red errors all appear to meet 4.5:1, and dark mode switches muted text to white instead of dimming it.
- The unpublish dialog offers the gentler "Close sign-up instead" right where it's needed.

## Verdict
**Build after fixes.** The structure, the order of steps, and the way the rules are explained are sound. Nothing needs a rethink. Before building, make saving work one way everywhere and rename the job state to "Showing / Hidden". Both are about trust: an organizer has to know what's saved and what volunteers can see. The phone overflow and the dark-mode disabled buttons are quick visual fixes. **The one change that would help most is a single, automatic save model across details, jobs, and live edits, with an honest status line that never says "All changes saved" while something is still open.**

Screenshots opened (126): 01–21 × phone, tablet, desktop × light, dark (all files in docs/design-reviews/2026-10-30-setup-redesign-mockup-v3/).
