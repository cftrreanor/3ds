# Product Owner

## Headline
Version 3 covers the main path well: pick a type, add details, add jobs, publish, run a live event. The plan, preview, and "can't hide or go below the sign-up count" rules all show up on screen. It is not yet complete enough to call done. The rules for saving differ from screen to screen. How an organizer picks between a shift job and a things-to-bring job is never shown. Several actions lead to screens that don't exist (start from a past event, Move, Remove, copy a note, Later). Some states the rules depend on are missing too: unpublishing after a plan ends, a sign-up that hasn't opened yet, publishing with details missing, and after the event. Two builders working from these screens would build different products in at least six places.

## Findings

### Saving works differently on different screens
- Where: 04 details ("We save as you go", "Saved as a draft"). 07 job-edit ("Unsaved changes", "Save as hidden" and "Mark ready" buttons). 08 job-items (green "All changes saved" banner, while the bar at the bottom still offers "Save as hidden"). 18 job-live ("All changes saved · Last saved by Dee Nguyen" next to an open shift editor that has its own "Save shift" button). 19 (failed save). All widths and modes
- What happens: Details saves on its own. A job has to be saved by hand. On a published event it looks like it saves on its own, but each shift also has a Save button. Nothing says whether a half-filled "New shift" box (07) is kept when someone presses "Save as hidden" or leaves the page. On 18 the spots box shows 5 while the bar says "All changes saved", so it isn't clear whether 5 is saved yet.
- Who it hurts: the PTO president and the teacher, who leave partway through and need to trust their work was kept. The organizer at a laptop, whose main worry is "is this saved?"
- Standard: Heuristic 1 (visibility of status), Heuristic 4 (consistency), Interruption-proof
- Severity: 3
- Suggested fix: Pick one rule and write it on the mock-up. My suggestion: every field saves on its own, everywhere. "Hidden" and "Ready" become a switch, not a save action. A shift is saved when "Add this shift" or "Save shift" is pressed. If someone leaves with an unfinished shift box open, ask "Discard this shift?" Show the status bar in the same place on every screen, with the same three states: Saving, Saved, Couldn't save.

### No screen shows how to choose between a shift job and a things-to-bring job
- Where: 06 jobs-empty ("Volunteers pick a shift or an item"), 07 (shift job), 08 (items job)
- What happens: "+ Add a job" leads straight to a job form. 07 shows a Shifts section. 08 shows "Things to bring" and has no Coordinator or check-in fields. Nothing shows where that choice is made. Nothing says whether one job can have both shifts and items, or whether the choice can be changed later.
- Who it hurts: the organizer at a laptop and the PTO president. A builder would have to guess, and two builders will guess differently.
- Standard: Heuristic 6 (recognition rather than recall). Not complete enough to build.
- Severity: 3
- Suggested fix: Add a screen for the first moment of "+ Add a job". Offer two choices: "People sign up for a time (shifts)" and "People bring things (items)". Say whether the choice can be changed while nobody is signed up. Also decide whether items jobs get a Coordinator and a check-in place, and mock up the Add or Edit item form with its fields (name, how many, unit).

### Missing state: unpublishing after the plan has ended
- Where: 16 unpublish ("You can publish it again later while your Volunteer Command plan is active"), 03 ("Your published events stay up")
- What happens: An event published before Jan 1 is still up after the plan ends. If the Host unpublishes it, they can't publish it again. Only one design for this dialog exists, and it doesn't cover that case. Nothing says whether the 2 volunteers keep their spots if the event is published again.
- Who it hurts: the PTO president. She could take a live event offline to fix a typo and then be unable to put it back. The volunteer parent loses their place.
- Standard: Heuristic 5 (error prevention)
- Severity: 3
- Suggested fix: Add a second version of 16 for when the plan has ended: "Your plan has ended, so you won't be able to publish this again. Close sign-up instead to keep the page up." Make "Close sign-up" the main button there. In both versions, say whether people who signed up keep their spots if the event goes live again.

### Missing state: the "Later" choice once published
- Where: 12 ready ("Later: People can see the event but can't sign up until you open it"), 15 live, 17 live-closed
- What happens: Picking "Later" has no screen showing what comes after. 17 says "You closed sign-up on Jan 28", which describes closing, not "not open yet". Nothing says whether the "Publish and open sign-up" button changes its words when "Later" is picked. Nothing says whether "Later" means a date the organizer picks or opening it by hand.
- Who it hurts: the organizer at a laptop, who can't see what will happen before choosing it.
- Standard: Heuristic 1, "a setting whose effect they can't preview" (people.md)
- Severity: 3
- Suggested fix: Mock up the live page for "Published · Sign-up not open yet", with an "Open sign-up" button and its own short explanation. When "Later" is picked on 12, change the button to "Publish without sign-up". Decide whether "Later" also takes an opening date. If it doesn't, write that down so nobody builds a date picker.

### Actions that lead to screens that don't exist
- Where: 06 "Choose a past event". 20 "Move" and "Remove". 14 "Copy a note for Hana". 15 "Get QR code" and "Copy a ready-to-send text". 07 "Send invite", and Coordinator invite states. 12, 15, and 17 "Invite", "Add", and "Change". 21 "Finish hidden jobs: Open"
- What happens: Each one needs at least a second screen or a confirmation. Examples: the list of past events and how dates move to the new event; a shift picker for Move; a confirmation for Remove (it emails the volunteer and can't be undone); the text of the note and a "Copied" message; an invite that expired or bounced. "Open" on 21 doesn't say which hidden job it opens.
- Who it hurts: all of the organizer roles. Remove with no confirmation hurts the volunteer parent, who gets an email saying they were dropped.
- Standard: Heuristic 3 (user control), Heuristic 5 (error prevention)
- Severity: 3 for Move, Remove, and Choose a past event. 2 for the rest.
- Suggested fix: Mock up these screens: past-event picker and its confirmation, Move (a list of other shifts with spots left), Remove (confirmation that names the person), the copied note with a "Copied" message, and invite states (sent, accepted, expired, resend). The rest (Invite, Add, Change) can go into Event settings, which is out of scope. In that case write "goes to Event settings > X" next to each one.

### Missing state: trying to publish with details still missing
- Where: 04 shows "2 boxes left to publish: Starts and Ends", but 06, 07, 12, and 21 all show Details as "Done"
- What happens: The brief says date, times, and address are needed to publish. No screen shows the publish step when they're missing, and nothing says whether Details can show "Done" while boxes are still empty. The 13 ready-none screen covers only "no job ready".
- Who it hurts: the teacher, who fills in what she knows at lunch and finishes later. She needs the publish step to tell her exactly what's left.
- Standard: Heuristic 1, Action over information
- Severity: 3
- Suggested fix: Show Details as "2 left" (not "Done") while any required box is empty. Add a 13-style screen where the blocking card lists "Add start and end times" with a link that opens Details at that box. Show this together with the "no job ready" block, since both can happen at once.

### Who can edit, and who sees the draft, is unclear for Coordinators and Volunteer Leads
- Where: the "Draft · Hosts, Co-hosts, and Volunteer Leads only" chip (06, 12, 13, 14, 21). 11 preview-coord (a Coordinator sees the draft). 18 ("Last saved by Dee Nguyen", who is the Parking Coordinator). 14 vlead (no Event settings, no steps, no address)
- What happens: The chip says only three roles can see the draft, but 11 shows a Coordinator seeing it. 18 shows a Coordinator editing a job, but the rules only say Coordinators can preview. 11 shows no Edit link, and nothing says where "Close preview" goes for a Coordinator. 14 drops the step tracker and Event settings for a Volunteer Lead. Nothing says whether that's on purpose, or what a Volunteer Lead sees on the live page (15), including Unpublish.
- Who it hurts: the PTO president, who hands jobs to other parents and needs to know what they can change. It also creates a privacy risk if a builder gives Coordinators more access than intended.
- Standard: Heuristic 4 (consistency). Product rule on roles.
- Severity: 3
- Suggested fix: Add a small table to the mock-up: rows for Host, Co-host, Volunteer Lead, and Coordinator; columns for see draft, preview hidden jobs, edit any job, edit own job, publish or unpublish, open or close sign-up, and Event settings. Change the chip to match, for example "Draft · only your team can see it". Change the 18 sample so a Host or Volunteer Lead is the last editor, unless Coordinators really can edit. Show where "Close preview" goes for a Coordinator.

### Editing a live shift: time changes, deleting shifts, and deleting jobs aren't designed
- Where: 18 job-live (the shift editor shows only Spots, while the banner says "People already signed up get an email if their shift's time changes"). No delete action appears on any job or shift.
- What happens: The words promise time changes, but no screen shows how to make one. Nothing shows how to delete a shift or job, during setup or while live with people signed up. The rule about not hiding a job with sign-ups suggests deleting needs the same guard, but no screen shows it.
- Who it hurts: the organizer at a laptop, who will need to fix a wrong time or remove a job that's no longer needed. The volunteer parent, who could lose a shift without warning.
- Standard: Heuristic 3 (user control), Heuristic 5 (error prevention)
- Severity: 3
- Suggested fix: Add Starts, Ends, and (for multi-day events) Day to the live shift editor, with a note: "2 people will get an email about the new time". Add "Delete shift" and "Delete job". Disable them the same way "Hide this job" is disabled while people are signed up, with a "See who" link.

### Picker after the plan ends: conference cases missing
- Where: 03 picker-ended (only the case where another conference is still upcoming). There is no screen for a conference at the publish step after the plan has ended.
- What happens: Not shown: the conference card when the plan has ended and no conference is upcoming ("You can publish one"); a conference draft reaching publish while another is still live; and what tells a conference organizer that a weekly recurring schedule won't publish. Separately, the "Fall conferences runs until Feb 12" chip runs past the card edge (desktop only).
- Who it hurts: the teacher, who could set up a full conference day and only find out at publish that it's blocked.
- Standard: Heuristic 5, product rule on conference limits
- Severity: 2 (the conference flow is mostly out of scope, but the picker is in scope)
- Suggested fix: Add a second version of 03 with no upcoming conference ("Without a plan you can publish one one-time conference"). Add one line saying the conference setup will show a 21-style blocked state, and when.

### Missing states: event full, after the event, and loading
- Where: 15 and 17 (live). 10 preview
- What happens: No design for all spots filled ("Full", and whether sign-up closes on its own), for after the event date (does the page still say "Before the day" and "Close sign-up"?), or for a first-load or loading state. Nothing says whether sign-up closes on its own at the start of the event.
- Who it hurts: the organizer at a laptop. The volunteer parent who opens the link after the event.
- Standard: Product Owner checklist (every state). Heuristic 1.
- Severity: 2
- Suggested fix: Add three small variants of 15: "Full" (still published, with a choice to add spots), "Event over" (setup actions hidden, and a link to results or volunteer hours if those exist), and a plain loading frame. Write down whether sign-up closes on its own when the event starts.

### "Publish" means two different places
- Where: 06 to 08 ("Step 2 of 3", "Continue to publish", back link "← Cedar Ridge Campus Clean-up") versus 12 and 13 ("2 of 3 steps done", which is also the event's main page with Event settings, and a back link to My events)
- What happens: The third step is also the event's main page. The jobs screens call it "Step 2 of 3", while 12 counts "steps done". It isn't clear where "← Cedar Ridge Campus Clean-up" goes, where a returning organizer lands, or whether Details (04) is part of the same page.
- Who it hurts: the PTO president coming back later, who needs "where was I?" to have one answer.
- Standard: Heuristic 4, Interruption-proof
- Severity: 2
- Suggested fix: Make one rule and write it down: opening an event always lands on its main page (12, 13, 15, 21). The step tracker there links to Details and Jobs. Each step page links back to that main page by the event's name. Use the same wording for steps everywhere, either "Step 2 of 3" or "2 of 3 done".

### The 21 blocked screen talks to the wrong person
- Where: 21 blocked ("Not the Account Host? Ask Hana Patel"), with the email button shown to everyone
- What happens: The same card is shown to Hana herself, to a Co-host, and (presumably) to a Volunteer Lead. Nothing says whether a Co-host should email about a plan or ask Hana. "Once your plan is set, come back and publish" depends on the organizer remembering, because nothing tells them when the plan is active again.
- Who it hurts: the PTO president (a Co-host), who doesn't know whose job this is. Events that sit unpublished.
- Standard: Heuristic 6, Interruption-proof
- Severity: 2
- Suggested fix: Show two versions. Account Host: "Email us about a plan". Everyone else: "Ask Hana Patel to set up a plan", plus a "Copy a note for Hana" button, the same as 14. When the plan becomes active, email whoever last edited a blocked draft.

### Multi-day shifts: list and checks not shown
- Where: 09 job-multiday
- What happens: Only adding a shift is shown. Not shown: shifts grouped by day in the list and the preview, an end time before the start time, a shift outside the event's hours, or an overnight shift.
- Who it hurts: the organizer at a laptop setting up a two-day fair.
- Standard: Heuristic 5, Heuristic 9
- Severity: 2
- Suggested fix: Add a shift list with two days of shifts, grouped under day headings. Add one error example for "Ends must be after Starts".

### Failed save shown at the same time as an invalid value
- Where: 19 job-live-error
- What happens: "Try again" is offered while the spots box has an invalid value (1). Nothing says which comes first, or what "Try again" would send.
- Who it hurts: whoever builds it, because two builders would handle it differently. Low impact on users.
- Standard: Heuristic 9
- Severity: 1
- Suggested fix: Write down that saving is blocked while a box has an error, and that "Try again" sends only the last valid values.

## Acceptance criteria (what I'd check before calling it done)

Type picker
- Given an active Volunteer Command plan, when the organizer opens the picker, then volunteer event, conferences, and meetings are shown open, and the other 4 types sit under a closed "Interested in more?" section, each marked "Try it"
- Given any plan state, when the organizer picks any type, then a draft can be set up and previewed
- Given the plan has ended and a one-time conference is still upcoming, when the picker opens, then the conference card names that conference and its end date, and every other type shows "Publishing needs a plan"
- Given the plan has ended and no conference is upcoming, when the picker opens, then the conference card says one can be published

Saving
- Given a new event, when the organizer types a name, then the event is saved to the account and appears in My events as a draft, with no other boxes filled
- Given any setup screen, when a change is made, then the status bar shows Saving, then Saved (or Couldn't save, with Try again), and leaving the page loses nothing that was saved
- Given an unfinished New shift box, when the organizer leaves, then they are asked before it is thrown away

Jobs and visibility
- Given "+ Add a job", when it is pressed, then the organizer picks shifts or items before the form appears
- Given a hidden job, when a volunteer opens the sign-up link, then the job doesn't appear
- Given a hidden job, when a Host, Co-host, Volunteer Lead, or that job's own Coordinator opens the preview, then the job shows with a "Hidden from volunteers" label inside a "Preview only" bar
- Given a hidden job, when another job's Coordinator previews, then it isn't shown, and a line says other hidden jobs aren't shown to them
- Given a job with at least 1 person signed up, when the organizer edits it, then Hide and Delete are disabled, with the count and a "See who" link
- Given a shift with N people signed up, when the organizer enters fewer than N spots, then saving is blocked with "N people signed up, so spots can't be lower than N", next to the box
- Given a job with no shift (or no item), when the organizer views it, then Mark ready is disabled and says what's missing

Publishing
- Given a Volunteer Lead, when they reach the publish step, then there is no Publish button, and they can copy a note to the Account Host
- Given a Host or Co-host with an active plan, at least one ready job, and date, times, and address filled in, when they press Publish, then the event goes live and the page shows the link, QR code, and copy-text actions
- Given required details are missing, when the publish step opens, then Publish is disabled and each missing item is listed with a link to it
- Given no job is ready, when the publish step opens, then Publish is disabled and each hidden job is listed with its next action
- Given the plan has ended and the event isn't a one-time conference, when a Host opens the publish step, then Publish is disabled with "Needs a plan", everything stays saved, and the Account Host's name is shown to everyone else
- Given "Later" is chosen, when the event is published, then the page shows "Sign-up not open yet" with an "Open sign-up" button

Live
- Given a live event, when the Host presses Close sign-up, then people already signed up keep their spots and the page stays visible
- Given a live event, when the Host presses Unpublish, then a dialog gives the number of people signed up, says they won't be emailed, and offers Close sign-up instead
- Given the plan has ended, when the Host presses Unpublish, then the dialog warns that it can't be published again
- Given a person on a shift, when the Host presses Remove, then a confirmation names them and says they'll be emailed
- Given Move, when it is pressed, then only shifts with open spots are offered, and the person is emailed their new shift

Every screen
- Works at 390 px, 820 px, and 1440 px in light and dark, with no sideways scrolling (06 and 12 at phone width currently show the Draft chip running past the edge)

## Working well
- The plan rules are honest and come early. "You can set this up now" (05), the "Needs a plan" label on the step tracker, and 21's "Everything here is saved" all tell the organizer before they put in work, not at the end.
- The "can't hide, can't go below" rules are carried out well on 18: the disabled button explains why, gives the number, and links to "See who". 20 then gives a way out (move people).
- 13 ready-none turns a blocked publish into a to-do list with one button per job. This is the right pattern, and the missing-details case should follow it.
- The preview bars on 10 and 11 make it clear this is only a preview, with dashed hidden-job cards and a reason for the Coordinator ("because you're its Coordinator").
- 16 offers the safer "Close sign-up" choice inside the unpublish dialog and says plainly that volunteers won't be emailed.
- "Start from a past event", with copied jobs coming in hidden, is the right reuse feature for the PTO president. It just needs its screens.
- The sample is kept small: three jobs, two shifts, one event. Nothing looks gold-plated.

Screenshots opened: 01–21 desktop light; 01–21 phone light; dark: 01-tablet, 02-phone, 03-tablet, 04-desktop, 05-phone, 06-tablet, 07-tablet, 08-phone, 09-tablet, 10-phone, 11-tablet, 12-tablet, 13-phone, 14-tablet, 15-desktop, 16-tablet, 17-phone, 18-tablet, 19-desktop, 20-tablet, 21-tablet (63 total).
