# UX Content Manager

## Headline
Most of the copy is short, calm, and plain, and it follows the house rules on exclamation points and the Oxford comma. The biggest problems are words that mean different things on different screens. Role names don't match what the app already calls people. "Ready" means three different things. "Live", "published", and "online" all name one state. One screen also gives the wrong next step. A few lines are not quite honest: "add a plan" and "We don't email anyone".

## Findings

### Role names don't match the app, and "lead" means two different people
- Where: 06 job-edit, the hidden notice and the "Lead" field. 09 preview-lead, the top banner. All widths, both modes.
- What happens: The mock-up says "Volunteer Directors" and "this job's lead". The app already calls the event-wide role "Volunteer Lead" and the person who runs one job "Coordinator" (see `src/lib/event-types.ts` `leadWords`, and `ROLE_LABEL` in `src/app/dashboard/page.tsx`). "Volunteer Director" is the database name and appears nowhere in the app. An existing Volunteer Lead who reads "this job's lead can preview it" will think it means them.
- Who it hurts: The organizer at a laptop and the PTO president hand jobs to other parents. They will invite the wrong person, or not know who can see what.
- Standard: Same thing, same word. No internal words (database names). Heuristic 4, consistency.
- Severity: 3
- Suggested fix: Use the names the app already uses everywhere in this flow.
  - 06 field label: **Before** "Lead" → **After** "Coordinator"
  - 06 field help: **Before** "Leads see who signed up. On event day they also see volunteers' phone numbers and emails." → **After** "Coordinators see who signed up. On event day they also see volunteers' phone numbers and emails."
  - 06 notice: **Before** "It stays hidden until you mark it ready. Your Hosts, Volunteer Directors, and this job's lead can preview it." → **After** "It stays hidden until you mark it ready. Hosts, Co-hosts, Volunteer Leads, and this job's Coordinator can preview it."

### "Who can see this?" has three answers, and none of them matches the rule
- Where: 06 hidden notice. 09 preview-lead banner. The "Draft event: only your team can see it" chip on 05, 10, 11, and 15. All widths, both modes.
- What happens: 06 lists Hosts, Volunteer Directors, and the lead, but leaves out Co-hosts. 09 says "Only you and the event's Hosts can see it", which leaves out Co-hosts and Volunteer Leads. The draft chip says "your team", but no screen says who the team is. The rule is Hosts, Co-hosts, Volunteer Leads, and that job's Coordinator.
- Who it hurts: The organizer, who needs "to trust what people will see". A Coordinator previewing on 09 is told something untrue about who else can see the job.
- Standard: Claims must be accurate ("promises we keep"). Same thing, same word.
- Severity: 3
- Suggested fix: Use one sentence everywhere and keep it accurate.
  - 09: **Before** "Preview only. You're seeing Litter pickup as its lead. Only you and the event's Hosts can see it until it's ready." → **After** "Preview only. Volunteers can't see Litter pickup yet. You can see it because you're its Coordinator."
  - Draft chip: **Before** "Draft event: only your team can see it" → **After** "Draft · Hosts and Co-hosts only". If Volunteer Leads can also see the draft, add them so the list is accurate.

### Screen 11 tells you to add a job you already have
- Where: 11 ready-none, the main card heading. All widths, both modes.
- What happens: The heading says "Next: add a volunteer job", but the line under it says "You have 2 hidden jobs". The real next step is to finish a job and mark it ready. The stepper text "Next: jobs and shifts" is vague too.
- Who it hurts: The teacher with a 30-minute lunch adds a third job she doesn't need. The PTO president, coming back after a break, can't tell what is still missing.
- Standard: Answer first. Action over information. Heuristic 2.
- Severity: 3
- Suggested fix:
  - Heading: **Before** "Next: add a volunteer job" → **After** "Next: mark a job ready"
  - Body: **Before** "To publish, mark at least one job ready with a shift or an item. You have 2 hidden jobs." → **After** "You have 2 hidden jobs. Give one a shift or an item, then mark it ready."
  - Button: **Before** "Go to jobs and shifts" → **After** "Finish a job"
  - Locked card: **Before** "Opens once a job is ready" → **After** "Unlocks when 1 job is ready"
  - Keep "Next: add a volunteer job" only for the case where there are no jobs at all.

### "Add a plan" promises something you can't do yourself
- Where: 15 blocked: the card heading, the stepper, and the "while you wait" text. 12 live, the note under Unpublish. All widths, both modes.
- What happens: "Ready to publish once you add a plan" and "until you add a plan" sound like a button you can press. The only real step is to email us. "While you wait" assumes the person already wrote to us. Per the brief, the honest version should say what actually happens.
- Who it hurts: The organizer and the teacher go looking for an "add a plan" button that doesn't exist. Hosts who aren't the Account Host can't get a plan at all.
- Standard: Claims guardrails, "promises we keep". Buttons and next steps say what happens.
- Severity: 3
- Suggested fix:
  - 15 heading: **Before** "Ready to publish once you add a plan" → **After** "Ready to publish when your account has a plan"
  - 15 notice body: **Before** "The pilot ended Jan 1. Without a plan, you can publish one parent-teacher conference at a time. Everything here is saved. To publish it, write to us at product@fieldcommandevents.com, and we'll reply within a day." → **After** "Everything here is saved. Since the pilot ended Jan 1, publishing a volunteer event needs a plan. Email product@fieldcommandevents.com to ask about one. We reply within a day."
  - 15 side card: **Before** "You can do these now, while you wait" → **After** "You can do these now"
  - 12 note: **Before** "Your plan can't publish volunteer events, so if you unpublish this one it stays offline until you add a plan" → **After** "If you unpublish this event, you can't publish it again without a plan."

### "Ready" means three different things, and once it is simply wrong
- Where: 07 job-items, the save bar. 06 stepper ("Ready to go"). 06 banner ("1 job is ready"). 10 ("Ready to publish"). All widths, both modes.
- What happens: On 07 the job's chip and notice both say "Hidden · not marked ready", but the save bar says "Ready to show volunteers" with a green dot. That reads as if the job is already showing. "Ready" is used for a job's state, for whether the job can be marked ready, and for the publish step.
- Who it hurts: The organizer leaves 07 thinking volunteers can see "Supplies to bring", when they can't.
- Standard: Same thing, same word. Heuristic 1, system status.
- Severity: 3
- Suggested fix: Use "ready" only for a job that volunteers can see.
  - 07 save bar: **Before** "Ready to show volunteers" → **After** "All filled in. Mark it ready to show volunteers"
  - 06 save bar: **Before** "What's left: add a shift" → **After** "Add a shift before you can mark it ready"
  - Stepper, Publish step: **Before** "Ready to go" → **After** "Unlocked"

### "We don't email anyone" isn't true
- Where: 10 ready, the "When you publish" list. All widths, both modes.
- What happens: The page says "We don't email anyone, so share the link yourself". The next card says "Daily email of new sign-ups: On". Screen 12 says "Volunteers get a reminder the day before". The volunteer page says "We only email you about this event". The point was "we don't send the link for you", but it reads as a promise of no email at all. It also has a check mark next to a negative.
- Who it hurts: The organizer, who may tell parents they won't get emails.
- Standard: Claims guardrails (be specific and accurate). Answer first.
- Severity: 3
- Suggested fix:
  - **Before** "We don't email anyone, so share the link yourself" → **After** "We don't send the link for you, so share it in your group text or newsletter"
  - **Before** "You get a link and QR code to share" → **After** "You get a link and a QR code to share"

### The publish button doesn't change when you pick "Later"
- Where: 10 ready, the "When volunteers can sign up" choice and the main button. 15 also shows the disabled button. All widths, both modes.
- What happens: If you pick "Later", the button still says "Publish and open sign-up". The "Later" help text also doesn't say what volunteers see in the meantime.
- Who it hurts: The organizer, who isn't sure whether pressing the button opens sign-up anyway.
- Standard: Buttons say what happens. Heuristic 1.
- Severity: 2
- Suggested fix:
  - Button when "Later" is picked: **Before** "Publish and open sign-up" → **After** "Publish, sign-up closed"
  - Later help: **Before** "The page goes online, and you open sign-up when you're ready" → **After** "People can see the event but can't sign up until you open it"
  - Now help: **Before** "The page goes online and volunteers can sign up" → **After** "People can see the event and sign up right away"

### One state has too many names: live, published, online, open
- Where: 12 live. 13 live-closed. 01 banner ("stay live"). 02 chip. All widths, both modes.
- What happens: The words "Live", "Page is online", "published", "sign-up open", and "jobs open" all name overlapping states. On 13 the chip says "Live · sign-up closed" and the heading says "Your page is online, and sign-up is closed". On 12, "2 jobs open" uses "open" for jobs volunteers can see, while "open" also means sign-up is open.
- Who it hurts: The PTO president and the organizer can't tell at a glance whether parents can sign up right now.
- Standard: Same thing, same word. Answer first.
- Severity: 2
- Suggested fix: Use "Published" for the page and "Sign-up open" or "Sign-up closed" for sign-up.
  - 12 chip: **Before** "Live · sign-up open" → **After** "Published · Sign-up open"
  - 12 heading: **Before** "Your event is live" → **After** "Sign-up is open"
  - 12 side row: **Before** "Page is online" → **After** "Published"
  - 12 side heading: **Before** "Sign-up and page" → **After** "Sign-up"
  - 12 stat: **Before** "2 jobs open" → **After** "2 jobs showing"
  - 13 chip: **Before** "Live · sign-up closed" → **After** "Published · Sign-up closed"
  - 13 heading: **Before** "Your page is online, and sign-up is closed" → **After** "Sign-up is closed"
  - 13 body: **Before** "People can see the event but can't sign up yet. Open sign-up when you're ready." → **After** "People can see the event but can't sign up. Open sign-up when you're ready."

### Screen 02 tells you to take down a live conference
- Where: 02 picker-conf, the conference card chip and the loose links. All widths, both modes.
- What happens: The chip says "Fall conferences is live. Unpublish it to publish another." That tells a teacher to pull a page families are using to book. It also doesn't mention that the limit applies only to one-time conferences, not weekly ones. The loose "Set up →" next to "Go to Fall conferences" doesn't say what it sets up. The pilot banner from 01, which explains the limit, is missing here.
- Who it hurts: The teacher with a 30-minute lunch could follow the instruction and cancel bookings.
- Standard: Error prevention. Answer first. Buttons say what happens.
- Severity: 2
- Suggested fix:
  - Chip: **Before** "Fall conferences is live. Unpublish it to publish another." → **After** "Fall conferences is published. You can publish another after it ends."
  - Links: **Before** "Go to Fall conferences" / "Set up →" → **After** "Open Fall conferences" / "Set up a draft conference"
  - Keep the 01 banner on this screen.

### Spot and delete rules on a live job are hard to read
- Where: 14 job-live, the shift editor and the "Hide this job" note. All widths, both modes.
- What happens: The help "At least 2, the number signed up" is a compressed fragment. "Move or remove the 2 people" doesn't say where to move them or how. The shift row "2 signed up · 4 spots" doesn't say how many spots are left. The two notes also differ on end punctuation: one has no period, the other does.
- Who it hurts: The organizer, who is changing a live job that parents have already signed up for.
- Standard: Errors help (say what to do). Short and plain. House rule on periods.
- Severity: 2
- Suggested fix:
  - Spots help: **Before** "At least 2, the number signed up" → **After** "2 people signed up, so you can't go below 2"
  - Row: **Before** "2 signed up · 4 spots" → **After** "2 of 4 spots filled"
  - Delete note: **Before** "To delete this shift, move or remove the 2 people signed up first" → **After** "2 people signed up for this shift. Move them to another shift before you delete it."
  - Hide note: **Before** "2 people are signed up. Move or remove them before hiding this job." → **After** "You can't hide this job while 2 people are signed up for it."

### Error banner and save bar use different words for the same thing
- Where: 04 details-errors, the banner and the save bar. 03 details, the save bar. All widths, both modes.
- What happens: The banner says "Add 2 more things", while the save bar and the intro say "boxes". "To save this event" doesn't make it clear that nothing has been saved yet.
- Who it hurts: The teacher who is called away mid-form. She needs to know whether her work is saved.
- Standard: Same thing, same word. Errors say what to fix.
- Severity: 2
- Suggested fix:
  - Banner: **Before** "Add 2 more things to save this event" / "Starts and Ends are marked below" → **After** "Not saved yet: add a start and end time" / "They're marked below"
  - Device note: **Before** "If you need to stop now, what you've typed stays on this device until you come back" → **After** "If you stop now, what you've typed stays on this device only"

### "Save, keep hidden" and the job chips are awkward
- Where: 06, 07, and 14, the save bar and the job chips. The phone job picker reads "Hidden, add a shift" while the chip reads "Hidden · add a shift". All widths, both modes.
- What happens: "Save, keep hidden" reads like two commands. "Hidden · not marked ready" says the same thing twice.
- Who it hurts: The organizer, who scans the chips to see what is left.
- Standard: Buttons are a verb plus an object. Cut words that don't help.
- Severity: 2
- Suggested fix:
  - **Before** "Save, keep hidden" → **After** "Save as hidden"
  - **Before** "Hidden · not marked ready" → **After** "Hidden · ready to mark"
  - **Before** "Hidden · add a shift" → **After** "Hidden · needs a shift"
  - Use the same text in the phone picker.

### "Draft" means both an event and a job
- Where: 05 jobs-empty, the "Start from a past event" card. All widths, both modes.
- What happens: "They arrive as hidden drafts for you to check" puts the event's word, "draft", on jobs. Everywhere else, jobs are "hidden" or "ready".
- Who it hurts: The PTO president reusing last year's event.
- Standard: Same thing, same word.
- Severity: 2
- Suggested fix: **Before** "Copy jobs and shifts from Spring Carnival 2026. They arrive as hidden drafts for you to check." → **After** "Copy jobs and shifts from Spring Carnival 2026. They come in hidden, so you can check them first."

### The live page's "what happens next" list is unclear
- Where: 12 live, the share buttons and the "What happens next" list. 10 "Event day" card. All widths, both modes.
- What happens: "Copy a message" doesn't say what kind of message. "Check-in opens Fri, Feb 5 at 6 PM" sounds like volunteers check in on Friday. On 10 the same item reads "Check-in, badges, and messages open". The email line suggests an email arrives every morning.
- Who it hurts: The organizer and the PTO president.
- Standard: Plain words. Buttons say what happens. Same thing, same word.
- Severity: 2
- Suggested fix:
  - **Before** "Copy a message" → **After** "Copy a ready-to-send text"
  - **Before** "You get an email each morning when people sign up" → **After** "You get a morning email on days with new sign-ups"
  - **Before** "Check-in opens Fri, Feb 5 at 6 PM" → **After** "Your event-day check-in screen opens Fri, Feb 5 at 6 PM"
  - 10: **Before** "Check-in, badges, and messages open Fri, Feb 5 at 6 PM" → **After** "Your event-day check-in screen opens Fri, Feb 5 at 6 PM"

### Volunteer-facing preview text is unclear
- Where: 08 preview and 09 preview-lead, the Parking card. All widths, both modes.
- What happens: "4 spots" doesn't say whether that's the total or how many are left. "North lot" has no label, so a parent can't tell whether it's where to park or where to check in.
- Who it hurts: The volunteer parent on a phone, who has two minutes.
- Standard: Plain words. Answer first.
- Severity: 2
- Suggested fix:
  - **Before** "4 spots" → **After** "4 spots left"
  - **Before** "North lot" → **After** "Check in: North lot"

### The pilot banner and picker don't fully state the rule
- Where: 01 picker, the banner and the conference card. All widths, both modes.
- What happens: The banner says "one parent-teacher conference at a time" but doesn't say it must be a one-time conference, not a weekly one. It leads with "Your published events stay live", which isn't the main news. The conference chip "You can publish one at a time" also leaves out "one-time".
- Who it hurts: The teacher, who may set up a weekly conference and find she can't publish it.
- Standard: Answer first. Promises we keep.
- Severity: 2
- Suggested fix:
  - Banner body: **Before** "Your published events stay live. Without a plan, you can publish one parent-teacher conference at a time. You can still set up any kind of event. To publish other kinds, write to us at product@fieldcommandevents.com, and we'll reply within a day." → **After** "Without a plan, you can publish one one-time parent-teacher conference at a time. You can still set up any kind of event, and your published events stay up. To ask about a plan, email product@fieldcommandevents.com. We reply within a day."
  - Conference chip: **Before** "You can publish one at a time" → **After** "Publish one one-time conference"

### Sample name "Hana Host" reads like a role
- Where: 15 blocked, the notice footer. All widths, both modes.
- What happens: "Ask Hana Host, who manages this account" reads as "Hana, the Host" next to the role name "Account Host".
- Who it hurts: The owner, when judging the mock-up. Real users won't see it if real names are used.
- Standard: none (sample data)
- Severity: 1
- Suggested fix: **Before** "Not the Account Host? Ask Hana Host, who manages this account." → **After** "Not the Account Host? Ask Hana Patel, who manages this account."

### The step header repeats itself, and help text uses an internal name
- Where: 03 details, the step header and the footer note. All widths, both modes.
- What happens: "Step 1 of 3: Details", "Next, you'll add volunteer jobs and shifts", and "Now / Next / Last" all say the same thing. "Pick a time" under "Starts" and "Ends" repeats the label. "Event settings" is a screen name that new users won't know.
- Who it hurts: The teacher, who has to read more than she needs to.
- Standard: Cut every word that doesn't help. Plain words.
- Severity: 1
- Suggested fix:
  - Delete "Next, you'll add volunteer jobs and shifts" (the stepper already shows it).
  - Delete the "Pick a time" hints.
  - **Before** "Your team, emails, and maps can wait. They're in Event settings when you're ready." → **After** "You can add your team, emails, and maps later, from Event settings."

## Working well
- Error copy on 04 sits next to each field and says exactly what to do ("Pick a start time").
- The "Preview only" bar on 08 and 09 says plainly that volunteers can't see the page, and every hidden job says "Hidden from volunteers" in words, not just a dashed outline.
- "Volunteers can't see this job" (06 and 07) leads with the effect, not with the status name.
- Coordinator privacy is stated up front: "On event day they also see volunteers' phone numbers and emails".
- "Everything here is saved" on 15 and "You can keep editing after you publish" on 10 answer the organizer's real worries.
- No exclamation points anywhere, the Oxford comma is used throughout, "sign-up" and "sign up" are used correctly, and the response-time promise ("within a day") matches the brand guardrail.
- "No account needed. We only email you about this event." on 08 follows the claims guardrail well.

Screenshots opened: 01 desktop, phone, phone-dark; 02 desktop, phone, desktop-dark; 03 desktop, phone, tablet-dark; 04 desktop, phone, phone-dark; 05 desktop, phone, desktop-dark; 06 desktop, phone, phone-dark; 07 desktop, phone, desktop-dark; 08 desktop, phone, phone-dark; 09 desktop, phone, tablet-dark; 10 desktop, phone, desktop-dark; 11 desktop, phone, phone-dark; 12 desktop, phone, desktop-dark; 13 desktop, phone, phone-dark; 14 desktop, phone, desktop-dark; 15 desktop, phone, tablet-dark (45 total). Also read `src/lib/event-types.ts`, plus role labels in `src/app/dashboard/page.tsx` and `src/app/dashboard/events/[eventId]/team/team-roles.tsx`.
