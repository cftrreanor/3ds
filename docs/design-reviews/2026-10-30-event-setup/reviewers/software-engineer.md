# Software Engineer

## Headline
The setup flow is built on solid ground. Times are handled correctly across daylight saving time, the privacy rules live in the database, and shifts that people have signed up for can't be deleted by accident. The biggest risks are in what happens around a save. People can lose work when they leave a page without saving, and a routine save to Event settings can quietly email every volunteer or undo a teammate's change. Several saves are also two or three separate writes, so they can end up half done. Most fixes are small or medium. The planned mock-ups add a few large features that look like small boxes on the page.

Each finding has a severity (0–4) and an effort to fix (small, medium, or large).

## Findings

### Leaving a page throws away unsaved work, and only some links ask first
- Where: New event form (screen 2), Volunteer Setup (screen 4), and Event settings (screen 5), at all widths and in both modes.
  - New event form: "All events" is a plain link (events/new/page.tsx:71, and setup-steps.tsx:36–44 only adds the check when `guard` is set). "Change the kind of event" is also a plain link (events/new/page.tsx:57–61).
  - Volunteer Setup: only the sign-up tabs check for unsaved changes (station-steps.tsx:155, 196). "+ Add sign-up" doesn't (station-steps.tsx:186). Neither do "Back to…", the Checklist link, or the header links, and nothing warns when the browser tab closes or reloads.
  - Event settings: `settings-nav.tsx:30` marks the section as saved on submit, before the server answers. If the save fails, the page no longer warns before leaving.
- What happens: Someone fills in half of the new event form, then taps "Change the kind of event" or "My events". Everything they typed is gone, with no warning. On Volunteer Setup, someone edits a sign-up's instructions and taps "+ Add sign-up" or "Back to Cedar Ridge…", and the changes are lost the same way.
- Who it hurts: The PTO president, who gets interrupted in the car line. The teacher, whose lunch ends mid-form. On a phone, tapping the browser back button by mistake is common.
- Standard: Heuristic 3 (user control and freedom), plus our own "interruption-proof" rule. The plan's S3 "Editing" state says "Leaving asks first", which matches.
- Severity: 3
- Effort: medium
- Suggested fix: Build one shared "unsaved changes" check for every setup page. It should track whether any form is unsaved, and only mark a form as saved once the server confirms it (the existing `form-saved` event). It should catch in-app link clicks in the capture phase, including the header and "Back" links, and add a `beforeunload` warning for closing or reloading the tab. Then remove the three separate versions in setup-leave.tsx, settings-nav.tsx, and station-steps.tsx.

### Saving event details can email every volunteer without warning
- Where: Event settings → Event details → Save changes (screen 5). `updateEvent` in dashboard/actions.ts:240–254.
- What happens: Changes to the name, date, time zone, venue name, or address set off `notifyVolunteersOfChanges` for every shift. That emails each volunteer an updated calendar invite. Fixing a typo in the event name counts too. The save button and the page give no hint that emails will go out. Fixing two typos in a row sends two rounds of email. With 300 volunteers, one rename sends 300 emails. The lookup at actions.ts:72 puts every shift ID into one request (`.in("shift_id", shiftIds)`), and an event with hundreds of shifts can make that request too long for the server to accept.
- Who it hurts: The organizer at a laptop, who can't predict what a save sends. Volunteer parents, who get repeat emails they don't need and learn to ignore the ones that matter.
- Standard: Heuristic 5 (error prevention), heuristic 1 (visibility of system status), and the brief's "hidden emails" item.
- Severity: 3 (for a published event that has sign-ups)
- Effort: small
- Suggested fix: When the event is published and has sign-ups, and the date, time zone, or place changed, ask first: "Save and email updated times to 312 volunteers?" with "Save without emailing" as the other option. Don't email for a name-only change, or batch it into the next scheduled update. Look up the volunteers by event (a join on shifts.event_id) instead of a list of shift IDs.

### A teammate's change, or a page left open in another tab, can be silently overwritten
- Where: Event settings → Event details (dashboard/actions.ts:206–237), and a sign-up's details on Volunteer Setup (`updateStation`, actions.ts:430).
- What happens: Every save writes every field. Every save also runs `reschedule_event`, which moves shifts. Nothing checks whether someone else saved in between. Say Event settings was left open in a tab from last week, before Pat moved the event to Dec 13. Saving that tab moves the event, and all its shifts, back to Dec 6, then emails every volunteer the old date. The "Co-host Pat Kim saved this at 4:54" line shows who saved last, but it doesn't stop an overwrite. Two Coordinators editing the same sign-up work the same way: whoever saves last wins.
- Who it hurts: The PTO president, who hands jobs to other parents. The organizer, who trusts the "saved" line.
- Standard: Heuristic 5 (error prevention). The brief's "two people editing at once".
- Severity: 3
- Effort: medium
- Suggested fix: Send the record's last-saved time (`updated_at`) as a hidden field with each form. If the record changed since the form was loaded, refuse the save and say "Pat Kim changed this at 4:54 PM. Reload to see their changes, then make yours again." Separately, only call `reschedule_event` when the dates, hours, or time zone actually changed.

### Some saves are several separate writes and can end up half done
- Where:
  - `updateEvent`: the details are written, then `reschedule_event` runs as a second call (actions.ts:206–238).
  - `generateShifts` ("Redo or add shifts"): it checks the existing shifts, deletes them, then inserts new ones (actions.ts:700–735).
  - `publishAndOpenSignups`: it publishes, then opens sign-ups (actions.ts:311–316).
- What happens: On a weak connection, or if the second call fails, the organizer sees an error even though half of the change already saved:
  - The name is saved but the date isn't.
  - The event is published but sign-up is still closed, after they confirmed "Publish and open sign-ups".
  - In `generateShifts`, if the insert fails after the delete, the sign-up loses all its shifts. If a volunteer signs up between the check and the delete, their shift survives and the new ones are added next to it, so the slots overlap.
- Who it hurts: The organizer, who can't tell what saved. Volunteers, if shifts change under them.
- Standard: Heuristic 1 (visibility of system status) and heuristic 9 (help users recover from errors).
- Severity: 2
- Effort: medium
- Suggested fix: Move each of these into one database function that runs in a single transaction: one for updating details and rescheduling, one for replacing a sign-up's shifts that also locks them, and one for publishing and opening sign-ups. Add a matching case to supabase/tests/security_test.sql.

### The sign-up link and QR code can be copied before the event is live
- Where: Volunteer Setup status card, draft state (screen 4, all widths). Copy link and QR code at volunteering/page.tsx:236 and the QR download beneath it.
- What happens: A draft event still shows "Copy link", the QR code, and "Download QR code". If a teacher texts that link to 40 parents or prints the QR on a flyer before publishing, every parent who opens it gets a page that doesn't work. Only the team sees the "Preview: this page isn't public yet" card (e/[slug]/volunteer/page.tsx:120–137). The plan already says the opposite: "Publish to get your links" (IAEvent, S2 "Share" folded until published).
- Who it hurts: Volunteer parents on a phone, who hit a dead end from a group text. The organizer, who has to send the link again.
- Standard: Heuristic 5 (error prevention).
- Severity: 3
- Effort: small
- Suggested fix: Before the event is published, replace Copy link and the QR code with "Preview page" plus one line: "Publish to get your sign-up link." Show the link once the event is published, as the plan does.

### Shifts can fall outside the event's hours, and overnight shifts can't be made at all
- Where: Event form "Gates open / first volunteers arrive" (event-form.tsx:283–288), `createShift` and `updateShift` (actions.ts:621–668, 756–800), and `generateShifts` (actions.ts:706–723).
- What happens:
  - A shift's day and time aren't checked against the event's dates or hours. The screenshots show a 5:00 AM Parking shift at an event whose header says 7:00 AM–10:00 PM, and that header label says it's when the first volunteers arrive. The public page then gives two different start times.
  - A shift's end time must be later than its start on the same day (actions.ts:638), so a 10 PM–2 AM shift (an after-prom party or overnight lock-in) can't be entered at all.
  - A one-day event that ends after midnight fails with "End time: End time must be after the start time" (actions.ts:146). The form doesn't say that "Lasts more than one day" is the way around it.
  - Multi-day events must use the same hours every day. "Fill the day" splits each day using the first day's start time and the last day's end time (actions.ts:706–707). So a Friday 5–9 PM plus Saturday 8 AM–5 PM fair gets shifts from 5 PM to 5 PM, and the window can come out negative (volunteering/page.tsx:160).
- Who it hurts: The organizer. Volunteer parents, who see a time on the page that doesn't match their shift.
- Standard: Heuristic 2 (match with the real world) and heuristic 5 (error prevention).
- Severity: 2
- Effort: medium
- Suggested fix: Allow an end time earlier than the start to mean "the next day", for both shifts and the event, and show "ends next day" in the form. Warn, without blocking, when a shift falls outside the event's dates or hours, with a one-tap "Change event hours to 5:00 AM". Longer term, store hours for each day of a multi-day event.

### "Done" means three different things for a sign-up
- Where:
  - The checklist marks the sign-ups step done if the event has any sign-up and any shift (setup-checklist.ts:93, 175).
  - The tabs say "Draft, not finished" until each sign-up's details are saved (station-steps.tsx, `status()`).
  - The event page's Volunteers card counts everything ("5 sign-ups · 4 shifts").
- What happens: These can disagree on the same screen. If Parking has shifts but Concessions has none, the checklist marks the step done and never mentions Concessions. All five tabs in the screenshot say "Draft, not finished" while the event page counts them as set up. (The screenshot's checklist also says the step isn't done, even though the event has 5 sign-ups and 4 shifts. That may be the demo data, but someone should check it.) The plan's "Needs you: Concessions has no shifts" and "2 shifts have no lead" need facts for each sign-up, and the current checklist doesn't load them.
- Who it hurts: The organizer, who needs to know what's done and what's left. The PTO president, who could miss something without noticing.
- Standard: Heuristic 4 (consistency and standards) and heuristic 1 (visibility of system status).
- Severity: 2
- Effort: small–medium
- Suggested fix: Write one function that decides whether each sign-up is ready (details saved, at least one slot or item, a lead if one is required). Use it for the tabs, the checklist, the event card, and the planned "Needs you" list. The checklist step is then done only when every sign-up is ready.

### "Volunteers signed up" and "spots filled" are counted from different data
- Where: Event page Volunteers card (screen 3). The volunteer count comes from page.tsx:243, which counts rows in the volunteers table. "Spots filled" adds up each shift's sign-up count.
- What happens: These can't be compared, and real events will show confusing pairs:
  - One parent who takes three shifts adds 1 to "volunteers" and 3 to "filled".
  - People who cancelled may still be counted as volunteers.
  - People bringing items and group members are counted differently in each.
  The demo's "412 volunteers" next to "10 of 19 spots filled" is impossible data, but smaller gaps like these will be real.
- Who it hurts: The organizer, who uses these numbers to decide whether to send another plea for help.
- Standard: Heuristic 1 (visibility of system status) and heuristic 4 (consistency and standards).
- Severity: 2
- Effort: small
- Suggested fix: Count distinct people with at least one active sign-up for this event, and label it "People signed up". Or drop that tile and keep "spots filled" and "open spots", which always agree.

### Error messages don't help, and they don't sit next to the field
- Where: Event form and time slot form (actions.ts:42–46, `firstIssue`), and `friendlyDbError` (lib/action-state.ts:60).
- What happens:
  - Only the first problem is reported, as one message at the top of the form. It repeats its own label ("End time: End time must be after the start time") and isn't attached to the field.
  - Lowering a time slot's spots below the number of people already signed up hits a database rule. The organizer sees "Some of the values aren't valid. Please check the form."
  - The code to attach an error to its field (`fieldErrorState`, action-state.ts:30) already exists, but these actions don't use it.
- Who it hurts: The organizer and the teacher, who have to guess what to fix.
- Standard: WCAG 3.3.1 and 3.3.3, and heuristic 9 (help users recover from errors).
- Severity: 2
- Effort: small
- Suggested fix: Return `fieldErrors` from the event and shift actions. In `updateShift`, check the spots before saving: "6 people are signed up. Set at least 6 spots, or remove someone first."

### The back button after "Save and continue" leads to duplicate events
- Where: New event form → Save and continue (`createEvent`, actions.ts:151–190).
- What happens: After the event is created, the browser's back button opens a blank new event form. Someone who thinks they went back to step 1, and fills it in again, creates a second draft. Nothing stops the same form from being sent twice.
- Who it hurts: The teacher and the PTO president, who end up with "Spring Fair" twice on My events and then edit the wrong one.
- Standard: Heuristic 5 (error prevention).
- Severity: 2
- Effort: small
- Suggested fix: Put a one-time token in the form and reject a second save that uses it. If a draft with the same name was created by this person in the last few minutes, offer "Continue setting up Spring Fair" instead.

### Uploading a logo on the new event form changes every live event right away
- Where: New event form, "Logo and color" (setup-logo.tsx, logo-form.tsx:40–62).
- What happens: The logo is saved to the whole account the moment it's uploaded, before the new event exists. It changes the public pages and badges of every event that's already published. It stays even if this new event is abandoned. The help text says "One logo for your account", but it doesn't say this also changes events that are already live.
- Who it hurts: An organizer trying out a logo for one event, whose live events change without them realizing.
- Standard: Heuristic 1 (visibility of system status).
- Severity: 2
- Effort: small
- Suggested fix: Add "This changes the logo on all your event pages now" next to Upload. Or move the logo to Event settings, where its scope is clearer.

### "No logo yet" is invisible in dark mode
- Where: The empty logo box, on the new event form and in Event settings, at all widths, in dark mode only. logo-form.tsx:104 and 109.
- What happens: The box always has a white background (`bg-white`), but its text uses the muted text color, which is light in dark mode. The screenshots show an empty white box with no text.
- Who it hurts: An organizer working in dark mode at night (the PTO president).
- Standard: WCAG 1.4.3 (text contrast).
- Severity: 1
- Effort: small
- Suggested fix: Give the placeholder text a fixed dark gray when the background is white, or use the surface color for the empty state and keep white only behind a real logo.

### Pages carry more than they need on a phone
- Where: Volunteer Setup (volunteering/page.tsx:69, 163–166) and the event page (page.tsx:243–354).
- What happens:
  - Every load of Volunteer Setup builds a 1024-pixel QR image and puts it inside the page, even though the QR section starts closed.
  - The event page does the same for each share link once the event is published.
  - Volunteer Setup loads every shift with every column for every sign-up, even though only one tab is open.
  - The event page runs a long chain of database lookups one after another (files, rooms, volunteer count, parent registrations, setup facts, QR codes, announcements). Setup facts alone is 13 count lookups, and it checks host access again.
  On a weak phone signal, these pages load slowly every time someone opens them.
- Who it hurts: The PTO president on a phone in the car line. The organizer on school Wi-Fi.
- Standard: The brief's speed item.
- Severity: 2
- Effort: medium
- Suggested fix: Make the QR image only when someone asks for it, from a small cached address. Load only the open sign-up's shifts in full, plus counts for the other tabs. Run the event page's separate lookups in parallel, and pass the access check down instead of repeating it.

### Unpublishing doesn't end live announcements or tell volunteers
- Where: Event page publish panel ("You can… unpublish at any time"). `setEventPublished(false)` in actions.ts:283–301.
- What happens: Unpublishing closes sign-up, but announcements stay "live". The screen can then show a "Draft" event with "2 live announcements", and that can happen in real life. Volunteers who already signed up get no message, and their link stops working.
- Who it hurts: Volunteer parents, who find a dead link. The organizer, who was told unpublishing is harmless.
- Standard: Heuristic 5 (error prevention) and the claims guardrails ("You can unpublish at any time" is only true in part).
- Severity: 2
- Effort: small–medium
- Suggested fix: When people have signed up, ask before unpublishing: "47 people have signed up. Their links will stop working until you publish again." End or pause live announcements on unpublish. Change the bullet to say what unpublishing does.

### The plan includes several large features that look like single boxes
- Where: Mock-ups IAEvent, S2Event, and S3Setup.
- What happens: These need new data, background jobs, or emails, and none exist yet:
  - "Copy for next year" (large): a deep copy of sign-ups, shifts, rooms, and documents, including copying the files themselves, with dates moved to the new year across daylight saving time, and "no people". Nothing like it exists in the code.
  - "Turn on a waitlist" (large): a new table, moving people up when someone cancels, emails, and privacy rules.
  - "Opens Sat 9 AM" (medium): the only scheduled job runs once a day (vercel.json, 15:00 UTC), so sign-ups would need to be "open" based on the time when the page is read.
  - "Live numbers · Updated 1 min ago / Offline" (medium): needs automatic refresh and offline detection.
  - The event page changing by phase, including "evening before to morning after" (medium): needs one well-tested function that decides the phase from the event's time zone and handles multi-day events.
  - "Archived · Read-only" (medium): the database has an `archived` status, but nothing ever sets it, and nothing blocks edits on an archived event.
  - "Records: Phone numbers deleted Nov 24" (small–medium): the daily cleanup would need to record when it ran for each event.
  - "Changing a time warns how many people are booked" (small).
- Who it hurts: Everyone, through the schedule. If these are sized as layout changes, they'll slip or ship half-built.
- Standard: None (planning risk).
- Severity: 2
- Effort: as rated above
- Suggested fix: Split the plan into a layout-only release (reordering blocks by phase using data that already exists) and separate feature tickets for the items above, each with its own data and privacy review and security test cases.

## Working well
- Times are handled correctly across daylight saving time (lib/time.ts:68–76, `zonedToUtc`). Every page and email uses the event's time zone, whatever someone's phone is set to.
- Moving the event date moves its shifts in one database call (`reschedule_event`), and the form warns about it ("A 7:00 AM shift stays at 7:00 AM on the new day").
- The privacy rules are enforced in the database. `station_roster` shows phone numbers and emails to Coordinators only on event day, and to managers always (20270102000000_group_signup.sql). Children's and phone data have clear deletion windows.
- Shifts and sign-ups that people have joined can't be deleted (actions.ts:524–532, 803–809), and "Fill the day" refuses to replace slots that have sign-ups.
- Required fields are handled once, the same way everywhere (components/required-fields.tsx). The save button looks faded but still works, and problems are only marked after someone tries to save.
- The guided setup's "Save and come back" waits for the server to confirm the save before moving on (setup-leave.tsx:219–249). That's the right model for the shared "unsaved changes" check suggested above.
- Publishing says plainly that nobody is emailed and sign-up stays closed (`publishEffects`). Plan limits are explained before the click, not as an error afterward.
