# Software Engineer

## Headline
The flow can be built, but several screens promise things the database doesn't do yet. Three gaps matter most. Hidden jobs are not hidden: today anyone can read every job of a published event. An event can't be saved with only a name, because dates, times, and address are required columns. And drafts of "Try it" event types are blocked outright by a database rule. Most of the remaining work is small or medium. Every rule needs to live in the database, not only on the screen, and each needs a matching case in supabase/tests/security_test.sql.

## Findings

### Hidden jobs are visible to anyone today
- Where: 07 job-edit, 10 preview, 11 preview-coord, 12 ready ("2 jobs are hidden"), 15 live
- What happens: There is no "ready" or "hidden" flag on jobs (the `stations` table). The rule "stations: public read" lets anyone, signed in or not, read every job and shift of a published event. So a hidden job on a live event (15) would show to anyone who asks the database directly. The public sign-up page (`src/app/e/[slug]/volunteer/page.tsx`) reads with the visitor's own login. A Host or Coordinator who opens the real public page would therefore see hidden jobs mixed in as if they were live, which is exactly the confusion the "Preview only" banner is meant to prevent. Sign-ups go through a server action with full database access (`register_volunteer`), so nothing would stop a sign-up for a hidden shift. "Stations: staff read" also lets every Coordinator read every hidden job, while 11 says "Other hidden jobs aren't shown to you".
- Who it hurts: The volunteer parent could sign up for a job that isn't real yet. The organizer would trust a preview that doesn't match what the public sees.
- Standard: Error prevention; privacy rule "jobs that aren't marked ready are hidden from volunteers"
- Severity: 4
- Size: Medium
- Suggested fix: Add `stations.ready boolean not null default false`, and mark existing jobs as ready in the migration. Change the public read rules on `stations`, `shifts`, and `station_items` to also require `ready`. Change staff read to: Host, Co-host, or Volunteer Lead, or the job's own Coordinator (`leads_station`). Make `register_volunteer` and the item-claim function refuse jobs that aren't ready. Have the public page always filter `ready = true` in its query, whoever is signed in. Build the preview (10, 11) as its own signed-in page under /dashboard, never as a flag on the public URL. Add security tests for an anonymous visitor, a Coordinator of another job, and a signed-in Host on the public page.

### "Saved as soon as it has a name" conflicts with required date, time, and address columns
- Where: 04 details ("Saved as a draft · 2 boxes left to publish: Starts and Ends"), 05 details-ended
- What happens: `events.starts_on`, `ends_on`, `window_start`, `window_end`, and `venue_address` are all required (`not null`), and the current form checks them before it saves anything. Saving with only a name means making them optional. Many parts of the app assume they are always there: `reschedule_event` fails when the old start date is empty, as do `is_event_day`, the daily email job, calendar files, data retention, dashboard sorting, the "check-in opens" text, and the day picker for shifts (09). Shifts also need a date to exist, but 04 lets someone continue to jobs and shifts with Starts and Ends still empty.
- Who it hurts: The teacher and the PTO president, who stop partway through. If one of those spots is missed, the page crashes when a half-done draft loads.
- Standard: Interruption-proof; Visibility of system status
- Severity: 3
- Size: Large
- Suggested fix: Make those columns optional. Add a database check at publish time: the trigger that runs on publish (`events_publish_needs_plan`) refuses to publish while any of them is empty, and its message names the missing boxes. Go through every place that reads these columns and give it a safe fallback. Only let people add shifts once a date is set: replace the job form with "Add the date first" and a link back to step 1. Autosave each field on blur, and say "Saving…", "Saved", and "Couldn't save" in a polite live region.

### Drafts of "Try it" event types are blocked by the database today
- Where: 02 picker-more, 03 picker-ended, 05 details-ended
- What happens: The `events_type_in_package` trigger refuses to create any event whose type isn't in the account's package, and the new-event page only lists `startableTypes`. "Try a band contest" would fail on its first save. Once drafts are allowed, these "try it" events can still do things that reach people outside the account while still drafts: send band invitations to directors, invite partners or booths, import spreadsheets, and send team invitations. That is real use of a feature the account hasn't paid for, and it sends email under our name.
- Who it hurts: An organizer exploring other event types, who hits an error. It also hurts the business, through unpaid use.
- Standard: Error prevention
- Severity: 3
- Size: Medium
- Suggested fix: Change the trigger to allow drafts of any type, and leave the publish check (`org_publish_reason`) as the gate. Add one database helper, `event_is_trial(event)`, that is true when the event's type isn't covered by the package or by an unused pass. Use it to refuse outside invitations and registrations on trial events, with a plain message ("Inviting bands needs a plan that includes band contests"). Team invitations can stay allowed. The picker copy leaves out that a one-time event pass can also unlock publishing, even though the database supports it (`event_passes`). Ask the owner whether the pass should be mentioned.

### Ended conferences still count toward the one-at-a-time limit, and the plan's end date isn't stored
- Where: 03 picker-ended ("Fall conferences runs until Feb 12… publish it after Feb 12"), 21 blocked ("plan ended Jan 1")
- What happens: `org_publish_reason` counts every published conference, including ones that are over. So the promise "publish it after Feb 12" would not come true unless the organizer first unpublishes Fall conferences. The account also has no "plan ended on" date. `free_until` exists only for trial and complimentary plans, so "ended Jan 1" can't be shown for a canceled paid plan. A conference with weekly hours (one published while a plan was active) has no clear end date to compare against.
- Who it hurts: The teacher who comes back on Feb 13 to publish, gets refused, and doesn't know why.
- Standard: Visibility of system status; product rule "conferences that have already ended don't count"
- Severity: 3
- Size: Small (limit), small (end date)
- Suggested fix: In the one-at-a-time check, count only conferences where `ends_on >= today` in the event's own time zone. For weekly-hours conferences, use their last bookable day. Store `plan_ended_on` on `organizations`, set when the plan stops being active, and read the date shown on 03, 05, and 21 from it. Use the same check to work out the "runs until" date on 03, so the screen and the database can't disagree. Add security tests for an ended conference (allowed) and a running conference (refused).

### "Publish needs at least one ready job" is only on the screen
- Where: 13 ready-none ("Unlocks when 1 job is ready"), 15 live (Hide this job)
- What happens: The publish check in the database only looks at the plan, plus the setup steps for conferences. A second tab, or a slow page, could publish an event with no visible jobs. After publishing, a Host can hide the last ready job that has no sign-ups, which leaves a live page with nothing to sign up for.
- Who it hurts: The volunteer parent who opens a link with nothing on it, and the organizer who doesn't notice.
- Standard: Error prevention
- Severity: 3
- Size: Small
- Suggested fix: In `events_publish_needs_plan`, refuse to publish a volunteer event with no ready job that has at least one shift or item. When someone tries to hide the last ready job on a live event, block it with the same message, or ask "This leaves the sign-up page empty. Close sign-up instead?"

### "Can't hide while people are signed up" needs a database rule that also counts items and groups
- Where: 18 job-live (locked "Hide this job"), 19 job-live-error (spots below sign-ups)
- What happens: Lowering spots below the number signed up is already refused by the database (`shifts_set_event_id`), which is good. But the error that comes back is a technical one ("Capacity cannot be lowered below the % volunteers already registered"), and the screen's count of "2" can be out of date by the time someone saves. There is no rule at all against hiding a job with sign-ups. Someone could sign up in the second between the page loading and "Hide" being clicked. "Signed up" has to include people bringing items (`station_items.claimed_count`) and everyone in a group sign-up, not just shift spots.
- Who it hurts: The volunteer parent whose sign-up disappears. The organizer, who sees an error they can't understand.
- Standard: Error prevention; Help users recover from errors
- Severity: 3
- Size: Small to medium
- Suggested fix: Add a trigger that refuses `ready = false` whenever any shift on that job has `registered_count > 0`, or any of its items has `claimed_count > 0`. It should lock the same rows `register_volunteer` locks, so the two can't race. Turn both errors into the screen's own words, using the current count from the database, and refresh the number in the form.

### Who can see and change a draft doesn't match the database
- Where: Draft pill on 06, 12, 13, 14, 21 ("Hosts, Co-hosts, and Volunteer Leads only"); 18 ("Last saved by Dee Nguyen", who is the Coordinator); 14 ready-vlead
- What happens: Three mismatches. (1) Coordinators can read the draft event today ("events: staff read" includes every event staff role), so the pill isn't true. (2) Only Hosts and Volunteer Leads can change jobs and shifts ("stations/shifts: managers write"), yet 18 shows a Coordinator as the last person to save. Either Coordinators get a new edit right, or the sample is wrong. (3) "Volunteer Leads can set up", but only Hosts can change the event row ("events: hosts update"), so a Volunteer Lead can't save step 1 Details. Publishing is correctly limited to account members (`publish_gate`), which matches the rule.
- Who it hurts: The organizer, who is told the wrong audience. The PTO president, who hands jobs to other parents expecting them to be able to edit.
- Standard: Consistency and standards; privacy
- Severity: 3
- Size: Medium
- Suggested fix: Have the owner decide two things. Can a Coordinator edit their own job? Can a Volunteer Lead edit Details? Then make the database rules match, and add a security test for each role. Change the pill to the truth ("Draft · your team only") or tighten what Coordinators can read. If Coordinators stay read-only, show 18 with a Host's name.

### Two save styles, no protection when two people edit, and retries that can add a shift twice
- Where: 04 ("We save as you go"), 07 ("Unsaved changes · Save as hidden"), 18 ("Last saved by…"), 19 ("Your changes are still here · Try again")
- What happens: Details save on their own, but the job form has to be saved by hand. Someone who leaves the job form loses their work, even though step 1 taught them saving happens on its own. There are no "updated by" or "updated at" columns, so "Last saved by Dee Nguyen, 8:14 PM" has no source. If two people edit the same job, the last save silently wins. "Try again" after a timeout can create a second copy of the shift when the first save actually went through. "Your changes are still here" stops being true if the phone reloads the page.
- Who it hurts: The PTO president editing on a phone in the car line on a weak signal. The organizer sharing setup with a co-host.
- Standard: User control and freedom; Interruption-proof
- Severity: 3
- Size: Medium
- Suggested fix: Pick one style for the whole flow. Either save each field on its own (simplest to explain), or keep "Save" and warn before leaving with unsaved changes. Add `updated_at` and `updated_by` to `stations` and `shifts`. Send the `updated_at` you started from with each save, and refuse if it has changed ("Dee changed this job at 8:14 PM. Reload to see her changes"). Make the new shift's id on the phone (the shifts insert grant already allows `id`), so a retry can't create a second copy. Keep unsent changes in the browser's storage, as a convenience only.

### Publish and open sign-up are two separate saves
- Where: 12 ready ("Publish and open sign-up"), 21 blocked
- What happens: The existing `publishAndOpenSignups` publishes first, then opens sign-up as a second step. If the second step fails, the event is live with sign-up closed and the organizer is told it failed. The plan can also end, or another conference can get published, between loading 12 and clicking. The refusal must then land on screen 21, not on a generic error.
- Who it hurts: The organizer, who shares a link that doesn't let anyone sign up.
- Standard: Visibility of system status
- Severity: 2
- Size: Small
- Suggested fix: Use one database function, `publish_volunteer_event(event, open_signup)`, that does both in a single step. Recognize the plan refusal and send the organizer to the 21 state with the database's reason.

### "Check-in opens Fri, Feb 5 at 6 PM" changes a privacy timer
- Where: 12 ready, 15 live ("Your check-in screen opens Fri, Feb 5 at 6 PM")
- What happens: Today check-in is open on the event's own calendar days (`is_event_day`). That same function decides when Coordinators can see volunteers' phone numbers and emails (`station_roster`, and the copy on 07). Opening at 6 PM the night before would widen that window too, unless the two are split apart.
- Who it hurts: The volunteer parent, whose phone number would be shown earlier than they were told.
- Standard: Privacy
- Severity: 2
- Size: Small
- Suggested fix: Either show the real rule ("opens Sat, Feb 6") or add a separate `check_in_open(event)` for the screen. Leave `is_event_day` alone for contact details. Add a security test that a Coordinator still can't see phone numbers the evening before.

### Moving a volunteer is a new feature, and the people list must respect roles
- Where: 18 ("See the 2 people signed up to move them"), 20 shift-people (Move, Remove, emails shown)
- What happens: There's no way to move a volunteer today, only to cancel (`cancel_assignment`). A safe move has to do several things in one step: check room on the new shift, keep group sign-ups and minors' consent with the right person, update the calendar invite, write volunteer history, and send one email. Screen 20 shows email addresses and doesn't say who is looking. A Coordinator before event day must not see them (`station_roster` hides them), and Move and Remove should only appear for Hosts and Volunteer Leads. Remove takes effect and sends an email in one tap, with no undo.
- Who it hurts: The volunteer parent, who could get moved into a full shift, get two emails, or have their contact details seen too early.
- Standard: Error prevention; privacy
- Severity: 2
- Size: Medium
- Suggested fix: Add a `move_assignment(assignment, to_shift)` database function that locks both shifts, refuses when the target is full, moves the whole group as one, and queues one "your shift changed" email. Show the people list for each role using `station_roster`'s rules. Ask for confirmation before Remove ("Remove Ana Lopez? We'll email her"), or send the email after a short undo window.

### "Start from a past event" is new and has date and time-zone traps
- Where: 06 jobs-empty
- What happens: Nothing copies events today. Copying means moving every shift by the gap between the old and new dates. That has to happen in the event's local time, or shifts land an hour off across daylight saving time or a change of time zone. Two-day events copied onto a one-day event lose a day. Item counts and Coordinators need clear rules: Coordinator invitations shouldn't be re-sent automatically.
- Who it hurts: The PTO president, who wants to reuse last year's event and would get wrong shift times without noticing.
- Standard: Flexibility and efficiency; Error prevention
- Severity: 2
- Size: Medium
- Suggested fix: Add a `copy_jobs_from(source, target)` database function that reuses `reschedule_event`'s local-time date math. It copies jobs as hidden, shifts with zero sign-ups, items with zero claimed, and no Coordinators. It refuses (or asks) when the source has more days than the target, and lists the shifts that didn't fit.

### Multi-day and odd-hour shifts
- Where: 09 job-multiday, 07 job-edit, 10 preview (Parking 8:30 AM shift on a 9:00 AM event)
- What happens: The Day + Starts + Ends form can't make an overnight shift: the database refuses a 10 PM to 2 AM shift because it "ends before it starts". One radio button per day doesn't scale past about a week. Making the event shorter later leaves shifts on days that no longer exist, because `reschedule_event` only shifts by the start date. The sample shows a shift that starts before the event does, and nothing says whether that's allowed.
- Who it hurts: Fair or overnight event organizers. Volunteers who get a shift on a day that was dropped.
- Standard: Error prevention
- Severity: 2
- Size: Small to medium
- Suggested fix: When Ends is earlier than Starts, save the end on the next day and show "(next day)". Switch to a day dropdown when the event is longer than 7 days. When the dates shrink, list the shifts that now fall outside and make the organizer move or delete them before saving. Allow setup shifts before the event's start, but show "Starts before the event" next to them.

### Volunteer Lead's "Copy a note for Hana" needs data the Volunteer Lead can't read
- Where: 14 ready-vlead, 21 blocked ("Ask Hana Patel")
- What happens: A Volunteer Lead is event staff, not an account member, and the rules on `profiles` don't let them read the hosts' names. The screen also has to choose which Host to name when an account has several. Copying to the clipboard can fail on some phones and older browsers.
- Who it hurts: The Volunteer Lead, who would see a blank or wrong name.
- Standard: Recognition rather than recall
- Severity: 2
- Size: Small
- Suggested fix: Add a database function, `event_publishers(event)`, that returns the names (not emails) of the Account Host and Co-hosts to the event's staff. Name the Account Host first. If copying fails, show the note in a box so it can be selected by hand. Optionally add a "Tell the hosts" email later, through the system emails list.

### Long names and the shared link
- Where: 03 picker-ended desktop light and dark (the "Fall conferences runs until Feb 12" badge runs past the card's right edge), the draft pill at phone width on 06, 12, 13, 14, and 21 (it runs into the right margin), 15 live (link)
- What happens: Real event names are longer than the samples, and the pills don't wrap. With saving on its own, the link's short name (`slugify`) would come from whatever was typed first, maybe "ced". The sample link also drops the random ending today's links have, so two events with the same name would collide.
- Who it hurts: Volunteers who get a strange link. Organizers on a phone.
- Standard: Reflow (WCAG 1.4.10)
- Severity: 2
- Size: Small
- Suggested fix: Let pills wrap and cap the event name inside them. Create the link's short name the first time the event is published, not at first save, keep the random ending, and never change it after publishing.

### "You closed sign-up on Jan 28" has no data behind it
- Where: 17 live-closed
- What happens: Whether sign-up is open is stored as a plain yes/no, with no date and no name. "You" is wrong when a Co-host closed it.
- Who it hurts: The organizer, who might be misled about who did what.
- Standard: Visibility of system status
- Severity: 1
- Size: Small
- Suggested fix: Add `signup_changed_at` and `signup_changed_by`, and show "Closed Jan 28 by Hana Patel" (or "by you").

## Working well
- Plan limits already live in the database (`plan_tiers`, `org_publish_reason`, and a lock so two conferences can't be published at the same moment). The new rules extend existing code rather than adding a parallel system.
- Spots can't go below the number signed up: the database already refuses it, so 19 only needs a friendlier message.
- "Coordinators see who signed up. On event day they also see phone numbers and emails" matches what `station_roster` really does today.
- Reminder emails and the daily email job already skip events that aren't published, so the unpublish warning (16) stays honest.
- Showing "Close sign-up instead" inside the unpublish dialog maps cleanly onto the existing open/close setting.
- The support email shown matches `brand.supportEmail`. Read it from `src/lib/brand.ts` when building.

Screenshots opened: 01–21 phone light and desktop light (all 42); dark: 01-phone, 02-desktop, 03-tablet, 04-phone, 05-desktop, 06-tablet, 07-phone, 08-desktop, 09-tablet, 10-phone, 11-desktop, 12-tablet, 13-phone, 14-desktop, 15-phone, 16-phone, 17-tablet, 18-phone, 19-desktop, 20-phone, 21-tablet.
