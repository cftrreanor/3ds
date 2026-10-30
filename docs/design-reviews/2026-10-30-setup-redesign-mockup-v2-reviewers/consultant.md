# Usability consultant (independent)

## Headline
The core of this design is sound. The three-step frame, the "Draft event: only your team can see it" pill, the job tabs with status, the preview banner, and the way screen 14 enforces the "can't hide or shrink below sign-ups" rule all work as they should. Where it falls down is the plan rule and the risky moments around it. The plan limit is mentioned once on the picker and then vanishes until the very last step. The conference-limit screen (02) is visibly broken and gives risky advice. "Unpublish" on a live event that can never be republished is a plain link with fine print under it. Status words also drift from screen to screen (Ready / Hidden / not marked ready / Finish / open / Ready to go), and organizers who set up one event a year will trip over that.

## Findings

### The plan limit disappears for the whole setup and comes back only at the end
- Where: 01 picker (lock pill on Volunteer event), then nothing on 03, 05, 06, 07, 10 or 11, then 15 blocked. All widths, both modes.
- What happens: the picker shows a small "Publishing needs a plan" pill and a banner. The organizer taps Set up anyway, since "You can still set up any kind of event", and spends one or more evenings on details, jobs, and shifts. The stepper's "Publish · Last" step looks open the whole way through. The block shows up only at step 3 (15). Screen 10, which shows the same event as ready with a live "Publish and open sign-up" button, makes it worse: nothing on screen says which account state you're in.
- Who it hurts: the Organizer at a laptop and the PTO president, who set up across several sessions and will have forgotten the picker pill by the time they reach step 3. The Teacher, who has one 15-minute window and spends it on something she can't publish.
- Standard: Visibility of system status (H1), Error prevention (H5), Recognition rather than recall (H6)
- Severity: 3
- Suggested fix: from the moment the event is created, show the plan state in the stepper's Publish slot ("Publish · 🔒 Needs a plan", as on 15) and add one short line under the step-1 heading: "You can set this up now. Publishing needs a plan: write to us." Keep 10 for accounts that can publish, and label that mock-up state clearly so reviewers and builders don't confuse it with 15.

### Screen 02 (a conference is already live) is broken, and its advice is risky
- Where: 02 picker-conf, all three widths, light and dark
- What happens: the layout falls apart. "Go to Fall conferences" and a bare "Set up →" sit outside the cards as loose text, and at desktop they float in empty grid cells. The pilot banner and five of the seven event types are missing, and the Volunteer card has lost its lock icon. The warning pill reads "Fall conferences is live. Unpublish it to publish another." In a pill that wraps to three lines, it reads as a command. It also tells a teacher to take down a live conference that families may already have booked. Nothing says what happens to those bookings.
- Who it hurts: the Teacher with a 30-minute lunch, who may unpublish a live conference to set up the next one and strand families. The Organizer, who can't tell whether "Set up →" still works for conferences: the brief says setting up is allowed, but the screen doesn't say so.
- Standard: Error prevention (H5), Consistency (H4), Aesthetic and minimalist design (H8). Brand voice: "Calm and steady."
- Severity: 3 (and the screen can't be judged until it's redrawn)
- Suggested fix: redraw 02 with the full picker, keeping the conference card's "Set up" inside the card. Replace the pill with plain card text: "Fall conferences is live. You can set up another now and publish it after Fall conferences ends." Add a link inside the card: "Go to Fall conferences". Don't recommend unpublishing here at all. If unpublishing is offered anywhere, it needs a confirmation that names the bookings at stake.

### "Unpublish" is a one-way door drawn as an ordinary link
- Where: 12 live, "Sign-up and page" panel (desktop right column, phone and tablet bottom), both modes
- What happens: "Unpublish" looks exactly like "Invite" and "Add". The only warning is small gray text under it: "Your plan can't publish volunteer events, so if you unpublish this one it stays offline until you add a plan". The volunteers who already signed up aren't mentioned. No confirmation step is shown. On desktop that warning runs straight into the "Before the day" heading with no space between them, so it reads as part of the next section.
- Who it hurts: the PTO president tapping around on her phone in the car line. One mis-tap takes the event offline for good, with 2 volunteers already signed up.
- Standard: Error prevention (H5), User control and freedom (H3)
- Severity: 3
- Suggested fix: on any account that can't republish, put "Unpublish" behind a confirmation dialog: "Take Cedar Ridge Campus Clean-up offline? 2 volunteers are signed up. Your plan can't publish it again. [Keep it online] [Take it offline]". Point people to "Close sign-up" as the safe choice ("Want to stop new sign-ups? Close sign-up instead"). Add a divider and space before "Before the day".

### Work in progress can be lost through competing actions on the job page
- Where: 06 job-edit, all widths
- What happens: three different "save" ideas are on screen at once. "Add this shift" is inside the New shift box. "Save, keep hidden" and "Mark ready" are in the save bar. "Continue to publish" is the most prominent button on the page, in the green banner at the top. The job tabs (or the phone dropdown) also switch jobs. Nothing tells the organizer whether "Add this shift" saved anything, or whether tapping "Continue to publish" or another tab while a shift is half-entered will throw it away.
- Who it hurts: the Organizer at a laptop ("is this saved?") and the PTO president, who gets interrupted mid-entry.
- Standard: Visibility of system status (H1), Error prevention (H5), Interruption-proof
- Severity: 3
- Suggested fix: show a saved state in the save bar ("All changes saved" or "Unsaved changes"). When there are unsaved changes, either save them automatically before moving on to another job or to publish, or ask "Save Litter pickup first?" Hide or tone down "Continue to publish" while a job form is open with unsaved edits. Show one confirmation line after "Add this shift" ("Shift added. Save to keep it.") so the two-level save is explained right where it happens.

### Status words drift from screen to screen
- Where: 05, 06, 07, 10, 12, 14
- What happens: one state goes by many names. The tabs say "Hidden · not marked ready". The 07 save bar says "Ready to show volunteers" next to a green dot while the same job is hidden. The 06 stepper says "Publish · Ready to go" while 2 of 3 jobs are hidden. 05 says "hidden drafts", 12 says "jobs open" and "Finish Supplies to bring" for a job whose own page (07) says "Everything's filled in", and 14 says "Hide this job". A green "ready" signal on a hidden job is the worst of these, because color and words disagree.
- Who it hurts: the Organizer at a laptop, who forgets the system between events. The front office administrator or a Co-host glancing at a status.
- Standard: Consistency and standards (H4). Content: "Same thing, same word."
- Severity: 2
- Suggested fix: pick two words and use only those: "Ready" (volunteers can see it) and "Hidden" (they can't). The 07 save bar should read "Everything's filled in. Mark it ready to show volunteers", with a neutral dot rather than a green one. On 12, use "2 jobs ready" and "Mark Supplies to bring ready". On 06, the stepper should say "Publish · 1 job ready". Replace "hidden drafts" with "hidden jobs".

### The preview pages disagree about who can see a hidden job
- Where: 06 hidden banner and 09 preview-lead banner
- What happens: 06 says "Your Hosts, Volunteer Directors, and this job's lead can preview it." 09 says "Only you and the event's Hosts can see it". Co-hosts aren't mentioned on either screen, even though the rule includes them. The lead's preview also shows Parking with one shift where the Host's preview (08) shows two, so the lead can't trust that the preview is accurate.
- Who it hurts: the lead (often a volunteer parent), who may believe their unfinished job is more private, or less private, than it is. The Organizer deciding whom to trust with an unready job.
- Standard: Consistency (H4), Match with the real world (H2)
- Severity: 2
- Suggested fix: use one sentence everywhere: "Only Hosts, Co-hosts, Volunteer Directors, and this job's lead can see it until it's ready." Make the lead's preview show the same ready jobs as the Host's preview.

### The error state looks as if the form lost data
- Where: 04 details-errors, all widths, both modes
- What happens: after a failed save, the stepper, the page heading, and the Date, Time zone, and Where fields are all gone. Only Event name, Starts, and Ends remain. The page also has no h1. Someone coming back to it would reasonably think their date and location were wiped. The note "what you've typed stays on this device until you come back" appears only here, and "on this device" means a draft started on a phone won't be there on the laptop.
- Who it hurts: the PTO president, who starts on her phone and finishes on her laptop. The Teacher, who gets interrupted and comes back later. Screen-reader users, who land on a page with no heading.
- Standard: Visibility of system status (H1), Interruption-proof, WCAG 1.3.1 and 2.4.6 (headings), 3.3.1 (errors)
- Severity: 2
- Suggested fix: keep the full form, heading, and stepper, and mark only the two empty boxes. Link the error summary items to their fields and move focus to the summary. Save the partial event to the account (as a draft) rather than to the device, and show the reassurance on 03 too: "We save as you go. Come back any time."

### Screen 11's headline asks for something the organizer has already done
- Where: 11 ready-none, all widths
- What happens: the headline says "Next: add a volunteer job", but the body says "You have 2 hidden jobs." The job they need to do is mark one ready, not add one. The location is also missing from the event line here and on 13 and 15, though 10 and 12 show it.
- Who it hurts: the Organizer, who may add a duplicate job.
- Standard: Match with the real world (H2), Action over information
- Severity: 2
- Suggested fix: "Next: mark a job ready". Body: "Volunteers see a job once it has a shift or an item and you mark it ready. You have 2 hidden jobs." Button: "Go to jobs". Show the event line the same way on every event page.

### The "sign-up closed" state strips the page and has the wrong tense
- Where: 13 live-closed, all widths, both modes
- What happens: once sign-up is closed, the page shows only "Open sign-up" and "Copy link". The volunteer counts, "Manage jobs and shifts", Event settings, "Before the day", and Unpublish are all gone. The text says people "can't sign up yet", which is wrong when sign-up was closed after it had been open (people are already signed up).
- Who it hurts: the Organizer checking how many people came through before closing. The PTO president looking for "where was I?"
- Standard: Consistency (H4), Visibility of system status (H1)
- Severity: 2
- Suggested fix: keep 12's layout and swap only the green "live" card for the closed card. Use different wording depending on how they got here: "Sign-up hasn't opened yet" when they picked Later on 10, or "Sign-up is closed. 2 volunteers are signed up" when they closed it.

### Editing a live job lacks context and a way through the blocks
- Where: 14 job-live, all widths
- What happens: the rule itself is carried out well. Spots can't go below the number signed up, Delete is missing on the shift with sign-ups, and "Hide this job" is disabled with the reason given. But nothing on the page says the event is live, or that changes reach volunteers right away. "Move or remove the 2 people signed up" gives no link to where to do that. "Save shift" is an outlined secondary button. Only Spots can be edited on a shift with sign-ups, and nothing says why the time can't change. Lead and check-in location, which 06 had, aren't on this job page at all.
- Who it hurts: the Organizer, who doesn't know whether volunteers will be told about a change. The PTO president, who hits a dead end.
- Standard: Visibility of system status (H1), Help users recover (H9), Consistency (H4)
- Severity: 2
- Suggested fix: add a one-line live banner: "This event is live. Changes show to volunteers right away." Make "move or remove" a link to that shift's sign-up list. Make "Save shift" the primary button. Add one line about time changes (for example "To change the time, add a new shift and move people over"). Use one job-editor layout for all states.

### The blocked screen's main action is a disabled button
- Where: 15 blocked, all widths, both modes
- What happens: the most prominent control is the disabled "Publish and open sign-up". The real next step, writing to the team, is only an email address inside a paragraph, and you can't tap or copy it as a button. "Ready to publish once you add a plan" suggests the organizer can add a plan themselves, which isn't true yet. "Ask Hana Host" reads like a role rather than a person, because the sample surname is the role name. The lock is a color emoji on this screen but a line icon on 01 and in this screen's own banner.
- Who it hurts: the Teacher and the PTO president on a phone, where copying an address out of a paragraph is fiddly. The Organizer, who looks for a "get a plan" button that isn't there.
- Standard: Action over information, Consistency (H4). Brand voice: "Promises we keep."
- Severity: 2
- Suggested fix: make "Email us about a plan" (a mailto link with the event name filled in) the primary button, with "Copy email address" beside it. Change the heading to "Ready to publish. Publishing needs a plan." Use a sample name like "Hana Lee (Account Host)". Use the same line lock icon everywhere.

### Small tap targets and one dark-mode control problem
- Where: phone, light and dark: the "✓ Done" step links, the "×" on the lead chip (06), the inline "preview it" link (06), the "Edit" and "Delete" text links (07, 14), and "Edit" wrapping onto its own line under "Bottled water" (07 phone). Dark mode, 10 ready (all widths): the unselected "Later" radio is drawn as a filled gray circle.
- What happens: these links and icons look about 20 px tall, below the 44 px house target for phones, and the "×" is close to the 24 px WCAG minimum. In dark mode, the filled gray radio can read as a selected or disabled option. Field and checkbox edges in dark mode (03, 06) look faint against the dark card, so they need measuring.
- Who it hurts: the PTO president and the Volunteer parent working one-handed on a phone. Anyone with low vision using dark mode.
- Standard: WCAG 2.5.8 (target size), 1.4.11 (non-text contrast)
- Severity: 2
- Suggested fix: give text-link actions a 44 px hit area on phones. Make the chip's "×" a 44 px button labeled "Remove Maria Lopez". Keep "Edit" on the same row as the item name on phones. Draw unselected radios in dark mode as a hollow ring with a 3:1 edge. Measure dark-mode field and checkbox edges against the card color, not the page color.

### Small layout and wording polish
- Where: 01 desktop (green pill wraps to two lines inside a pill), 10 ("Event settings" appears twice; a ✓ in front of "We don't email anyone"; "Daily email of new sign-ups · On" looks like a pill but has no way to change it), 12 ("You get an email each morning" vs 10's "Daily email")
- What happens: these are minor inconsistencies that add noise. The ✓ in front of a negative statement reads like a promise kept, when it's really a heads-up.
- Who it hurts: the Organizer, slightly
- Standard: Aesthetic and minimalist design (H8), Consistency (H4)
- Severity: 1
- Suggested fix: shorten the pill to "You can publish one" or put it on its own line. Remove the duplicate Event settings row. Use an info icon for "We don't email anyone, so share the link yourself". Make the daily-email row a toggle or give it a "Change" link.

## Working well
- The three-step stepper with "Now", "Next", and "Done" and a plain "Next, you'll add volunteer jobs and shifts" line answers "what's left?" at a glance
- "Draft event: only your team can see it" is an excellent status pill: answer first, plain, and on every draft page
- The job tabs show each job's status, and the save bar's "What's left: add a shift" explains a disabled button without making people guess
- 08's preview banner ("Preview only. Volunteers can't see this page yet."), the dashed outlines plus "Hidden from volunteers" pills, and "Opens when published" buttons make it clear this is only a preview, with words as well as color
- 14 carries out the sign-up rules well: spots have a stated minimum, Delete is missing where it would strand people, and "Hide this job" is disabled with the reason given
- "Start from a past event" on 05, with copies arriving as hidden jobs to check, serves the PTO president's "reuse last year"
- 10's "When you publish" list and the "Now / Later" choice with a description under each option set expectations before the commitment
- The 15 banner is honest and specific ("Everything here is saved", "we'll reply within a day"), keeps "Before the day" usable while they wait, and tells a non-owner whom to ask
- Light and dark modes are both carefully done; text contrast looks comfortable throughout, and status is always carried by words, not color alone

## Verdict
**Build after fixes.** The structure, the preview model, and the live-edit rules are right and don't need rethinking. Before building, redraw screen 02. Put a confirmation and a safer alternative in front of Unpublish. Make the save model on the job page explicit. Settle on one pair of status words. **The one change that would help most:** show the plan state in the stepper's Publish step from the first screen of setup ("Publish · Needs a plan"), with a way to write to us right there, so no organizer spends an evening building an event they find out at the end they can't publish.

Screenshots opened (90): 01–15 × phone, tablet, and desktop × light and dark (every file in 2026-10-30-setup-redesign-mockup-v2/).
