# UX Content Manager

## Headline
Most of the copy is calm, plain, and on-voice. The "When you publish" list and the time zone help are the best writing in the flow. The big problem is naming. "Sign-up" means three different things, shifts are also called "time slots", leads are also "Coordinators" and "Volunteer Leads", and the flow has two setup lists that count steps differently. An organizer who sets up one event a year will not remember which word means what. Most other issues are small: error messages that don't use the field's name, a few confusing sentences, and house-rule slips (periods, ampersands, Title Case). All of these copy issues appear at every width and in both modes unless marked otherwise.

## Findings

### "Sign-up" means three different things
- Where: Event page checklist "Add volunteer sign-ups and shifts" (src/lib/setup-checklist.ts:172), "5 sign-ups · 4 shifts" (Volunteers card), "Open volunteer sign-up" (setup-checklist.ts:215), Volunteer Setup "Publish and open sign-ups", the "Volunteer sign-ups" heading and its definition (src/app/dashboard/events/[eventId]/volunteering/page.tsx:310), "+ Add sign-up", "Save sign-up", "Delete sign-up", and the "Sign-up link"
- What happens: The same word is used for (a) a job or station like Parking, (b) the public form people use, and, under the house rules, (c) one person's registration ("your sign-up"). "Publish and open sign-ups" reads as if it opens the Parking and Water Station items. "Delete sign-up" could mean removing one volunteer. The page has to define the word in a paragraph ("Each sign-up is a job, a place, or a list of things to bring"), which shows the word isn't doing its job.
- Who it hurts: Organizer at a laptop and PTO president, who come back weeks later and have to work out the meaning again. Teacher with 30 minutes, who has no time to read definitions.
- Standard: Same thing, same word. Heuristic 2 (match with the real world). brand-voice.md "Sign-up" rule (noun = a person's sign-up)
- Severity: 3
- Suggested fix: Call the job a **job**. Keep "sign-up" for the form and for a person's registration.
  - "Add volunteer sign-ups and shifts" → "Add volunteer jobs and shifts"
  - "5 sign-ups · 4 shifts" → "5 jobs · 4 shifts"
  - "Volunteer sign-ups" (heading) → "Volunteer jobs"
  - "Each sign-up is a job, a place, or a list of things to bring, like Parking, Concessions, or a potluck. People sign up for its time slots or its items." → "Each job is a place to help or a list of things to bring, like Parking, Concessions, or a potluck. Volunteers sign up for a shift or an item."
  - "+ Add sign-up" → "+ Add job"; "Save sign-up" → "Save job"; "Delete sign-up" → "Delete job"
  - "Publish and open sign-ups" → "Publish and open volunteer sign-up"
  - Item-to-bring hint "e.g. Potluck, Bake Sale, Supply Drive" stays (forms.tsx:631). Only the noun changes.
  - "What do people sign up for?" stays. It uses the verb correctly.

### Shifts are also called "time slots"
- Where: Volunteer Setup: "Time slots" heading, "Edit time slot", "Time slots / People sign up for a time", "first delete this sign-up's time slots", versus "Morning shift", "Redo or add shifts", "Adults only ... this sign-up's shifts", the checklist's "sign-ups and shifts", and the event page's "Needs people · Morning shift" (src/app/dashboard/events/[eventId]/station-panel.tsx:221, 356)
- What happens: One block on one screen uses both words. An organizer can't tell whether a time slot and a shift are different things.
- Who it hurts: Organizer at a laptop, and the PTO president picking up where she left off
- Standard: Same thing, same word. Heuristic 4 (consistency)
- Severity: 2
- Suggested fix: Use "shift" everywhere for volunteer jobs. It's the word parents say.
  - "Time slots" (heading) → "Shifts"
  - "Edit time slot" → "Edit shift"
  - Radio "Time slots / People sign up for a time, like setting up from 5 to 6 PM" → "Shifts / Volunteers pick a time, like setup from 5 to 6 PM"
  - "To switch to items to bring, first delete this sign-up's time slots." → "To switch to items to bring, delete this job's shifts first."
  - "Redo or add shifts" → "Add or replace shifts"

### Leads have three names: Coordinator, lead, and Volunteer Lead
- Where: Volunteer Setup "Coordinators" field, chip "Pat Kim (Coordinator)", badge "You lead this", saved line "Volunteer Lead Lee Lead saved this", event page "You lead Parking...", "What I lead", checklist hint "Co-hosts and leads who help you run the day." (setup-checklist.ts:182), type picker "volunteer shifts with Coordinators" (src/lib/event-types.ts:33). The plan (S2Event "Next step") says "invite your Volunteer Leads".
- What happens: The same role appears as "Coordinator" (capitalized, like a permission level), "lead", and "Volunteer Lead". A Host can't tell if a Coordinator and a Volunteer Lead are the same thing or have different access.
- Who it hurts: Organizer and PTO president, who hand jobs to other parents and need to know what each person can see (phone numbers)
- Standard: Same thing, same word. Heuristic 4
- Severity: 2
- Suggested fix: Pick one word and use it everywhere. "Lead" is short and already used in "You lead this" and "What I lead". If it's a permission level, capitalize it the same way as "Host" and "Co-host".
  - "Coordinators" (field label) → "Leads"
  - "Pat Kim (Coordinator)" → "Pat Kim (Lead)"
  - "They see who's signed up, and volunteers' phone numbers on event day. Volunteers contact the first one." → "Leads see who signed up. On event day they also see volunteers' phone numbers. Volunteers contact the first lead listed."
  - "volunteer shifts with Coordinators" → "volunteer shifts with a lead for each"
  - Saved-by line "Volunteer Lead Lee Lead" → "Lead Lee Lead". Use whatever role word you choose.

### Two setup lists that count and name the steps differently
- Where: New event form "Step 1 of 5" with tabs "Event details · Team setup · Email settings · Maps & documents (optional) · Publishing & more (optional)" (src/app/dashboard/events/_components/setup-steps.tsx:9-14, 47). Event page checklist "1 of 3 needed to publish": "Add volunteer sign-ups and shifts", "Publish your event", "Open volunteer sign-up", "Add the date, time, and place", "Invite your team" (setup-checklist.ts). Event settings sidebar: "Team setup / Optional", "Email settings / Default", "Publishing & more / Draft".
- What happens: The wizard says there are 5 steps and never mentions shifts, which are the main job of a volunteer event. The event page says 3 are needed. The same task is called "Team setup" in one place and "Invite your team" in another, and "Maps & documents" in one place and "Add maps or documents" in another. "1 of 3 needed to publish" is a count without a noun.
- Who it hurts: Organizer ("what's left?"), PTO president ("where was I?"), teacher (can't judge whether it fits in a lunch break)
- Standard: Heuristic 1 (visibility of status), Heuristic 4. Same thing, same word
- Severity: 3
- Suggested fix: Give each step one name and use it in both places. Always say what is being counted.
  - "1 of 3 needed to publish" → "1 of 3 steps done before you can publish"
  - Sidebar "Team setup / Optional" → "Invite your team / Optional"
  - Sidebar "Maps & documents / 2 files" → "Maps and documents / 2 files"
  - Sidebar "Publishing & more / Draft" → "Publishing and more / Not published"
  - Sidebar "Email settings / Default" → "Email settings / Not changed"
  - Wizard intro "Step 1 of 5." → "Step 1 of 5: the basics. You'll add volunteer jobs and shifts after this."

### Error messages don't use the field's name
- Where: New event form and Event settings. Errors are built as "label: message" from a separate list of names (src/app/dashboard/actions.ts:25, 42-62, 144-147)
- What happens: An empty Venue address shows "Venue: Required". An empty Event name shows "Name: Required". If the times are in the wrong order, the message is "End time must be after the start time", but the fields are called "Gates open / first volunteers arrive" and "Everything wraps up". "Required" doesn't say what to do.
- Who it hurts: Organizer and teacher, who have to work out which box is wrong
- Standard: Errors say what's wrong and how to fix it (WCAG 3.3.1, 3.3.3). Labels match (2.5.3)
- Severity: 3
- Suggested fix: Name the field as the screen does, and say what to do.
  - "Venue: Required" → "Add the venue address, so volunteers know where to go"
  - "Name: Required" → "Add an event name"
  - "End time must be after the start time" → "\"Everything wraps up\" needs to be later than \"Gates open\""
  - "End date can't be before the start date" → "Pick an end date on or after the start date"
  - Labels list: change "name" from "Name" to "Event name", "venueAddress" from "Venue" to "Venue address", "startTime" from "Start time" to "Gates open", and "endTime" from "End time" to "Everything wraps up"

### The plan banner and the type picker disagree
- Where: Home banner "Your free period ended Oct 20, 2026. Events you've already published stay live, and you can publish parent-teacher conferences." (src/app/dashboard/page.tsx:624). Type picker: "Volunteer event" and "Meetings" have no "Not in your plan" badge. Only Parent-teacher conferences is marked "Free".
- What happens: The banner says only conferences can be published. The picker leaves Volunteer event and Meetings unmarked. If they can't be published, an organizer could spend an evening setting up an event they can't publish. If they can, the banner is wrong. In both cases one of the two messages is untrue.
- Who it hurts: Organizer and PTO president, who lose work. Teacher, who has no time to waste.
- Standard: Claims guardrails ("Promises we keep"). Heuristic 5 (error prevention)
- Severity: 3
- Suggested fix: Make both messages say the same thing, and say it before the person starts.
  - Banner, if only conferences can be published: "Your free period ended Oct 20, 2026. Events you've already published stay live, and you can publish parent-teacher conferences. Email product@... to keep going" → "Your free period ended Oct 20, 2026. Your published events stay live. You can still create and publish parent-teacher conferences. To publish other events, email product@..."
  - Picker badge on any card that can be set up but not published: "Not in your plan" → "Can't publish on your plan"

### "Skip anything" next to "required"
- Where: New event form intro (setup-steps.tsx:47)
- What happens: "Skip anything for now: it's all in Event settings later. Boxes marked * are required." The first sentence says nothing is required. The second says some fields are. The disabled "Save and continue" button has no explanation.
- Who it hurts: Teacher and PTO president, who skim
- Standard: Answer first. One idea per sentence
- Severity: 2
- Suggested fix: "Step 1 of 5. Skip anything for now: it's all in Event settings later. Boxes marked * are required." → "Step 1 of 5. Fill in the boxes marked *. You can change everything later in Event settings."

### The "Adults only" hint ends with a stray example
- Where: Volunteer Setup, Parking, "Adults only (18+)" hint (src/app/dashboard/events/[eventId]/forms.tsx:178)
- What happens: "No one under 18 can sign up for this sign-up's shifts or be added as a walk-up, e.g. Parking." The "e.g. Parking" doesn't belong to anything in the sentence. "Sign up for this sign-up's" repeats the word.
- Who it hurts: Organizer, who is deciding a safety rule
- Standard: Plain words. Short
- Severity: 2
- Suggested fix: → "No one under 18 can sign up or be added as a walk-up. Good for jobs like Parking"

### The privacy line reads as if children are deleted
- Where: Volunteer Setup, under the title (volunteering/page.tsx:218-219)
- What happens: "Volunteers' phone numbers (and under-18 helpers) are deleted 10 days after the event. Adults' names, emails, and how many shifts they kept stay in your Volunteer tracking for 2 years after their last event." The parenthesis reads as "under-18 helpers are deleted." The sentence is 37 words long and sits at the top, before the organizer has added anything. "Shifts they kept" is unclear.
- Who it hurts: Organizer and front office administrator, who need to be sure about privacy details for children
- Standard: Short (about 20 words). Right moment. Plain words
- Severity: 2
- Suggested fix: → "🔒 We delete volunteers' phone numbers, and everything about under-18 helpers, 10 days after the event. Adults' names, emails, and attendance stay in Volunteer tracking for 2 years." The plan (IASetup) moves this to a one-line ⓘ. Do that as well.

### "Almost ready to publish" contradicts itself, and the main button says "Start"
- Where: Event page, publish card (src/app/dashboard/events/[eventId]/page.tsx:972-976). Next step card button (page.tsx:791)
- What happens: "We recommend finishing one more step first, starting with Add volunteer sign-ups and shifts." "One more step" doesn't fit with "starting with". It is also only a recommendation, even though the checklist says the step is needed to publish. The green "Publish event" button sits right under it with no warning. The main button just says "Start →".
- Who it hurts: Organizer, who could publish an event that has no shifts
- Standard: Buttons say what happens. Heuristic 5
- Severity: 2
- Suggested fix:
  - "Almost ready to publish" + "We recommend finishing one more step first, starting with Add volunteer sign-ups and shifts." → "Almost ready to publish" + "Add volunteer jobs and shifts first, so people have something to sign up for."
  - "Start →" → "Add jobs and shifts →". When the step is partly done: "Continue →" → "Finish jobs and shifts →"

### The "To do" box mixes "it" and "them", and the place it names doesn't exist on the page
- Where: Event page "To do" (page.tsx:218)
- What happens: "1 invitation has expired. Resend them from Team setup." "1 invitation" and "them" don't agree. "Team setup" isn't a link and isn't named on this page, which says "Invite your team". "To do" is a vague heading for a warning.
- Who it hurts: PTO president, who wants to fix it in the car line with one tap
- Standard: Same thing, same word. Errors help (give a way forward)
- Severity: 2
- Suggested fix: Heading "To do" → "Needs you" (the plan's word). Text → "1 invitation expired" with a link "Resend invitation". For more than one: "3 invitations expired · Resend invitations"

### The daily summary card says the opposite of its heading
- Where: Volunteer Setup, bottom card (src/app/dashboard/events/[eventId]/volunteering/digest-card.tsx:32, 50-52)
- What happens: The heading is "Your daily volunteer summary" and the text below says "You don't get the daily summary...". The link "Choose who gets it in Email settings" has no period, but the sentence before it does.
- Who it hurts: Organizer, who reads the heading and thinks they're set up
- Standard: Answer first
- Severity: 2
- Suggested fix: Heading → "Daily volunteer email". Text → "You're not getting the daily email about new sign-ups, changes, and cancellations." Link → "Change who gets it". The plan moves this to Email settings. Agree.

### Three words for "not live yet"
- Where: Event page badge "Draft: only your team can see this", Volunteers card badge "Event not published" (page.tsx:727), Volunteer Setup badge "Event not published" (volunteering/page.tsx:226), job tabs "Draft, not finished" (src/app/dashboard/events/[eventId]/volunteering/station-steps.tsx:113), settings sidebar "Draft"
- What happens: "Draft" is used for both the event and each job, with different meanings. Every job shows "Draft, not finished", even when it's only partly done. That's a lot of repetition and doesn't say what's missing.
- Who it hurts: Organizer and PTO president checking what's left
- Standard: Same thing, same word. Heuristic 1
- Severity: 2
- Suggested fix: Use "Draft" for the event only. Tabs: "Draft, not finished" → say what's missing ("Needs shifts", "Needs a lead") or "Not saved yet". When it's complete: "Ready". Card badge: "Event not published" → "Draft". The page badge already explains it.

### The save bar doesn't say what's left or what each button does
- Where: Volunteer Setup pinned bar "What's left: Finish the details", "Save for later", "Save sign-up" (forms.tsx:265, actions.ts:474)
- What happens: "Finish the details" doesn't say which detail. The difference between "Save for later" and "Save sign-up" isn't explained on screen. The code shows that one keeps the job as a draft and the other marks it done.
- Who it hurts: Teacher and PTO president, who leave partway through
- Standard: Buttons say what happens. Heuristic 1
- Severity: 2
- Suggested fix: "What's left: Finish the details" → "What's left: add a shift" (name the actual gap, as in the IASetup plan). "Save for later" → "Save as draft". "Save sign-up" → "Save and mark ready". The toast "Saved. Finish the rest when you're ready." is good. Keep it.

### Phone navigation renames things (phone only)
- Where: Header (src/app/dashboard/layout.tsx:38-49) and home h1 (src/app/dashboard/page.tsx:229)
- What happens: On desktop and tablet the nav says "My events" and the page heading says "Your events". On phone the nav says "Events". "Volunteer tracking" becomes "Volunteers" on phone, which is also the name of a section on the event page that means something different. The setup bar on phone cuts off the most important words: "You're on the next step: Add vol…" (phone only, light and dark).
- Who it hurts: PTO president and volunteer parent, who mostly use a phone
- Standard: Same thing, same word. Answer first
- Severity: 2
- Suggested fix: Phone nav "Events" → "My events" (short enough). Phone "Volunteers" → "Tracking". h1 "Your events" → "My events". Phone setup bar "You're on the next step: Add volunteer sign-ups and shifts" → "Next: Add jobs and shifts", the short form desktop Event settings already uses.

### The type picker subtitle only fits two of the seven event types
- Where: Type picker subtitle (src/components/event-type-picker.tsx:93, src/app/dashboard/events/new/page.tsx:48)
- What happens: "You can change this later, until bands or groups register." A teacher picking conferences or a parent picking a volunteer event won't know what "bands or groups" has to do with them.
- Who it hurts: Teacher, PTO president
- Standard: Shows we listen (their words)
- Severity: 1
- Suggested fix: → "You can change this later, until people start signing up"

### House-rule slips: periods on fragments, "&", "e.g.", Title Case, and "anytime"
- Where: Several places
- What happens and fixes (Before → After):
  - Checklist hint "What volunteers sign up for." → "The jobs and shifts volunteers pick from"
  - "Co-hosts and leads who help you run the day." → "Co-hosts and leads who help on the day"
  - "Then share the sign-up link or QR code." → "Share the link or QR code next"
  - "Parking maps, packets, schedules." → "Parking maps, packets, and schedules"
  - Field hint "Optional." (Venue name; src/components/venue-picker.tsx:60) → "Optional"
  - "Optional. Where volunteers should report." → "Optional. Where volunteers check in"
  - "Maps & documents (optional)" / "Publishing & more (optional)" → "Maps and documents (optional)" / "Publishing and more (optional)"
  - "Gates open / first volunteers arrive" → "First volunteers arrive". Keep "Everything wraps up".
  - Placeholder "e.g. Community Cleanup Day" → "Like Community Cleanup Day"
  - Title "Volunteer Setup" (volunteering/page.tsx:215) → "Volunteer setup". "Event Settings" (edit/page.tsx:288) → "Event settings", to match the button on the event page.
  - Buttons "Volunteer Check-in" → "Check in volunteers". "Broadcast Message" → "Send a message" (page.tsx:399, 459, 527, 530). This matches the plan's "Send a message".
  - "You can unpublish anytime." (checklist) vs "unpublish at any time" (publish card) → "at any time" in both
- Who it hurts: Mostly the brand. Mixed casing also makes some labels look like product names.
- Standard: brand-voice.md (no periods on incomplete sentences, plain words). Consistency
- Severity: 1

### Repeated or unclear lines
- Where: Event page header. Logo block on the new event form and in Event settings (src/app/dashboard/events/_components/setup-logo.tsx:12, edit/page.tsx:336)
- What happens: "Sun, Dec 6, 2026 · 7:00 AM – 10:00 PM CDT" is followed by "All times are Central Time.", which says the same thing twice. The logo text says "shown next to ours ... and printed on volunteer badges", and the line under the button repeats "Shown on your public event pages and volunteer badges." "Next to ours" doesn't say who "ours" is. "One logo for your account" appears in a single event's form without saying it changes every event.
- Who it hurts: Organizer (more to read). PTO president (may not expect one logo to change every event)
- Standard: Short. Minimalist
- Severity: 1
- Suggested fix: Remove "All times are Central Time." from the event page header. Logo: "Optional. One logo for your account, shown next to ours at the top of your public event pages and printed on volunteer badges. It saves as soon as you upload it, and you can change it later in Event settings." → "Optional. Your logo appears on every event's public page and volunteer badges. It saves when you upload it." Keep "PNG or JPG, up to 2 MB" and remove the rest of that line.

## Working well
- The "When you publish" list: four short, honest lines covering what goes live, that sign-up stays closed, that nobody is emailed, and that you can undo. This is the best copy in the flow. Keep it and use it as the model for others.
- The time zone help: "Every time on volunteer pages, emails, and calendar invites uses this zone, whatever someone's phone is set to." It answers a real question before anyone asks.
- The type picker's card descriptions use real event words ("Shifts, things to bring, a check-in desk, and your team").
- "Draft: only your team can see this" says both the status and what it means, in a few words.
- "Everything wraps up" is a friendly, plain label. "Lasts more than one day" is better than "Multi-day".
- The toasts are calm and specific ("Removed. That spot is open again.", "Saved. Finish the rest when you're ready.").
- The plan (S2Event/S3Setup) already moves toward better words: "Needs you", "Publish to get your links", "Add your volunteer shifts", "Send a message". The built screens should use the same words.
