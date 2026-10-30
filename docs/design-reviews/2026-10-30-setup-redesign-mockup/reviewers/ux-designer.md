# UX Designer

## Headline
The overall shape works: three clear steps, an honest plan warning up front, a strong "what happens when you publish" box, and a preview that is clearly marked as a preview. The weak spots are in the middle and at the edges of the flow. Nothing on the jobs screen moves you on to Publish, the job editor shows a different job's shifts next to the one you're editing, and the blocked and live screens drop the tools an organizer still needs (settings, unpublish, prep tasks, a real way to add a plan).

## Findings

### No way forward from Jobs and shifts to Publish
- Where: 3 Jobs empty and 4 Job edit, all widths and both modes
- What happens: The save bar on screen 4 only saves the current job ("Save as draft", "Save and mark ready"). Nothing says "Continue to publish" or "Done with jobs". Step 3 (screen 6) has no visible entry point, unless the stepper labels are links, and nothing shows that they are.
- Who it hurts: Organizer at a laptop and PTO president. They finish their jobs and don't know what to do next, or they think marking one job ready publishes the event. The teacher burns her lunch looking for the next step.
- Standard: Heuristic 1 (visibility of status), Action over information
- Severity: 3
- Suggested fix: Add a page-level next step under the job cards, separate from the per-job save bar. For example: "1 job ready. Next: Publish" plus a "Review and publish" button, shown once at least one job is ready. Make the stepper segments clickable links for steps that are done or current.

### The job editor shows another job's shifts beside it
- Where: 4 Job edit. On desktop it's a side panel. On phone and tablet the card stacks under the form, both modes.
- What happens: While you edit Face painting, a "Parking · Ready" card lists Parking's shifts with Edit and Delete links. On phone and tablet it sits directly under Face painting's "+ Add a shift", so it reads as Face painting's shifts. The person could delete or edit the wrong job's shift.
- Who it hurts: PTO president on her phone, organizer at a laptop. They lose track of which job they're in, and they might edit the wrong shift.
- Standard: Heuristic 6 (recognition rather than recall), Heuristic 5 (error prevention), Heuristic 8 (minimalist design)
- Severity: 3
- Suggested fix: Show only the selected job. Put that job's shifts inside its own "Shifts" section, which already exists and is where people will look. If an overview of all jobs is wanted, make it the job list itself, with each job's shift count and fill. Don't use a second detail panel.

### The blocked event page is a dead end
- Where: 8 Blocked, all widths and both modes
- What happens: The main button is "See what's included", which leads to information, not to adding a plan. "Talk with us" is the only other way out. The page also drops "Event settings", the "Before the day" list (invite team, maps, email), and the note about the Bake sale draft. Screen 6 shows all of these. So the organizer can't keep preparing while she waits on a plan. Nothing says who on the account is allowed to add a plan.
- Who it hurts: PTO president and organizer. She has done all the work and now has nothing useful to do on this page. If she isn't the Account Host, she doesn't know whom to ask.
- Standard: Action over information, Heuristic 3 (user control), Heuristic 9 (recover from errors)
- Severity: 3
- Suggested fix: Make the main action "Add a plan" for the Account Host. For anyone else, use "Ask your Account Host", with the Account Host's name shown. Keep "See what's included" as a link. Keep the same page layout as screen 6, with "Event settings", "Before the day", and the draft-job note, so only the publish button changes.

### Live page loses settings and unpublish, and the draft warning cries wolf
- Where: 7 Live, all widths and both modes
- What happens: Screen 6 promised "You can keep editing, and unpublish at any time", but screen 7 has no "Event settings" and no "Unpublish". The orange "Needs you" box calls Bake sale items a problem, yet the organizer may have left it hidden on purpose. Screen 6 told her that was fine.
- Who it hurts: Organizer, who can't find how to take the page down after a mistake. PTO president, who gets nagged about something she decided on purpose and then starts ignoring warnings.
- Standard: Heuristic 3 (user control and freedom), Heuristic 4 (consistency), Interruption-proof (alerts that cry wolf)
- Severity: 2
- Suggested fix: Keep "Event settings" in the same header spot as on screen 6, with "Unpublish" inside it or next to it. Change "Needs you" to a quieter note ("1 job is hidden: Bake sale items") with "Finish it" and "Keep it hidden" links. Make the note go away once she chooses.

### Picker doesn't say how to choose, and can promise something it can't deliver
- Where: 1 Picker, all widths and both modes
- What happens: There's no Continue button, and the Parent-teacher card has a darker border, so it looks already selected. It's unclear whether tapping a card starts setup right away. The green "You can publish this" badge appears without checking the "one at a time" rule. If a conference is already live, the badge is wrong, and she finds out only at publish. "Free during the pilot" sits next to "Your free period ended", which is two different "free" ideas on one screen.
- Who it hurts: Teacher with a 30-minute lunch, who could set up a second conference and hit a wall at the end. Organizer, who hesitates over whether something is selected.
- Standard: Heuristic 5 (error prevention), Heuristic 1 (visibility of status), Heuristic 2 (match with the real world)
- Severity: 2
- Suggested fix: Make each card one big link that clearly starts setup, with no pre-selected look. When a conference is already published, change the badge to "You have one live. Unpublish it to publish another" and link to that event. Drop "Free during the pilot" here, or explain it in the "See what's included" page.

### Two kinds of "draft" with no explanation
- Where: 4 Job edit job cards and phone dropdown, 5 Preview, 6 Ready
- What happens: Face painting is "Draft · needs a shift". Bake sale items is "Draft · hidden", even though it looks complete (it has items). Both drafts are hidden, so "hidden" doesn't tell them apart. It's unclear whether Bake sale is unfinished or held back on purpose, and what it needs to become ready.
- Who it hurts: Organizer and PTO president scanning for what's left. Job leads handed a job, who don't know what's expected of them.
- Standard: Heuristic 4 (consistency), Heuristic 1 (visibility of status)
- Severity: 2
- Suggested fix: Always pair "Draft" with what's left: "Draft · needs a shift" or "Draft · ready to mark ready". If a draft is complete, say so and offer "Mark ready" right on the card.

### Preview is a one-way trip
- Where: 5 Preview, all widths and both modes
- What happens: The only control is "Close preview". The draft cards have no "Edit this job" link, and nothing says where "Close" returns you. You can reach the preview from the job editor ("preview it") and from Publish ("Preview as a volunteer"). Also, "Preview as a volunteer" shows draft jobs that volunteers won't see, so the label isn't quite accurate.
- Who it hurts: Organizer and job lead who spot a problem in preview and have to find their way back to the right job.
- Standard: Heuristic 3 (user control), Heuristic 7 (efficiency)
- Severity: 2
- Suggested fix: Add "Edit job" on each card in the preview, and "Back to Face painting" or "Back to Publish" in place of "Close preview". Rename the publish-page link "Preview sign-up page".

### Publishing option doesn't change the button
- Where: 6 Ready, all widths and both modes
- What happens: The "Keep sign-up closed for now" checkbox sits under a button that still says "Publish and open sign-up". If she checks the box, the button contradicts her choice. It also adds a decision right at the moment she wants to finish.
- Who it hurts: Organizer and teacher, who aren't sure what will happen when they click.
- Standard: Heuristic 1 (visibility of status), buttons say what happens
- Severity: 2
- Suggested fix: Change the button label to match the checkbox: "Publish with sign-up closed". Or tuck the option behind a small "More publish options" link so the main path is one click.

### Status on the phone stepper is shown by color only
- Where: 2, 3, 4, 6, and 8 at phone width, both modes
- What happens: At 390 px the "done", "now", and "needs a plan" words under each step disappear. Only the bar color shows which steps are done, current, or blocked. Tablet and desktop keep the words.
- Who it hurts: PTO president on her phone in the car line, who loses "where was I?". Anyone who can't tell green from blue.
- Standard: WCAG 1.4.1 (color alone), Heuristic 1
- Severity: 2
- Suggested fix: Keep the status words on phone, or swap the three bars for one line such as "Step 2 of 3: Jobs and shifts · Details done".

### Unclear what's saved on Details, and no way to stop partway
- Where: 2 Details, all widths
- What happens: "Save and continue" is the only action while 2 required boxes are empty. Nothing says whether she can save what she has and come back later, or whether the event exists yet. The later steps show "Draft: only your team can see this event", but step 1 doesn't.
- Who it hurts: Teacher whose students walk in. PTO president who gets interrupted with only the time missing.
- Standard: Interruption-proof, Heuristic 1 (visibility of status)
- Severity: 2
- Suggested fix: Let "Save and continue" save a partial draft and keep the "2 boxes left" note, so the event appears in My events with "Details: 2 boxes left". Or add a "Save and finish later" link. Say "Saved" once the draft exists.

### Disabled buttons look clickable in dark mode
- Where: 4 Job edit "Save and mark ready" and 8 Blocked "Publish and open sign-up", dark mode only, all widths
- What happens: In light mode these buttons are clearly greyed out. In dark mode they look like normal outline buttons, so people will click them and nothing happens.
- Who it hurts: Organizer working late at night in dark mode, who thinks the app is broken.
- Standard: Heuristic 1 (visibility of status), Heuristic 4 (consistency)
- Severity: 2
- Suggested fix: Give disabled buttons a clearly muted dark-mode style. On screen 8, consider hiding the dead button and leaving the plan action as the only main button.

### Sample numbers disagree between screens
- Where: 4 Job edit (Parking 2 of 4 filled), 5 Preview (2 spots left), 7 Live (0 of 24 filled), all widths
- What happens: People appear to be signed up before the event is published, then the count drops to 0 after it goes live. If the real product works this way (for example, organizers adding people by hand), the screens don't explain it.
- Who it hurts: Organizer, who stops trusting the counts.
- Standard: Heuristic 4 (consistency), Heuristic 2 (match with the real world)
- Severity: 1
- Suggested fix: Make the mock-up data consistent. If organizers can add people before publishing, label those "Added by you".

### Live page "Preview" button is vague
- Where: 7 Live, all widths
- What happens: Once the event is live, "Preview" could mean the real page or a draft view.
- Who it hurts: Organizer checking what parents see
- Standard: Buttons say what happens
- Severity: 1
- Suggested fix: Rename it "View sign-up page"

## Working well
- The plan warning comes first, on the picker ("You can still set up any kind of event and publish it once you add a plan"), and screen 8 confirms "Everything you set up here is saved". Nobody hits the limit at the end without being told up front.
- The "When you publish" list on screen 6 (nobody is emailed, unpublish any time) answers the organizer's real fear before she clicks.
- "Before the day: Optional. None of these stop you from publishing" splits must-do from nice-to-do well.
- The preview banner, dashed outlines, and "volunteers won't see this" badges make it clear the drafts are a preview only. "Sign-up opens when published" in place of real buttons is a good touch.
- "Start from a past event: Copy jobs" on the empty jobs screen is exactly what the PTO president needs.
- "What's left: add a shift" next to a disabled button explains why the button is off.
- On phone, the job switcher becomes a dropdown with a status summary, which suits the small screen.

Screenshots opened: 1-picker desktop, desktop-dark, phone, tablet; 2-details desktop, phone, phone-dark; 3-jobs-empty desktop, phone; 4-job-edit desktop, desktop-dark, phone, phone-dark, tablet; 5-preview desktop, phone, phone-dark, tablet; 6-ready desktop, desktop-dark, phone, tablet; 7-live desktop, phone, tablet; 8-blocked desktop, desktop-dark, phone, tablet.
Not opened (not reviewed; findings marked "both modes" or "all widths" for those screens are inferred from the same screen at other sizes and modes): 1 phone-dark and tablet-dark; 2 desktop-dark, tablet, tablet-dark; 3 desktop-dark, phone-dark, tablet, tablet-dark; 4 tablet-dark; 5 desktop-dark, tablet-dark; 6 phone-dark, tablet-dark; 7 desktop-dark, phone-dark, tablet-dark; 8 phone-dark, tablet-dark.
