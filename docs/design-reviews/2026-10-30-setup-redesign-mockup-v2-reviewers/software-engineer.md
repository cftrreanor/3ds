# Software Engineer

## Headline
Most of this can be built on what the app already has: shifts that can't drop below the number signed up, items to bring, "sign-up open or closed", publishing checks, rescheduling that moves shifts, and the daily summary and reminder emails. The new piece is the "hidden job" (a job marked ready or not), and it touches the privacy rules in many places. Today anyone on the event team, and any visitor once the event is published, can read every job. The design also assumes plan rules that differ from the ones the database enforces. Neither problem is visible in the mock-up, and both have to be settled before building.

## Findings

### "Hidden" jobs don't exist yet, and today every job is readable once the event is published
- Where: 06 job-edit, 07 job-items, 08 preview, 09 preview-lead, 10 ready, 12 live (all widths and modes)
- What happens: The database has no "ready" setting on a job. The privacy rules let anyone (no sign-in needed) read every job, shift, and item of a published event. Every Section Lead can read every job of their event. The public sign-up page loads jobs using the signed-in person's own access. So a Host, Co-host, or lead who opens the live link would see hidden jobs mixed in with the open ones, looking like normal jobs. The page also calls the item board ("who's bringing what") and the sign-up step, and neither checks visibility. Someone who has an old link or a shift's ID could still sign up for a hidden job.
- Who it hurts: Volunteer parent (sees or signs up for jobs that aren't finished). Organizer (trusts "Hidden: volunteers can't see this job", but it isn't true).
- Standard: Error prevention. Project rule: privacy rules live in the database.
- Severity: 3
- Size: Medium. Add a "ready" column to jobs. Change the public read rules for jobs, shifts, and items to "event published and job ready". Change the staff read rule so a lead sees only hidden jobs they lead, while Hosts, Co-hosts, and Volunteer Directors see all of them. Make the sign-up step and the item board reject hidden jobs. Make the public page always ask for ready jobs only, whoever is signed in. The project rules require a matching case in the security tests for each of these.
- Suggested fix: Build it as described. Then make preview (08, 09) a separate server-side read that checks who is asking. It must never be a public page with a "?preview" switch.

### Plan rules in the design don't match the rules the database enforces
- Where: 01 picker, 02 picker-conf, 06 job-edit (Lead), 12 live (unpublish note), 15 blocked
- What happens: Each account already has a package (Free, Schedule Command, Volunteer Command, and so on) plus one-time event passes. A function gives the reason an event can't be published, in plain words. The design shows one fixed message ("one parent-teacher conference at a time, write to us"), but the real reason varies:
  - A pilot account whose plan ran out falls back to Free rules for publishing but keeps its own package for drafts and its team.
  - A true Free account (teacher accounts) can't create a volunteer event draft at all today. The database refuses it, so the picker's "You can still set up any kind of event" is false for those accounts.
  - Free and Schedule Command can't add Volunteer Leads or Section Leads, so the Lead invite in 06 would fail.
  - An account with an unused volunteer pass can publish, so the "Publishing needs a plan" badge would be wrong for it.
  - 12's "if you unpublish this one it stays offline" is wrong when this event already used a pass.
- Who it hurts: Organizer, PTO president, and teacher, who get told one thing on screen and hit a different wall when they act.
- Standard: Visibility of system status. Error prevention.
- Severity: 3
- Size: Medium. Decide whether Free accounts may create drafts of every event type. If so, loosen the "event type must be in the package" check for drafts, keep the check at publish, and add security tests. Then drive every badge and banner from the existing publish check per account and per type, instead of fixed copy. Show the Lead field locked, with the reason, when the package doesn't include leads.
- Suggested fix: For each of 01, 02, 06, 12, and 15, decide which plan states are possible, and show the database's reason in each one. Add mock-ups for "has a pass" and "package doesn't include leads".

### "Can't hide or delete while someone is signed up" is only checked by the app, and the check can be beaten by timing
- Where: 14 job-live (Hide this job, Delete shift); also deleting a job
- What happens: The minimum number of spots is enforced in the database (good). Deleting a shift or job is only checked by the app: it counts sign-ups first, then deletes. Deleting a job or shift also silently deletes the sign-ups attached to it. If a parent signs up in the moment between the count and the delete, their sign-up disappears and nobody is told. If "Hide" is built the same way, the same thing would happen: a job could end up hidden with someone signed up for it, which breaks one of the fixed product rules.
- Who it hurts: Volunteer parent (shows up for a shift that no longer exists). Organizer (roster is wrong).
- Standard: Error prevention.
- Severity: 3
- Size: Small. Add database checks before delete on shifts, items, and jobs, and before hiding a job. Each check locks the rows it reads, the way sign-up already does. Have the sign-up step lock the job row as well. Add security tests.
- Suggested fix: Make the database the only place these rules are enforced. The app keeps the friendly message shown in 14.

### Shifts have no day picker, but events can run more than one day
- Where: 03 details ("Ends on a different day") vs 06 job-edit and 14 job-live (New shift has only Starts, Ends, and Spots)
- What happens: Shifts are stored as a full date and time. The current sign-up page already shows the day when an event spans several days. The new shift form has only times, so on a two-day fair there's no way to put a shift on day 2. The shift lists in 14 and the preview in 08 also show times with no day.
- Who it hurts: Organizer of a weekend fair or festival, who can't set up the second day.
- Standard: Match with the real world.
- Severity: 3
- Size: Small. Show a day picker, and the day in the shift label, only when the event spans more than one day.
- Suggested fix: Add a multi-day version of 06 and 14 to the mock-up.

### Rules for "ready" aren't enforced, and some edge cases aren't designed
- Where: 06, 07 (Mark ready), 10 ready, 11 ready-none, 12 live, 14 job-live
- What happens: The design says a job can be marked ready only with at least one shift or item, and an event can publish only with at least one ready job. Nothing shows what happens when:
  - someone deletes the last shift or item of a ready job
  - someone hides the last ready job (with no sign-ups) on a live event, which leaves a public page with nothing to sign up for
  - all of a job's shifts have already ended (the public page drops past shifts, so the job vanishes even though it's "ready")
- Who it hurts: Volunteer parent (opens an empty or broken page). Organizer (thinks it's live and working).
- Standard: Error prevention. Visibility of system status.
- Severity: 2
- Size: Small to medium. Enforce in the database: "ready needs at least one shift or item" and "publishing needs at least one ready job", next to the existing conference readiness check. Add a warning state on 12 when no ready job has an upcoming shift or item left.
- Suggested fix: Add "Your page has nothing to sign up for" to 12 and a mock-up of it. On 14, block deleting the last shift of a ready job, or turn the job back to hidden and say so.

### The preview banners say the wrong people can see a hidden job
- Where: 06 hidden banner ("Your Hosts, Volunteer Directors, and this job's lead"); 09 preview-lead banner ("Only you and the event's Hosts")
- What happens: In the database, Co-hosts are account members and can see everything a Host sees. Volunteer Directors can too. The fixed rule names Hosts, Co-hosts, Volunteer Directors, and the lead, and neither banner matches it. Also, the lead in 06 is shown as "Invited". Until Maria accepts, she has no account access, so she can't preview anything.
- Who it hurts: Organizer and lead, who get the wrong picture of who can see unfinished work.
- Standard: Visibility of system status. Same thing, same word.
- Severity: 2
- Size: Small. This is wording, plus a not-yet-accepted state for the "preview it" link.
- Suggested fix: Use one sentence everywhere that matches the rule. When the lead hasn't accepted yet, say "Maria can preview it after she accepts the invite".

### Details are kept "on this device" until they're complete
- Where: 04 details-errors ("what you've typed stays on this device until you come back")
- What happens: An event row can't be saved without a date, times, and an address (the database requires them), so the design keeps a draft in the browser. That draft won't follow the PTO president from her phone to her laptop. On a shared front-office computer, the next person sees it. It also disappears if the browser clears its data.
- Who it hurts: PTO president (starts in the car line, finishes at night on another device). Front office (shared login).
- Standard: Interruption-proof.
- Severity: 2
- Size: Medium if we save on the server early: either loosen the required fields for drafts, or keep a separate draft table, and then review every page that assumes those fields exist. Small if we keep the browser draft and just label it honestly.
- Suggested fix: Preferred: save a server draft as soon as the event has a name. At minimum, say "on this browser" and clear the draft once it's saved.

### "Copy jobs and shifts" from a past event is a whole new feature
- Where: 05 jobs-empty (Start from a past event)
- What happens: There is no copy feature today. Building it means:
  - choosing among several past events, not only one fixed suggestion, and possibly events of a different type
  - moving every shift to the new date in the new event's time zone, including daylight-saving changes (the reschedule function can be reused)
  - copying items with their "already coming" counts set back to zero
  - dropping leads: re-adding them would hit team limits and would give last year's people access without anyone asking
  - copying jobs as hidden, as the design says
- Who it hurts: PTO president, if it's cut late or shipped half-done. She depends on reusing last year.
- Standard: Flexibility and efficiency.
- Severity: 2
- Size: Medium to large. Treat it as its own work item.
- Suggested fix: Mock up the "pick a past event" step and a summary after copying ("8 jobs, 14 shifts copied as hidden; leads weren't copied"). It's fine to ship the rest first.

### Unpublishing a live event with sign-ups is a one-click link
- Where: 12 live (Unpublish, Close sign-up)
- What happens: Unpublishing today hides the public pages, closes sign-up, and emails nobody. The 2 people already signed up keep links that stop working, and their reminder email the day before still needs a defined behavior. The current settings page asks for confirmation first. 12 shows a plain link.
- Who it hurts: Volunteer parent (link stops working with no explanation). Organizer (may not realize the consequence, especially on a plan where it can't be re-published).
- Standard: Error prevention.
- Severity: 2
- Size: Small for the confirmation. Small to medium to decide and test whether reminders skip unpublished events.
- Suggested fix: Before unpublishing, confirm with the number of people signed up and whether the event can be published again. Make sure reminders and the daily summary skip unpublished events.

### Two organizers editing the same job
- Where: 06, 07, 14 (job editor save bar)
- What happens: Hosts, Co-hosts, and Volunteer Directors can edit the same job at the same time. The last save wins with no warning. The app already records who last saved each part of an event, but the design doesn't show it.
- Who it hurts: PTO president handing jobs to other parents. Organizers working on the same evening.
- Standard: Visibility of system status.
- Severity: 2
- Size: Small to show "Last saved by Maria, 8:14 PM". Medium to detect and warn about a conflicting save.
- Suggested fix: Show who last saved in the job editor. Save each shift as its own change, not the whole job form at once.

### Volunteer Directors can't publish, but nothing shows that
- Where: 10 ready, 12 live, 15 blocked
- What happens: Only the account's Hosts can publish (the database enforces it). A Volunteer Director can reach 10 and press "Publish and open sign-up", only to get an error.
- Who it hurts: A Volunteer Director setting up for the PTO.
- Standard: Error prevention.
- Severity: 2
- Size: Small.
- Suggested fix: For someone who can't publish, replace the button with "A Host publishes this event: ask <name>", the same way 15 does for the Account Host.

### "One conference at a time" counts conferences that are already over
- Where: 02 picker-conf ("Fall conferences is live. Unpublish it to publish another.")
- What happens: The publish check counts any published conference, including one that ended months ago. A teacher has to find and unpublish last fall's finished conference before publishing spring's, and the message calls it "live".
- Who it hurts: Teacher with a 30-minute lunch.
- Standard: Match with the real world.
- Severity: 2
- Size: Small. Count only conferences that haven't ended, in the event's time zone, and add a security test. Or keep the rule and word the message as "still published".
- Suggested fix: Decide which, then match the wording on 02.

## Working well
- The spot limit in 14 ("At least 2, the number signed up") matches a rule the database already enforces for shifts and items. Keep it.
- Sign-up "Later" and "Close sign-up" (10, 12, 13) use the existing sign-up open/closed setting. No new data is needed.
- The lead hint ("On event day they also see volunteers' phone numbers and emails") matches how contact access already works for leads.
- Changing the event's date later is safe: the existing reschedule step moves shifts with it.
- The daily summary email, the reminder the day before, and the QR code and share link all exist already.
- Making publishing the last step (15 still lets you finish setup) matches the database, which checks only at publish time.
- Things-to-bring jobs (07) map directly to the existing items-to-bring setup.

Screenshots opened: 01 desktop, phone, desktop-dark; 02 desktop, phone, phone-dark; 03 desktop, phone, tablet-dark; 04 desktop, phone, phone-dark; 05 desktop, phone, desktop-dark; 06 desktop, phone, tablet-dark; 07 desktop, phone, phone-dark; 08 desktop, phone, desktop-dark; 09 desktop, phone, phone-dark; 10 desktop, phone, phone-dark; 11 desktop, phone, desktop-dark; 12 desktop, phone, phone-dark; 13 desktop, phone, tablet-dark; 14 desktop, phone, desktop-dark; 15 desktop, phone, phone-dark
