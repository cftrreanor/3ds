# UX Content Manager

## Headline
Most of the copy is calm and plain, and it follows the house rules: no exclamation points, the Oxford comma throughout, "sign-up" and "sign up" used correctly, and honest wording about what we do and don't email. The two biggest problems are both about consistency. The screens disagree about whether work is saved, and one job state goes by three names ("ready", "ready to mark", "showing"). Several smaller lines need a plainer rewrite, mostly on the plan-ended screens and the Volunteer Lead screen.

## Findings

### The save messages contradict each other
- Where: 04 details (subtitle); 07 job-edit (save bar); 08 job-items (green banner and save bar); 18 job-live (save bar). All widths, both modes
- What happens: 04 promises "We save as you go, so you can stop any time and pick up on any device". Then 07 says "Unsaved changes" and offers "Save as hidden". On 08 the banner says "All changes saved." but the save bar still offers "Save as hidden", which suggests something is still unsaved. On 18 the bar says "All changes saved · Last saved by Dee Nguyen, 8:14 PM" while a shift edit is open with its own "Save shift" button
- Who it hurts: the organizer at a laptop and the PTO president, who both need to know "is this saved?" before they close the laptop. The teacher with 30 minutes can't trust the message, so she may lose work or redo it
- Standard: Heuristic 1 (visibility of system status), "same thing, same word", interruption-proof
- Severity: 3
- Suggested fix: use one save story everywhere, and make the bar describe what's actually on screen
  - 04 subtitle. Before: "We save as you go, so you can stop any time and pick up on any device" → After: "Your details save as you type. Stop any time and pick up on any device"
  - 07 save bar. Before: "Unsaved changes · add a shift before you can mark it ready" with "Save as hidden" → After: "Not saved yet · Add a shift before you can mark this job ready" with "Save and keep hidden"
  - 08 save bar (nothing left to save). Before: "All filled in. Mark it ready to show volunteers." with "Save as hidden" and "Mark ready" → After: "Saved and hidden · Mark it ready to show volunteers" with only "Mark ready" (drop "Save as hidden")
  - 18 save bar while a shift is open. Before: "All changes saved · Last saved by Dee Nguyen, 8:14 PM" → After: "Shift change not saved yet · Last saved by Dee Nguyen, 8:14 PM"

### One job state goes by three names
- Where: 07, 08, and 18 job chips ("Hidden · ready to mark"); 13 ready-none ("All filled in, ready to mark", "Mark it ready"); 15 live ("1 job showing"); 08 save bar ("Mark ready")
- What happens: one state is called "ready" in one place, "showing" in another, and "ready to mark" for a hidden job that's finished. "Hidden · ready to mark" reads like "ready" is the status, which turns the chip into a contradiction. The button is "Mark ready" on 08 and "Mark it ready" on 13
- Who it hurts: the organizer, who sets up an event once a year and has to work out whether "ready", "showing", and "ready to mark" are different things
- Standard: same thing, same word; Heuristic 4 (consistency)
- Severity: 2
- Suggested fix: "Ready" means volunteers can see the job, everywhere, and "Hidden" is its only opposite
  - Chip. Before: "Hidden · ready to mark" → After: "Hidden · all filled in"
  - 13 row. Before: "All filled in, ready to mark" → After: "All filled in"
  - 13 button. Before: "Mark it ready" → After: "Mark ready"
  - 15 stat. Before: "1 / job showing" → After: "1 / job ready"

### The Draft badge is unclear, incomplete, and too long for a phone
- Where: 06 jobs-empty, 12 ready, 13 ready-none, 14 ready-vlead, 21 blocked. At phone width the badge runs past the right edge of the screen (light and dark)
- What happens: "Draft · Hosts, Co-hosts, and Volunteer Leads only" doesn't say what's limited: seeing it, editing it, or publishing it. It's also incomplete, because 11 shows that a job's Coordinator can preview it too
- Who it hurts: the organizer and the PTO president, who want to know whether parents can see this yet. That's the one thing the badge should answer
- Standard: answer first; plain words; claims must be accurate
- Severity: 2
- Suggested fix. Before: "Draft · Hosts, Co-hosts, and Volunteer Leads only" → After: "Draft · Volunteers can't see it yet" (short enough for one line at 390 px)

### The Volunteer Lead message leaves out Co-hosts and never says "you can't"
- Where: 14 ready-vlead, info box and button, all widths
- What happens: "A Host publishes this event. Let Hana Patel know it's ready." reads like a description, not a limit. It also leaves out Co-hosts, who can publish too. The heading "Ready to publish" tells a Volunteer Lead to do something they're not allowed to do. "Copy a note for Hana" doesn't say where the note goes
- Who it hurts: the PTO president handing work to another parent. The Volunteer Lead waits on the wrong person or hunts for a Publish button
- Standard: answer first; accuracy (the rule says Hosts and Co-hosts can publish)
- Severity: 2
- Suggested fix
  - Heading. Before: "Ready to publish" → After: "Ready for a Host to publish"
  - Info box. Before: "A Host publishes this event. Let Hana Patel know it's ready." → After: "Only a Host or Co-host can publish. Let Hana Patel know it's ready."
  - Button. Before: "Copy a note for Hana" → After: "Copy a message for Hana"

### "Unpublish", "Take it offline", and "Keep it online" name one action three ways
- Where: 15 live and 17 live-closed ("Unpublish" button); 16 unpublish dialog, all widths
- What happens: the button says "Unpublish", but the dialog asks "Take Cedar Ridge Campus Clean-up offline?" and offers "Keep it online" and "Take it offline". The body has a three-clause sentence, and "their links" is vague. "While your Volunteer Command plan is active" sounds like a hidden condition
- Who it hurts: the organizer, who is making a risky choice and has to translate between word pairs to be sure it's the same action
- Standard: same thing, same word; buttons say what happens; short sentences
- Severity: 2
- Suggested fix
  - Title. Before: "Take Cedar Ridge Campus Clean-up offline?" → After: "Unpublish Cedar Ridge Campus Clean-up?"
  - Body 1. Before: "2 volunteers are signed up. Their links stop working, and we don't email them, so tell them yourself." → After: "2 volunteers are signed up. Their sign-up links will stop working. We won't email them, so let them know yourself."
  - Body 2. Before: "You can publish it again later while your Volunteer Command plan is active." → After: "You can publish it again any time you have a Volunteer Command plan."
  - Buttons. Before: "Keep it online" / "Take it offline" → After: "Keep it published" / "Unpublish"

### The plan-ended picker has a stutter, a grammar slip, and buried timing
- Where: 03 picker-ended, notice box and conferences card, all widths
- What happens: "Without a plan, you can publish one one-time parent-teacher conference at a time" reads as a tongue-twister ("one one-time … at a time"). The chip "Fall conferences runs until Feb 12" sounds like a grammar error, because "Fall conferences" reads as a plural rather than an event name. The card body "You can set up another one now and publish it after Feb 12." is fine, but it repeats the date
- Who it hurts: the teacher with a 30-minute lunch who needs to know right away whether she can run conferences this term
- Standard: plain words, short sentences, answer first
- Severity: 2
- Suggested fix
  - Notice. Before: "Your published events stay up. You can still set up any kind of event. Without a plan, you can publish one one-time parent-teacher conference at a time." → After: "Your published events stay up, and you can still set up any kind of event. Without a plan, you can publish parent-teacher conferences one at a time. Weekly conferences need a plan."
  - Chip. Before: "Fall conferences runs until Feb 12" → After: "Published: Fall conferences, until Feb 12"
  - Card body. Before: "You can set up another one now and publish it after Feb 12." → After: "Set up the next one now. You can publish it once Fall conferences ends."

### Details form: "boxes" and red asterisks suggest you can't save yet
- Where: 04 details, status bar and required markers, all widths
- What happens: Date, Starts, Ends, and Where all carry red required asterisks, which usually means "you can't save without this". In fact only the name is needed to save. "2 boxes left to publish: Starts and Ends" uses "boxes", which is form-builder language
- Who it hurts: the teacher who doesn't have the times on hand yet and thinks she can't stop here, and the organizer who isn't sure what blocks what
- Standard: plain words; Heuristic 2 (match with the real world)
- Severity: 2
- Suggested fix
  - Add one line above the form. After: "* Needed to publish. Only the name is needed to save."
  - Status bar. Before: "Saved as a draft · 2 boxes left to publish: Starts and Ends" → After: "Saved as a draft · To publish, add a start and end time"

### "Later" sign-up option: vague "open it" and a button that doesn't change
- Where: 12 ready, "When can volunteers sign up?" and the main button, all widths
- What happens: "Later" says "People can see the event but can't sign up until you open it". "It" could mean the event or sign-up. The main button still reads "Publish and open sign-up" when "Later" is picked, which is the opposite of what will happen
- Who it hurts: the organizer, who can't trust the button to match the choice they just made
- Standard: buttons say what happens; Heuristic 1
- Severity: 2
- Suggested fix
  - Before: "People can see the event but can't sign up until you open it" → After: "People can see the event, but sign-up stays closed until you open it"
  - Button when "Later" is picked. Before: "Publish and open sign-up" → After: "Publish, keep sign-up closed"

### The spots error states the rule but not the fix, in different words than the hint
- Where: 19 job-live-error, error above the Spots box; compare the 18 hint. All widths, both modes
- What happens: the hint on 18 says "2 people signed up, so you can't go below 2". The error on 19 says "2 people signed up, so spots can't be lower than 2". Neither starts with what to type
- Who it hurts: the organizer fixing a mistake. It's minor, but errors should lead with the fix
- Standard: "Errors help" (say what to do); WCAG 3.3.3
- Severity: 2
- Suggested fix
  - 18 hint. Before: "2 people signed up, so you can't go below 2" → After: "2 people are signed up, so the lowest you can go is 2"
  - 19 error. Before: "2 people signed up, so spots can't be lower than 2" → After: "Enter 2 or more. 2 people are already signed up."

### "Email us about a plan" is worded differently on each screen
- Where: 03 picker-ended (button, address, and reply time); 05 details-ended (inline link only, no reply time); 21 blocked (button, "Copy our email address", address, and reply time); 21 sidebar link "Open"
- What happens: the placeholder is honest, and "we reply within a day" fits the claims guardrails. But 05 leaves out the reply time and the address. On 21, "Open" next to "Finish hidden jobs" clashes with "Open sign-up" elsewhere in the app
- Who it hurts: the organizer who hits the plan limit partway through setup and doesn't know what to expect after emailing
- Standard: same thing, same word; claims guardrails (honest response times, stated the same way everywhere)
- Severity: 1
- Suggested fix
  - 05 banner. Before: "You can set this up now. Publishing a volunteer event needs a plan. Email us about a plan" → After: "You can set this up now. Publishing a volunteer event needs a plan. Email us about a plan, and we'll reply within a day"
  - 21 sidebar. Before: "Finish hidden jobs · Open" → After: "Finish hidden jobs · Go to jobs"
  - 21 heading. Before: "Ready to publish when your account has a plan" → After: "Ready to publish once you have a plan"

### Picker: "more" twice, a mismatched button, and a vague claim
- Where: 01, 02, and 03 picker, the "Interested in more?" bar and the 02 cards. Phone: the bar wraps as "Interested in more? 4 / more kinds of event to try", which leaves "4" alone at the end of a line
- What happens: "more" appears twice in one line. The 02 intro switches from "these" to "it" ("Try any of these: set it up and preview it"). The card "Choir, orchestra, or group festival" has the button "Try a group festival". "On a schedule built for you" is a soft claim
- Who it hurts: the band director, who skims for his event type. It's minor but adds noise
- Standard: short; same thing, same word; claims guardrails (specific claims only)
- Severity: 1
- Suggested fix
  - Bar. Before: "Interested in more? 4 more kinds of event to try" → After: "Interested in more? Try 4 other kinds of event"
  - 02 intro. Before: "Try any of these: set it up and preview it. Publishing needs a plan that includes it." → After: "You can set up and preview any of these. To publish one, you need a plan that includes it."
  - Choir card body. Before: "Groups move through your rooms on a schedule built for you" → After: "Groups move through your rooms on a set schedule"
  - Choir button. Before: "Try a group festival" → After: "Try a festival"

### Card descriptions mix sentence periods with fragments
- Where: 01, 02, and 03 picker, "Parent-teacher conferences" card
- What happens: "A one-time conference day. Families book a time in person, on video, or by phone." uses periods. Every other card's description is a fragment with no period
- Who it hurts: nobody is blocked; it just looks inconsistent
- Standard: brand voice (no periods on incomplete sentences; consistent mechanics)
- Severity: 1
- Suggested fix. Before: "A one-time conference day. Families book a time in person, on video, or by phone." → After: "One conference day, with families booking in person, on video, or by phone"

### Preview banner uses design jargon ("dashed")
- Where: 10 preview, top banner, all widths
- What happens: "Preview only. Volunteers can't see hidden jobs (dashed)." asks the reader to decode a border style
- Who it hurts: the organizer checking what parents will see
- Standard: plain words; no internal or design words
- Severity: 1
- Suggested fix. Before: "Preview only. Volunteers can't see hidden jobs (dashed)." → After: "Preview only. Volunteers won't see jobs marked Hidden from volunteers."

### Next-step screen says "Next" twice and "Unlocks"
- Where: 13 ready-none, step line, card heading, and Publish card
- What happens: "1 of 3 steps done. Next: get a job ready" sits right above "Next: mark a job ready", and the two lines use different verbs. "Unlocks when 1 job is ready" is game-like software language
- Who it hurts: the organizer, who reads the same instruction twice in two versions
- Standard: short; same thing, same word; plain words
- Severity: 1
- Suggested fix
  - Heading. Before: "Next: mark a job ready" → After: "Mark a job ready"
  - Step line. Before: "Next: get a job ready" → After: "Next: mark a job ready"
  - Publish card. Before: "Unlocks when 1 job is ready" → After: "You can publish once a job is ready"

### Empty state and copy-from-past text run long
- Where: 06 jobs-empty, "Add your first job" and "Start from a past event", all widths
- What happens: "A job is a way to help, like parking or picking up litter, or a list of things to bring, like water and trash bags." nests two "like" clauses in one sentence. "They come in hidden" is insider shorthand
- Who it hurts: the PTO president reading in the car line
- Standard: short; one idea per sentence; plain words
- Severity: 1
- Suggested fix
  - Before: "A job is a way to help, like parking or picking up litter, or a list of things to bring, like water and trash bags. Volunteers pick a shift or an item." → After: "A job is a way to help, like parking or litter pickup. It can also be a list of things to bring, like water. Volunteers pick a shift or an item."
  - Before: "Pick an event, and we copy its jobs and shifts to the new date. They come in hidden, so you can check them first." → After: "Pick an event, and we'll copy its jobs and shifts to the new date. Copied jobs start hidden, so you can check them first."

### "Copy a ready-to-send text" is ambiguous
- Where: 15 live, Sign-up is open card, all widths
- What happens: "text" could mean a text message or just words. "Ready-to-send" adds hyphenated filler
- Who it hurts: the organizer, who isn't sure whether this sends an SMS
- Standard: buttons say what happens; plain words
- Severity: 1
- Suggested fix. Before: "Copy a ready-to-send text" → After: "Copy a message to share"

## Working well
- "No account needed. We only email you about this event." on the sign-up preview matches the brand's "no ads, no spam" guardrail in plain words
- "We don't send the link for you, so share it in your group text or newsletter" (12) and "we don't email them, so tell them yourself" (16) are honest about what we don't do
- The 11 Coordinator banner, "Volunteers can't see Litter pickup yet. You can, because you're its Coordinator.", is a model preview message: it gives the answer and the reason
- The 18 limits explain themselves: "You can't hide this job while 2 people are signed up for it. See who" gives the reason and the next step
- The 19 connection error is right: "Couldn't save. Check your connection, then try again. Your changes are still here."
- The 20 consequence line, "Moving someone emails them their new shift…", tells the organizer what volunteers will receive
- "sign-up" (noun) and "sign up" (verb) are correct everywhere I looked. There are no exclamation points, and the Oxford comma is used throughout
- "we reply within a day" stays inside the claims guardrails

## Screenshots opened
01-picker-desktop, 01-picker-phone, 01-picker-tablet-dark, 02-picker-more-desktop, 02-picker-more-phone, 02-picker-more-desktop-dark, 03-picker-ended-desktop, 03-picker-ended-phone, 03-picker-ended-tablet-dark, 04-details-desktop, 04-details-phone, 04-details-phone-dark, 05-details-ended-desktop, 05-details-ended-phone, 05-details-ended-desktop-dark, 06-jobs-empty-desktop, 06-jobs-empty-phone, 06-jobs-empty-tablet-dark, 07-job-edit-desktop, 07-job-edit-phone, 07-job-edit-tablet-dark, 08-job-items-desktop, 08-job-items-phone, 08-job-items-desktop-dark, 09-job-multiday-desktop, 09-job-multiday-phone, 09-job-multiday-phone-dark, 10-preview-desktop, 10-preview-phone, 10-preview-desktop-dark, 11-preview-coord-desktop, 11-preview-coord-phone, 11-preview-coord-tablet-dark, 12-ready-desktop, 12-ready-phone, 12-ready-tablet-dark, 13-ready-none-desktop, 13-ready-none-phone, 13-ready-none-desktop-dark, 14-ready-vlead-desktop, 14-ready-vlead-phone, 14-ready-vlead-phone-dark, 15-live-desktop, 15-live-phone, 15-live-tablet-dark, 16-unpublish-desktop, 16-unpublish-phone, 16-unpublish-desktop-dark, 17-live-closed-desktop, 17-live-closed-phone, 17-live-closed-tablet-dark, 18-job-live-desktop, 18-job-live-phone, 18-job-live-desktop-dark, 19-job-live-error-desktop, 19-job-live-error-phone, 19-job-live-error-phone-dark, 20-shift-people-desktop, 20-shift-people-phone, 20-shift-people-tablet-dark, 21-blocked-desktop, 21-blocked-phone, 21-blocked-desktop-dark (63)
