# UX Designer

## Headline
The main path works. A Host can go from picker to details to jobs to publish to live without getting lost, the next step is almost always the most prominent thing, and the plan-ended and hidden-job rules come across honestly. The biggest problem is saving: the details page saves as you go, the job editor has its own "Save as hidden" and "Unsaved changes", the live job editor saves on its own, and shift rows have their own save button. A tired organizer can't tell what's saved. The Volunteer Lead's publish screen is close to a dead end, and a few one-tap actions on a live event (remove a volunteer, mark a job ready) have no confirm and no undo.

## Findings

### Four different save rules on the setup screens
- Where: 04 details ("We save as you go"); 07 job-edit (bottom bar "Unsaved changes" with "Save as hidden", plus "Add this shift" inside the open shift panel); 08 job-items (top banner "All changes saved", but the bottom bar still offers "Save as hidden"); 18 job-live (bar "All changes saved" while an open shift panel has its own unsaved "Save shift"); 19 job-live-error. All widths and both modes.
- What happens: People can't build one rule for "is my work safe?" On 07 it's unclear whether "Save as hidden" also keeps the half-entered shift, or whether they must press "Add this shift" first. On 08 the page says everything is saved and also offers a save button. On 18 the bar says "All changes saved" while the spots edit is still unsaved. On 19 a network failure and a spots error show together: "Try again" would resend a number the app has already rejected, and "Your changes are still here" doesn't say which changes.
- Who it hurts: Busy mom / PTO president (works in short bursts in the car line, and leaves mid-job expecting it to be kept the way the details page was), teacher with a 30-minute lunch (a student walks in mid-shift), organizer at a laptop ("is this saved?" is listed as something that breaks for them).
- Standard: Heuristic 1 (visibility of system status), Heuristic 4 (consistency), Heuristic 9 (recover from errors), our "interruption-proof" rule
- Severity: 3
- Suggested fix: Use one rule everywhere in setup, which is save as you go. In the job editor, save each field and each shift row as soon as it's valid (a half-filled shift is kept as an unfinished row). Replace "Save as hidden" with a status line ("Saved · hidden from volunteers"), and make "Mark ready" the only button in the bar. On live events, keep "Save shift" only where a change emails volunteers, and make the bar say "1 change not saved yet" while that panel is open. On 19, deal with the spots error first: disable "Try again" while the field is invalid, or say "Fix the spots number, then try again."

### The Volunteer Lead's publish screen is close to a dead end
- Where: 14 ready-vlead, all widths and both modes
- What happens: The Volunteer Lead gets a heading that says "Ready to publish", but they can't publish. The step bar, Event settings, the links back to jobs and details, and the "2 jobs are hidden" line from 12 are all gone. The only action is "Copy a note for Hana", which puts text on the clipboard with no hint of where to paste it, and Hana never finds out from the app. "A Host publishes this event" leaves out Co-hosts, who can also publish. There's no Volunteer Lead version of 13 (no job ready yet) or 21 (plan ended).
- Who it hurts: Organizer at a laptop acting as a Volunteer Lead (did most of the setup and can't see what's left or tell whether Hana got the message), busy mom / PTO president as Host (handing off is the point, and nothing tells her a hand-off is waiting)
- Standard: Heuristic 1, Heuristic 3 (user control: there's no way back into the work), action over information
- Severity: 3
- Suggested fix: Keep the same overview the Host gets on 12 (step bar, hidden-jobs line, Before the day), with the Publish area swapped out. Use the heading "Ready for a Host to publish" and a main button "Ask a Host to publish". It sends an in-app notice and an email to the Account Host, Hosts, and Co-hosts. Afterward, show "You asked Hana Patel on Oct 30 · Ask again". Keep "Copy a note" as a smaller link. Mock up the Volunteer Lead versions of 13 and 21.

### Plan-ended publish screen doesn't check who is looking
- Where: 21 blocked, all widths
- What happens: Everyone gets "Email us about a plan" as the main action. "Not the Account Host? Ask Hana Patel" is a small line underneath. A Co-host or Volunteer Lead will likely email the company first, when only Hana can act.
- Who it hurts: Organizer at a laptop who isn't the Account Host (wasted step and a day's wait for a reply that says "ask your Account Host"), and Hana (finds out last)
- Standard: Heuristic 2 (match the real world: who actually decides), action over information
- Severity: 2
- Suggested fix: Show by role. The Account Host gets "Email us about a plan" as the main action. Everyone else gets a main button "Tell Hana Patel" (an in-app notice plus email), with the company email as a secondary line.

### "Start from a past event" comes too late and copies too little
- Where: 06 jobs-empty, all widths
- What happens: Reuse is only offered at step 2, after the organizer has already typed the name, date, times, and address. It copies only jobs and shifts.
- Who it hurts: Busy mom / PTO president ("reuse last year's event" is one of her core needs), teacher with a 30-minute lunch (re-typing the address and times uses up the window)
- Standard: Heuristic 7 (flexibility and efficiency), standard 3.3.7 (redundant entry)
- Severity: 2
- Suggested fix: Add "Copy a past event" to the picker (01, and 03 when the plan has ended). It copies the name ("… 2027"), place, times, jobs, shifts, and Coordinators, and asks only for the new date. Keep the step 2 option for people who started from scratch.

### On phone, Unpublish and Close sign-up sit above the share buttons
- Where: 15 live and 17 live-closed, phone (both modes). Less of an issue at tablet and desktop, where they share a row with the status.
- What happens: Right after publishing, the main job is to share the link. On a phone, the first buttons after the title are "Close sign-up" and a red "Unpublish", and "Copy link" comes after them. A thumb lands on the wrong control first.
- Who it hurts: Busy mom / PTO president publishing from her phone in the car line
- Standard: Action over information, Heuristic 5 (error prevention)
- Severity: 2
- Suggested fix: On phone, put the Sign-up card (Copy link and the rest) first. Move "Close sign-up" and "Unpublish" into a "Sign-up status" section at the bottom of the page, or behind a "More" menu next to the status badge.

### Removing or moving a volunteer has no confirm and no undo
- Where: 20 shift-people, all widths
- What happens: "Remove" sits next to each person and sends an email right away, according to the footnote. There's no confirm step and no undo. It's not clear what "Move" will ask for.
- Who it hurts: Organizer at a laptop and the front office administrator (one slip sends a real parent a "you're no longer on this shift" email), volunteer parent on a phone (gets a wrong removal email)
- Standard: Heuristic 5 (error prevention), Heuristic 3 (undo)
- Severity: 2
- Suggested fix: After "Remove", show an inline confirm: "Remove Ana Lopez? We'll email her." with Remove and Keep. Or remove right away with a 10-second "Undo" before the email goes out. "Move" should open a list of the other shifts showing spots left on each, and confirm "Move Ana to 10:30 AM–12:30 PM? We'll email her."

### The unpublish dialog says "tell them yourself" but gives no way to do it
- Where: 16 unpublish, all widths
- What happens: The dialog says the 2 volunteers' links stop working and nobody emails them. The organizer is left to find out who they are and how to reach them, after the page has gone offline.
- Who it hurts: Organizer at a laptop, and the volunteer parent (who shows up for a cancelled shift)
- Standard: Heuristic 5, Heuristic 6 (recognition rather than recall)
- Severity: 2
- Suggested fix: Add "Copy their emails" and "Copy a message to send" to the dialog, or a checkbox "Email the 2 volunteers that it's off". After unpublishing, keep the list available on the event page.

### No clear "event home": back links and step links point to different places
- Where: 04 ("← My events"), 06/07/08/18/19 ("← Cedar Ridge Campus Clean-up"), 12/13/21 (an overview with "← My events"), 09 and 20 (back to the job or the Spring Fair). Step labels are underlined links on some screens and plain text on others.
- What happens: Once the event has a name, it already exists. But step 1 still goes back to My events, and it's never named that the event-name link goes to the overview on 12 and 13. Someone coming back after a week can't tell which page is "the event".
- Who it hurts: Organizer at a laptop (forgets how things work between events), busy mom / PTO president ("where was I?")
- Standard: Heuristic 4 (consistency), Heuristic 6, interruption-proof
- Severity: 2
- Suggested fix: Make the overview (12/13/15) the event home. Every setup screen links back to it with the event name, including step 1 once the event is saved. Treat all three step labels as links everywhere, with the current one marked. My events opens a draft on this home, and the home shows "Next: …" in its first card (13 already does this well).

### Making a hidden job visible on a live event happens in one tap, with no warning
- Where: 15 live ("Mark Supplies to bring ready" link); the "Mark ready" path for hidden jobs while the event is published (not mocked)
- What happens: On a published event, marking a job ready shows it to volunteers immediately. The live page offers it as a small text link with no preview and no "volunteers will see this now".
- Who it hurts: Organizer at a laptop (shows a half-checked list of things to bring), volunteer parent (signs up for something that then changes)
- Standard: Heuristic 5, Heuristic 1
- Severity: 2
- Suggested fix: Turn the link into "Review and show Supplies to bring". It opens the job with the line "Volunteers will see this as soon as you mark it ready", next to "Preview" and "Mark ready".

### Live shift edit only shows spots, but the page talks about time changes
- Where: 18 job-live, 19 job-live-error, all widths
- What happens: The banner says people get an email if their shift's time changes, but the edit panel only shows Spots. There's no way to change the time or delete the shift. The organizer can't tell whether time is locked or just hidden.
- Who it hurts: Organizer at a laptop (the start time moves, which happens often, and they can't find where to change it)
- Standard: Heuristic 6, Heuristic 4
- Severity: 2
- Suggested fix: Show Starts and Ends in the live edit panel with the note "Changing the time emails the 2 people signed up". If time really is locked, say so in the panel and point to "Move people" plus "Add a shift".

### On phone, the job list pushes the editor off-screen
- Where: 07, 08, and 18 at phone (tablet is borderline)
- What happens: Every job card stacks above the editor. With three jobs the editor already starts about 600 px down, and with eight it's several screens down. After tapping a job, nothing moves to its form.
- Who it hurts: Busy mom / PTO president editing jobs from her phone
- Standard: Heuristic 8 (minimalist), Heuristic 6
- Severity: 2
- Suggested fix: On phone, make the jobs list its own view. Tapping a job opens its editor as a full screen with "← All jobs", and the status chips stay on the list.

### "Continue to publish" competes with the job that's open
- Where: 08 job-items, all widths
- What happens: While the organizer is partway through a hidden job, a green banner at the top says "You can publish now" with a dark primary button. The bar at the bottom has its own primary button, "Mark ready". That's two main actions, and the banner invites publishing past two hidden jobs.
- Who it hurts: Organizer at a laptop (may publish without the supplies list), teacher (rushing)
- Standard: Action over information, Heuristic 8
- Severity: 2
- Suggested fix: Show the "Continue to publish" banner only when no job editor is open. Make it say "1 job ready, 2 hidden" so the trade-off is visible, and make it secondary while any job is in progress.

### Small preview inconsistencies
- Where: 10 preview and 11 preview-coord, all widths
- What happens: The Host's preview exits with "Back to jobs" and the Coordinator's with "Close preview", which doesn't say where it goes. The Host gets "Edit" links on hidden jobs but none on the ready Parking job.
- Who it hurts: Organizer at a laptop, and the Coordinator (a parent who rarely uses the app)
- Standard: Heuristic 4
- Severity: 1
- Suggested fix: Name the exit after where it goes ("Back to Litter pickup" for the Coordinator). Add "Edit Parking" to ready jobs in the Host preview.

## Working well
- The details page tells people the event is saved as a draft and names exactly which boxes are still needed to publish (04). That's a strong model for the rest of setup.
- The plan-ended path is honest and doesn't block anyone. Setup stays open, the lock sits only on Publish, "Everything here is saved", and the conference exception is spelled out with the date and a link (03, 05, 21).
- The hidden-job pattern is consistent: status chips say what's missing ("needs a shift", "ready to mark"), "Mark ready" is locked with a reason, and previews use dashed borders and a "Preview only" bar (07, 10, 11).
- On 13 the next step comes first ("Next: mark a job ready"), with one-tap fixes for each job.
- The rule against hiding a job that people are signed up for, and the spots floor, are explained before anyone runs into them, with a link to the people involved (18).
- The unpublish dialog makes the safe choice the main button and points to "Close sign-up" as the gentler option (16).
- The publish step says exactly what happens and what doesn't ("We don't send the link for you") (12).

Screenshots opened: 01–21 phone and desktop light (42), plus dark: 01 phone, 02 desktop, 03 tablet, 04 tablet, 05 phone, 06 tablet, 07 tablet, 08 desktop, 09 phone, 10 tablet, 11 phone, 12 tablet, 13 phone, 14 tablet, 15 tablet, 16 desktop, 17 phone, 18 tablet, 19 tablet, 20 phone, 21 tablet (21).
