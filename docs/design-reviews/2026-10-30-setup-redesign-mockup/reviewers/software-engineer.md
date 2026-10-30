# Software Engineer

## Headline
Most of this design fits the app as it is today. Publishing rules, the one-at-a-time limit, "keep sign-up closed", and "published events stay live" are already enforced in the database, and the mock-up's promises match them. The big new piece is the draft job. Right now the database has no draft state for a job: once an event is published, anyone can read and sign up for every job on it, and every team member can see every job. Hiding draft jobs has to be built into the database, not just the screens, and it touches about a dozen places. A few other promises ("you can change everything later", "shifts with people can't be deleted", "unpublish at any time") are not true today, or have a catch nobody sees yet.

## Findings

### Draft jobs need a real "hidden" state in the database, not just on screen
- Where: 4 Job edit ("Draft: volunteers can't see this job"), 5 Preview, 6 Ready ("stays hidden until you mark it ready"), 7 Live ("Needs you")
- What happens: Today a job (`stations` in the code) has no draft or ready flag. The rules that decide who can read jobs, shifts, and items to bring (`stations: public read`, `shifts: public read`, and the `station_items` read rule) let anyone, signed in or not, read every job once the event is published. The sign-up functions (`sign_up_volunteer`, `sign_up_group`, `swap_shift_with_pass`, `book_group`, the older `register_volunteer`) and `public_item_board` only check that the event is published. If drafts are hidden only on the page, anyone who has a shift's id from a link, a pass, or a calendar file can still read a draft job or sign up for it.
- Who it hurts: Organizer at a laptop and the PTO president: they trust that "hidden" means hidden, and a half-built job (wrong times, no lead yet) gets real sign-ups. Volunteer parent: signs up for a shift that later changes or disappears.
- Standard: Error prevention (heuristic 5). This is also the product rule the brief marks as fixed.
- Severity: 3
- Size: Large. Add a ready flag to jobs, and decide whether jobs that already exist start as ready (they should, so live events don't go dark). Change the three read rules. Add a "job is ready" check to every sign-up and swap function and to `public_item_board`. Decide how calendar files, passes, the daily sign-up email, and reminders treat draft jobs. Add matching cases to `supabase/tests/security_test.sql`: someone not signed in can't read a draft job, its shifts, or its items, and can't sign up for it.
- Suggested fix: Treat "ready" as a database rule, enforced in the same places "published" is enforced today. Build and test it before any screen work.

### "Hosts and that job's lead" is narrower than who can see jobs today
- Where: 4 Job edit ("You and its lead can preview it"), 5 Preview
- What happens: The current rule `stations: staff read` uses `is_event_staff`, so every Host, Co-host, Volunteer Director, and lead on the event can read every job. That includes draft jobs led by someone else. The product rule says only Hosts and that job's own lead can preview a draft. The rule also doesn't say what Volunteer Directors (who manage volunteers today) should see.
- Who it hurts: Leads see half-built jobs that aren't theirs. That's minor on its own, but it breaks the promise the screen makes.
- Standard: Product rule (fixed). Consistency (heuristic 4).
- Severity: 2
- Size: Small to medium. Split the read rule: ready jobs stay visible to the whole team; draft jobs are visible only to people who can manage volunteers and to people for whom `leads_station(id)` is true. Shifts and items follow their job. Add security test cases for a lead of job A trying to read draft job B.
- Suggested fix: The owner decides whether Volunteer Directors count as "Hosts" here. Then write the narrower rule and its tests.

### After publishing, a Host on the real event page sees draft jobs with no "preview" label
- Where: 5 Preview (shown only before publishing), 7 Live ("Preview" button, "Bake sale items is still a draft")
- What happens: The volunteer page (`src/app/e/[slug]/volunteer/page.tsx`) shows whatever the signed-in person is allowed to read. It shows its "Preview: this page isn't public yet" notice only while the event is unpublished. Once the event is live, a Host or lead who opens the public link from a group text would see draft jobs mixed in with real ones, with no outline and no banner. They might also see working sign-up buttons on draft shifts.
- Who it hurts: Organizer and PTO president: they check "what parents see" and get a wrong answer. Leads too.
- Standard: Visibility of system status (heuristic 1). Product rule: "it must be clear that it's only a preview".
- Severity: 3
- Size: Medium. Make preview its own mode, for example a `?preview` link that only Hosts and leads can use. Without it, the page always shows exactly what a volunteer sees, even to Hosts. In preview mode, show the banner and the outlines, and turn off sign-up on draft jobs (the database check above backs this up).
- Suggested fix: By default, the public link shows the volunteer's view to everyone. Draft jobs appear only on the explicit preview, which always carries the "Preview only" bar, before and after publishing.

### Turning a ready job back into a draft after people signed up isn't designed
- Where: 4 Job edit (Save as draft), 7 Live (Manage jobs and shifts)
- What happens: The mock-up only shows jobs going from draft to ready. If a Host sets a live job with sign-ups back to draft, those volunteers' passes and "my shifts" lists would lose the shift (it's now hidden). But the daily reminder job, which reads with full access, would still email them about it. The counts on 7 would also drop with no explanation.
- Who it hurts: Volunteer parent: gets a reminder for a shift they can no longer see, or turns up for one that was quietly pulled. Organizer: doesn't realize what the change did.
- Standard: Error prevention (5). User control and freedom (3).
- Severity: 3
- Size: Small. Either block "back to draft" while a job has sign-ups (simplest, enforced by the database), or allow it with a confirmation that says who is signed up and what happens to them.
- Suggested fix: Block it in the database while anyone is signed up for the job, and on the screen say "People are signed up for this job. Move or remove them first", the same pattern as deleting a shift.

### "Shifts with people in them can't be deleted" isn't true in the database
- Where: 4 Job edit, Parking panel (Delete link and note)
- What happens: Deleting a shift cascades: the database removes every sign-up for it (`volunteer_assignments ... on delete cascade`). Deleting a job removes its shifts and their sign-ups the same way. Nobody is told. Hiding the Delete link only covers this one screen.
- Who it hurts: Volunteer parent: their sign-up vanishes silently. Organizer: loses track of who was coming.
- Standard: Error prevention (5).
- Severity: 3
- Size: Small. A database check that refuses to delete a shift, or a job, while anyone is signed up, plus a security test case. The screen then just explains the refusal.
- Suggested fix: Enforce it in the database so every path follows the rule (this page, older pages, spreadsheet tools).

### Changing the date or time zone later moves or strands every shift
- Where: 2 Details ("You can change everything later", Time zone "From your browser"), 4 Job edit (shift times)
- What happens: Shifts are saved as exact moments in time, not as "8 AM on event day". If the organizer later changes the event date, every shift stays on the old day, and the volunteer page hides shifts whose end time has passed. If they change the time zone, every shift's clock time shifts by an hour or more. The time zone also defaults from the browser, but the account already has its own time zone setting. An organizer setting up from a laptop while traveling, or a laptop set to the wrong zone, gets the wrong one.
- Who it hurts: Volunteer parent: shows up at the wrong time. Organizer: doesn't see it happen. The PTO president, who often reuses dates: when a date changes, the shifts don't follow.
- Standard: Error prevention (5). Match with the real world (2).
- Severity: 3
- Size: Medium. When the date or time zone changes and shifts exist, offer "Move all shifts to the new date" (keep each shift's clock time), and do the move in one database step. If people are already signed up, warn first. Default the time zone from the account's setting, and use the browser's zone only as a fallback.
- Suggested fix: As above. Also show the time zone on the preview header ("All times Central"), as the live page already does.

### Unpublishing is a one-way door for an account whose free period has ended
- Where: 6 Ready ("You can keep editing, and unpublish at any time"), 1 Picker ("Your published events stay live"), 8 Blocked
- What happens: The database lets an already-live event stay live after the plan lapses. Publishing again is checked as new publishing, though. A lapsed account that unpublishes its live volunteer event, even to fix a typo, can't publish it again. Nothing in the design warns about this. The unpublish control in Event settings is out of scope, but the promise is made here.
- Who it hurts: PTO president or organizer: takes the event offline days before it runs and can't bring it back.
- Standard: Error prevention (5).
- Severity: 3
- Size: Small. Before unpublishing, call the existing `org_can_publish` check. If the event couldn't be published again, say so in the confirmation ("Your plan can't publish this again. It will stay offline until you add a plan"). Say "unpublish at any time" only when that's true.
- Suggested fix: As above, and pass the same condition to the "When you publish" list on 6.

### Plan messages and badges should come from the database, which knows more than the mock-up shows
- Where: 1 Picker (badges, banner), 8 Blocked (message and buttons)
- What happens: The database already works out the exact reason an event can't be published (`org_can_publish`) and what the account can do (`account_plan`). Those include things the mock-up leaves out: a one-time event pass that lets an account publish one volunteer event without a full plan, and "you already have a conference published, so unpublish it first". The conference card says "You can publish this" even when another conference is already live. If the screens hard-code their own wording, the screen and the database will drift apart and disagree.
- Who it hurts: Teacher with a 30-minute lunch: sees "You can publish this", builds the conference, then gets refused at the end. Organizer: never learns that a pass is an option.
- Standard: Visibility of system status (1). Consistency (4).
- Severity: 2
- Size: Small. Base the badges on `account_plan` (including the published counts and unused passes). Show 8's message from `org_can_publish` on page load, worded to follow the brand voice in the database function itself.
- Suggested fix: Add a third badge state for conferences ("One is already live: unpublish it to publish this"), and a pass option on 8 when the account's package allows it.

### "You can change this later, until people start signing up" doesn't match the rules, and has a gap
- Where: 1 Picker, subheading
- What happens: The database never lets a parent-teacher conference become another kind of event, or the other way round (`conference_type_is_fixed`), even with no sign-ups. Volunteer sign-ups don't lock the type at all; only bands registering and fair booths do. There's also a gap: changing the type of an already-published event isn't checked against the plan again. That check looks only at the account's own package, not at whether its plan is active. So a lapsed account could turn a live volunteer event into a live band contest.
- Who it hurts: Teacher: picks conferences by mistake and finds out they can't switch. Owner: the plan rule can be sidestepped.
- Standard: Consistency (4). Product rule (fixed).
- Severity: 2
- Size: Small. Change the words to match the real rule, or build the rule as written. Also re-run the publish check when the type of a published event changes, and add a security test case for it.
- Suggested fix: Picker subheading something like "Most kinds can be changed later. Conferences can't". Add the publish-gate check on type changes.

### Details can't be saved half-done, and one date can't hold a two-day event
- Where: 2 Details ("2 boxes left", "Save and continue", "You can change everything later")
- What happens: The events table requires start and end times and an address before a row can exist (`window_start`, `window_end`, `venue_address` are required). An organizer who gets interrupted before picking times has nothing saved, and the design doesn't say what happens to their typing. The table also supports events that run over several days (`starts_on`, `ends_on`), and many fairs and festivals do, but the design has one Date field and no way to set an end after midnight. "Where" is one box, while the app stores a venue name, an address, and a map place separately.
- Who it hurts: PTO president in the car line, and the teacher at lunch: they lose what they typed. Organizer of a two-day fair: can't describe it.
- Standard: Interruption-proof (house standard). Match with the real world (2).
- Severity: 2
- Size: Medium. Pick one approach: keep unsaved details in the browser and restore them, or allow a details draft with times left empty and require them only at publish. Add an "Ends on a different day" option. Use the existing places lookup for "Where" so name, address, and map link fill in together.
- Suggested fix: As above. Disable "Save and continue" while boxes are missing, and say they'll be kept on this device, or make it really save.

### "Copy jobs" and "Import from a spreadsheet" are two new features, not buttons
- Where: 3 Jobs empty
- What happens: Neither exists today. Spreadsheet imports cover volunteers, bands, and parents, but not jobs and shifts, and nothing copies jobs between events. Copying needs to move every shift to the new date (keeping clock times across daylight-saving changes), carry items to bring, adults-only and minimum ages, and decide whether leads come along. Copied jobs should arrive as drafts. It also has to choose which past event to suggest. Import needs a template, column matching, and a preview, like the other imports.
- Who it hurts: PTO president, if they ship half-done; it's the reuse she most needs. If they're left out, the buttons promise something that isn't there.
- Standard: Flexibility and efficiency (7).
- Severity: 2
- Size: Medium each. Copy is the more valuable and easier of the two.
- Suggested fix: Build copy first, and keep copied jobs as drafts so nothing goes live unchecked. Leave the import button out until the import exists.

### Adding a lead depends on a team that doesn't exist yet in this flow
- Where: 4 Job edit ("+ Add a lead", lead help text); 6 Ready ("Invite your team" is optional)
- What happens: The database allows only people already on the event's team, or the account's Hosts, as a job's lead. On a brand-new event the team is empty, so "+ Add a lead" needs an "invite by email" path inside the job editor. That sends an email, and plan team limits can refuse it (Free allows 2 people). An invited lead can't preview anything until they accept. The help text says leads see phone numbers on event day; they also see email addresses then. The app calls this role "Coordinator" elsewhere (`leadWords`), not "Lead".
- Who it hurts: PTO president handing jobs to other parents: the main delegation step breaks on a new event. Leads: privacy wording is incomplete.
- Standard: Recognition rather than recall (6). Consistency (4). Accuracy of privacy wording.
- Severity: 2
- Size: Medium. An invite-from-here dialog that reuses the existing invitation flow, shows the plan limit's reason when it refuses, and shows invited people as "Invited" until they accept.
- Suggested fix: As above. Change the help text to "...also see volunteers' phone numbers and emails", and settle on one name for the role.

### Two people editing the same job, and long job lists
- Where: 4 Job edit (job tabs, save bar, right-hand Parking panel)
- What happens: The PTO president and a Co-host can have the same job open at once, and whoever saves last silently wins. Nothing records when a job was last changed, so nothing can be checked. The row of job cards works for 3 jobs, but a fall festival often has 20 to 40. At tablet and desktop widths that becomes several rows of cards above the form (the phone dropdown copes better). The right-hand panel shows Parking's shifts while Face painting is being edited. On phone it sits under the form and reads as part of Face painting.
- Who it hurts: PTO president and co-hosts: lost edits. Organizer of a big event: the job list pushes the editor off screen.
- Standard: Visibility of system status (1). Aesthetic and minimalist design (8).
- Severity: 2
- Size: Small for edit conflicts: save the job's last-changed time and refuse a save made from an older copy, with "Someone else changed this job. Reload to see their changes". Small for the list: use the phone's dropdown, or a searchable side list, past about 6 jobs.
- Suggested fix: As above. Show the shifts of the job being edited in the panel, not another job's.

### Counts and the event link need clear definitions
- Where: 6 Ready ("2 jobs ready · 6 shifts · 24 spots", "Your link: appears when you publish"), 7 Live ("0 of 24 spots filled", "2 jobs open"), 4 and 5 (Parking "2 of 4 spots filled" on an unpublished event)
- What happens: The counts have to leave out draft jobs and say whether items to bring count as "spots". The sample data contradicts itself: 2 spots are filled before publishing, then 0 of 24 after. Event links are unique across every school, so a common name like "fall festival" will get a changed link. The link exists from the moment the event is made, and a lead needs it to preview before publishing.
- Who it hurts: Organizer: numbers they can't reconcile. Leads: no link to preview with.
- Standard: Consistency (4).
- Severity: 1
- Size: Small.
- Suggested fix: Spots = places in shifts on ready jobs only. Show items separately. Show the link (marked "not public yet") before publishing, and don't change it when the event is renamed after publishing.

### Turned-off buttons look turned on in dark mode
- Where: 4 Job edit "Save and mark ready" and 8 Blocked "Publish and open sign-up" (dark mode, all widths I checked)
- What happens: In light mode these buttons are clearly greyed out. In dark mode they look like normal buttons. People will tap them and get nothing, or a server refusal.
- Who it hurts: Organizer working late at night in dark mode.
- Standard: Visibility of system status (1). WCAG 1.4.1, if the state shows only through color.
- Severity: 2 (dark mode only)
- Size: Small. The server already refuses to publish, so this is a look-and-wording fix. Also say why next to the button.
- Suggested fix: Make dark mode's turned-off style as clearly different as light mode's.

## Working well
- Publishing rules are already in the database: the plan check, "one conference at a time" (with a lock so two people publishing at once can't both win), and "published events stay live". The picker banner and screen 8 describe this correctly.
- "Keep sign-up closed for now" matches an existing setting (`volunteer_signup_open`), so it's cheap to build.
- Drafts being free to build matches how the database already treats them, so the "set up now, publish with a plan" approach needs no new permission work for accounts on a paid package whose free period ended.
- "Nobody is emailed" when publishing matches the current publish action, as far as I can see. Keep it true as the job and lead features are added.
- Volunteer phone numbers going to leads only on event day matches `station_roster`, which already enforces it.
- Leaving team, emails, and maps to Event settings keeps step 2 short and needs no new data.

Screenshots opened: 1-picker desktop, phone, tablet, desktop-dark; 2-details desktop, phone, tablet; 3-jobs-empty desktop, phone, tablet; 4-job-edit desktop, phone, tablet, desktop-dark; 5-preview desktop, phone, tablet, phone-dark; 6-ready desktop, phone, tablet, desktop-dark; 7-live desktop, phone, tablet; 8-blocked desktop, phone, tablet, phone-dark. I did not open the remaining dark-mode shots (2, 3, and 7 dark at all widths, and tablet-dark for every screen); the dark-mode finding is based on the four dark shots I opened.
