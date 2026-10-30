# UX Designer

## Headline
The main path works and reads well. Pick a type, fill in details, add jobs, see what's left, and publish. The event home page (10, 11, 12, 15) is a good "where was I?" anchor. The weak spots are the edges of the flow: work that isn't saved until the form is complete, rules that block the organizer without a way through (sign-ups in the way, needing a plan), and two screens that strip away the controls the organizer needs (02 and 13). The jobs editor also looks and behaves differently from screen to screen, which will make a once-a-year organizer hesitate.

## Findings

### Conference-already-live picker falls apart and hides most event types
- Where: 02 picker-conf, all widths, both modes
- What happens: Only 2 of the 7 event types show. The pilot banner is gone. "Go to Fall conferences" and a plain "Set up →" sit outside the cards in empty grid cells, so it's unclear which card they belong to. The conference card has no Set up of its own, and the badge says "Unpublish it to publish another." That nudges the organizer toward taking a live event offline, and it doesn't say whether they can still set up a second conference as a draft. The 01 banner promises they can ("You can still set up any kind of event").
- Who it hurts: Teacher with a 30-minute lunch, who comes back to set up spring conferences while fall ones are live. She can't tell whether to click "Set up", go to the old event, or unpublish, and she may unpublish a live event families are still booking.
- Standard: Heuristic 4 (consistency), 5 (error prevention), 1 (visibility of system status)
- Severity: 3
- Suggested fix: Keep the full 01 layout and banner. Inside the conference card, show "Fall conferences is live" with the link "Go to Fall conferences", and keep "Set up →" as the card's own action, with the line "You can set this up now and publish it when Fall conferences is over or unpublished." Don't suggest unpublishing in the badge.

### Event details aren't saved until every required box is filled, and only on this device
- Where: 04 details-errors (and 03, where nothing says this), all widths
- What happens: The error banner says "Add 2 more things to save this event," and the note says "what you've typed stays on this device until you come back." So nothing is saved to the account until Starts and Ends are filled in. On 03, the first screen people see, there's no hint of this. The error state also drops the step bar, the heading, Date, Time zone, and Where, so the page changes shape when it shows errors.
- Who it hurts: PTO president, who starts in the car line on her phone without knowing the times yet, then opens her laptop at night and finds nothing there. Teacher, who gets interrupted and comes back from a different classroom computer.
- Standard: Interruption-proof (house), Heuristic 1 (is this saved?), 3 (user control)
- Severity: 3
- Suggested fix: Save a draft event to the account as soon as it has a name. Mark Starts and Ends as "still needed" in the draft, not as errors. Show a "Saved" status on 03 itself. If the rule can't change, state it on 03 before the person types ("We save once the name, date, and times are in"). Keep the full form and step bar in the error state.

### "Move or remove the people signed up" with no way to do it
- Where: 14 job-live, the shift edit panel ("To delete this shift, move or remove the 2 people signed up first") and under the disabled "Hide this job", all widths
- What happens: The rule is enforced correctly, but there's no link to the 2 people, no names, and no "move" action anywhere on the page. The organizer hits a wall.
- Who it hurts: Organizer at a laptop and PTO president, who need to cancel a shift (for example, the parking lot is closed) and can't find where the sign-ups live. "Volunteer tracking" in the top nav might be it, but nothing points there.
- Standard: Heuristic 9 (help recover), Action over information (house)
- Severity: 3
- Suggested fix: Make "2 signed up" a link that opens the list for that shift, with "Move to another shift" and "Remove" next to each name. Put the same link in both blocked messages ("See the 2 people signed up").

### The real next step on "needs a plan" is buried in a sentence
- Where: 15 blocked, all widths, both modes
- What happens: The biggest control on the page is a disabled "Publish and open sign-up". What the organizer can actually do next is write to an email address, and that's plain text inside the banner, with no button or copy action. After they write, the page looks the same when they come back, so nothing shows that the request is pending. It also doesn't say what happens once a plan is added (do they come back and press Publish, or does it publish by itself?). "Ask Hana Host" reads like a placeholder name next to the role "Account Host".
- Who it hurts: Organizer at a laptop and PTO president. They finished setup and now stall on a page whose main button doesn't work. On a phone, tapping plain text does nothing.
- Standard: Action over information (house), Heuristic 1 (status), 6 (recognition)
- Severity: 3
- Suggested fix: Make the main button "Write to us about a plan" (opens an email with the event name filled in), with "Copy email address" beside it. Below it, say "Once your plan is set, come back here and press Publish. Everything stays saved." Show the disabled Publish button as secondary, not primary. If the person isn't the Account Host, make "Ask [name]" the main action instead.

### Leaving a half-entered shift through "Continue to publish"
- Where: 06 job-edit, all widths; strongest on phone, where the filled primary button sits above the job editor
- What happens: While a new shift is typed but not added, the page offers "Continue to publish" (primary, at the top), "Add this shift", "Save, keep hidden", and a disabled "Mark ready". There are two levels of saving (add the shift, then save the job), and nothing shows whether the typed shift survives a tap on "Continue to publish" or on another job's tab. The phone puts "Mark ready" above "Save, keep hidden", and the desktop puts it to the right, so the order flips.
- Who it hurts: Organizer at a laptop, who assumes typing the times was enough and moves on. PTO president on her phone, who taps the big button at the top.
- Standard: Heuristic 1 (is this saved?), 5 (error prevention), 4 (consistency)
- Severity: 3
- Suggested fix: Hide or soften the "Continue to publish" banner while a job has unsaved changes. Let "Save, keep hidden" also save a filled-in new shift, so one save is enough. Warn before leaving with unsaved changes. Keep the button order the same at every width.

### "Next: add a volunteer job" when the organizer already has two
- Where: 11 ready-none, all widths
- What happens: The headline tells them to add a job, but the body says "You have 2 hidden jobs." What they really need to do is finish one of those jobs and mark it ready. The page doesn't name the jobs or say what each one is missing.
- Who it hurts: PTO president coming back after a few days ("where was I?"). She may add a third job instead of finishing one.
- Standard: Heuristic 2 (match), 6 (recognition), Interruption-proof (house)
- Severity: 2
- Suggested fix: Headline "Next: get a job ready". List each hidden job with what's left ("Litter pickup: add a shift", "Supplies to bring: mark ready") and link straight to it. Use "add a volunteer job" only when there are no jobs.

### The previews don't show what volunteers will see, and the two previews disagree
- Where: 08 preview and 09 preview-lead, all widths
- What happens: The Host preview mixes hidden jobs in with ready ones, so you never see the page exactly as a volunteer will. The lead preview shows Parking with 1 shift where the Host sees 2, drops the "No account needed" line and the Directions link, and says only "you and the event's Hosts" can see the job. 06 says Hosts, Volunteer Directors, and the lead can, and the product rule also includes Co-hosts. The lead's only action is "Close preview", with nothing to tell the organizer it looks good or needs a fix.
- Who it hurts: Organizer at a laptop, who needs to trust what people will see. Volunteer leads, who may report "Parking only has one shift" when that isn't true.
- Standard: Heuristic 1 (status), 4 (consistency)
- Severity: 2
- Suggested fix: Add a switch on the Host preview: "Show hidden jobs" on or off, with off showing exactly the volunteer view. Make the lead preview the same page with the other hidden jobs left out, and nothing else changed. Use one list of who can see hidden jobs everywhere (Hosts, Co-hosts, Volunteer Directors, and the job's lead). Keep the preview banner pinned while scrolling.

### "Sign-up closed" page is a dead end
- Where: 13 live-closed, all widths
- What happens: The page loses everything 12 had: the volunteer count, Manage jobs and shifts, Event settings, View the sign-up page, Unpublish, and Before the day. The copy "can't sign up yet" assumes sign-up was never opened. If the organizer closed it after people signed up, "yet" is wrong and they can't see or reach the people already signed up.
- Who it hurts: Organizer at a laptop and PTO president, who close sign-up when shifts are full and then need to message or adjust volunteers.
- Standard: Heuristic 3 (user control), 4 (consistency), 1 (status)
- Severity: 2
- Suggested fix: Use the 12 layout with only the top card swapped. Change the wording based on history: "Sign-up hasn't opened yet" or "You closed sign-up on [date]. 2 people are signed up."

### Editing a live job doesn't say it's live
- Where: 14 job-live, all widths
- What happens: There's no live badge, step status, or note that saving changes the public page right away. It doesn't say whether the 2 people signed up are told when spots change. Shift times can't be edited, and nothing explains why. The job name field has no save button of its own. "Delete" on the empty shift shows no confirmation or undo.
- Who it hurts: Organizer at a laptop. The page looks like the draft editor, so they may experiment as if nothing were public yet.
- Standard: Heuristic 1 (status), 5 (error prevention), 3 (undo)
- Severity: 2
- Suggested fix: Add a line at the top: "This event is live. Changes show to volunteers as soon as you save." Say whether signed-up people get an email. Explain locked times ("To change times, add a new shift and move people to it"). Offer undo after Delete.

### The jobs editor is built differently on each screen
- Where: 06 vs 07 vs 14, all widths; the job dropdown on phone
- What happens: 06 has the step bar, the "1 ready · 2 hidden" count, and the ready-to-publish banner. 07, which is the same step, has none of them. 14 also has none, which may be on purpose for a live event, but nothing says so. On phone, the job tabs become a dropdown, so you can't see the status of all jobs at once. That's exactly the "what's done, what's left" view an organizer needs.
- Who it hurts: Organizer at a laptop (once a year, forgets how it works) and PTO president on her phone, who can't see at a glance which jobs still need work.
- Standard: Heuristic 4 (consistency), 6 (recognition)
- Severity: 2
- Suggested fix: Use one jobs-page frame for every draft job type (step bar, count, and the ready banner when it applies). On phone, show the jobs as a stacked list of short rows with their status before opening one, not a dropdown.

### "Ready to show volunteers" next to a "Hidden" banner
- Where: 07 job-items, all widths
- What happens: The bottom bar shows a green dot and "Ready to show volunteers", while the banner above says "Hidden: volunteers can't see this job". The tab says "not marked ready". "Ready" means two different things on one screen.
- Who it hurts: Organizer at a laptop, who may read the green "Ready" as done and never press "Mark ready", so the job stays hidden after publishing.
- Standard: Heuristic 4 (same thing, same word), 1 (status)
- Severity: 2
- Suggested fix: Bottom bar text "Everything's filled in. Mark it ready to show volunteers", with no green dot until the job really is ready.

### Unpublish is a quiet link next to a consequence that can't be reversed
- Where: 12 live, "Sign-up and page" panel, all widths
- What happens: The warning that an unpublished event stays offline until a plan is added sits right under a plain "Unpublish" link. No confirmation step appears in the mock-up. On phone, this panel is far down the page, below "Before the day" content.
- Who it hurts: Organizer at a laptop or PTO president, who unpublish to fix something and can't bring the event back.
- Standard: Heuristic 5 (error prevention)
- Severity: 2
- Suggested fix: Unpublish opens a confirmation that repeats the consequence ("This page goes offline, and you can't publish it again without a plan. 2 people are signed up."), with "Keep it online" as the default button.

### Small things on the publish step
- Where: 10 ready, all widths
- What happens: When "Later" is picked, the button still says "Publish and open sign-up" (not shown changing). "Event settings" appears twice, as a top button and as a row in "Before the day". "1 job is hidden (Supplies to bring)" has no link to it (12 does, with "Finish Supplies to bring"). On phone, "Before the day" sits between the summary and the pinned Publish button.
- Who it hurts: Organizer at a laptop
- Standard: Heuristic 4 (consistency), 8 (minimalist)
- Severity: 1
- Suggested fix: Change the button to "Publish, keep sign-up closed" when Later is picked. Drop the duplicate Event settings row. Link the hidden job name, as 12 does.

## Working well
- The event home page doubles as the "where was I?" view, with "2 of 3 steps done", a clear next step, and the draft/live badge (10, 11, 12, 15)
- "What's left: add a shift" in the job save bar tells organizers exactly why "Mark ready" is off (06)
- "Start from a past event" on the empty jobs page, with copies arriving as hidden drafts, serves the PTO president's reuse need (05)
- "When you publish" sets expectations before the click, including "We don't email anyone" and "You can keep editing" (10)
- The live page leads with sharing (Copy link, Copy a message, QR code), which is what the organizer does next (12)
- The spot floor ("At least 2, the number signed up") and the disabled "Hide this job" with a reason carry out the rule in plain words (14)
- The picker banner is honest that setup is open and only publishing is limited, and it gives a response time (01)
- The preview banner leads with "Preview only," and hidden jobs get both a dashed outline and a label, not color alone (08, 09)

Screenshots opened (46): 01 desktop, phone, phone-dark; 02 desktop, phone, tablet, desktop-dark; 03 desktop, phone, tablet-dark; 04 desktop, phone, phone-dark; 05 desktop, phone, desktop-dark; 06 desktop, phone, tablet-dark; 07 desktop, phone, phone-dark; 08 desktop, phone, tablet-dark; 09 desktop, phone, phone-dark; 10 desktop, phone, desktop-dark; 11 desktop, phone, phone-dark; 12 desktop, phone, tablet-dark; 13 desktop, phone, tablet-dark; 14 desktop, phone, phone-dark; 15 desktop, phone, tablet-dark
