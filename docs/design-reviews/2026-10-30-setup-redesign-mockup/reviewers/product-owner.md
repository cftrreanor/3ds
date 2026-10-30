# Product Owner

## Headline
The main path (pick a type, fill in details, add jobs, preview, publish) is designed end to end and is about the right size. It isn't over-built. It isn't buildable as "done" yet, though, because several states that the two fixed rules depend on have no design: a conference when one is already live, a ready job switched back to draft, what a lead (not a Host) sees in preview, and publishing with sign-up kept closed. The sample numbers also contradict each other between screens, so two builders would make different calls about what counts as "filled" and what the publish summary counts.

## Findings

### "One conference at a time" has no blocked state
- Where: 1 Type picker, Parent-teacher conferences card, and 8 Blocked (all widths, both modes)
- What happens: The conferences card always says "You can publish this". Nothing shows what happens when the account already has a published conference. Screen 8 only covers "wrong event type", not "right type, but one is already live".
- Who it hurts: Teacher with a 30-minute lunch. She sets up the second conference day and then finds out at the last step that she can't publish it, with no explanation of which event is in the way.
- Standard: Error prevention (heuristic 5), Visibility of system status (1)
- Severity: 3
- Suggested fix: Design two more states. (a) Picker: when a conference is already live, the conferences badge reads "Set up now, publish after [event name] ends or is unpublished" and links to that event. (b) Event page: a version of screen 8 for a conference, which names the live conference and gives "Go to [event name]" as its main button.

### What a lead sees in preview isn't defined
- Where: 5 Preview (all widths, both modes); 4 Job edit, draft banner ("You and its lead can preview it")
- What happens: The preview shows every draft job, Face painting and Bake sale items alike. The rule says a draft can be previewed by Hosts and by that job's lead. The design doesn't show whether Maria (lead of Face painting) also sees the Bake sale draft, or how she gets to the preview at all.
- Who it hurts: Busy PTO president handing jobs to other parents. If one lead sees another's half-finished job, the draft rule is broken. Organizer at a laptop can't predict who sees what.
- Standard: Fixed product rule (drafts hidden except to Hosts and that job's lead)
- Severity: 3
- Suggested fix: Add a lead's version of screen 5. It shows ready jobs plus only the drafts that lead runs, and the banner says "Preview only. You're seeing your draft job, Face painting. Volunteers can't see it yet." Also design the lead's way in, for example a "Preview" link on the lead's job list.

### No state for a ready job switched back to draft
- Where: 4 Job edit, Parking (Ready, 2 of 4 spots filled); 7 Live, "Manage jobs and shifts"
- What happens: The design only shows draft moving to ready. It never shows a ready job, with people already signed up, being moved back to draft, or whether that's even allowed. The rule says drafts are hidden from volunteers, so those signed-up volunteers would lose sight of their own shift.
- Who it hurts: Volunteer parent on a phone, whose shift disappears. Organizer, who can't tell what the switch does.
- Standard: Error prevention (5), User control and freedom (3)
- Severity: 3
- Suggested fix: Decide the rule and design it. Recommended: a ready job with sign-ups can't go back to draft, and the button is replaced by the sentence "2 people signed up. Move or remove them before hiding this job." A ready job with no sign-ups gets a "Move back to draft" action with a confirm.

### "Keep sign-up closed" has no result screen and no matching button text
- Where: 6 Ready, checkbox and "Publish and open sign-up" button; 7 Live
- What happens: If the box is ticked, the button still says "Publish and open sign-up", which says the opposite. There's no screen 7 for "Live, sign-up closed", and no "Open sign-up" control is shown anywhere.
- Who it hurts: Organizer at a laptop. She doesn't trust what will happen when she presses the button. Volunteers get a page they can't use, with no reason given.
- Standard: Buttons say what happens (content); Visibility of system status (1)
- Severity: 3
- Suggested fix: When the box is ticked, the button changes to "Publish with sign-up closed". Add a screen 7b: badge "Live · sign-up closed" plus a main "Open sign-up" button. Add the volunteer-side "Sign-up opens soon" view to the preview.

### Sample numbers contradict each other across screens
- Where: 4 Job edit (Parking "2 of 4 spots filled") vs 5 Preview ("2 spots left") vs 7 Live ("0 of 24 spots filled"); event hours 10:00 AM–3:00 PM vs Parking shift 8:00–11:00 AM; Parking check-in "North lot" in preview, not shown in editor
- What happens: The event isn't published yet, but Parking already has 2 people in it. Then after publishing, the count is 0. A shift also starts two hours before the event does.
- Who it hurts: Builders first: one will count organizer-added people in "filled" and one won't. Then the organizer, who sees numbers that don't add up.
- Standard: Consistency (4)
- Severity: 2
- Suggested fix: Decide whether organizers can add people to shifts before publishing. If yes, screen 7 reads "2 of 24 spots filled". If no, screens 4 and 5 show 0. Decide whether shifts may fall outside event hours, and show a warning if so. Fix the sample data so every screen agrees.

### Missing states: errors, saving, loading, and empty publish
- Where: 2 Details, 4 Job edit, 6 Ready
- What happens: None of these are designed:
  - Pressing "Save and continue" with Starts and Ends empty (is it disabled, or does it show errors?)
  - Ends before Starts
  - "Saving…" and "Couldn't save"
  - Publish failed
  - A slow load
  - Reaching the publish step with zero ready jobs
  - What the event page shows after the event date has passed
- Who it hurts: Teacher and PTO president working in short bursts on weak connections. A save that fails without saying so loses their work.
- Standard: Visibility of system status (1), Help users recover from errors (9), WCAG 3.3.1 and 4.1.3
- Severity: 3
- Suggested fix: Add one frame each for: Details with field errors (message next to each field, button stays active); save bar showing "Saving…", "Saved", and "Couldn't save. Try again"; publish error; screen 6 with 0 ready jobs (heading "Mark a job ready to publish", publish button replaced by "Go to jobs"); and the event page after the event.

### Sub-flows the screens send people into are not designed
- Where: 3 Jobs empty ("Import from a spreadsheet", "Copy jobs"); 4 Job edit ("+ Add a shift", "Edit", "+ Add a lead", "Import"); 6 Ready ("Invite", "Add"); 7 Live ("QR code"); 8 Blocked ("See what's included", "Talk with us")
- What happens: Every one of these is a button with no destination. Three of them, adding a shift, adding a lead, and the bake-sale "things to bring" job, are required to get from screen 3 to screen 6. Without them the main path can't be built.
- Who it hurts: Organizer at a laptop. She can't finish setup. Builders guess.
- Standard: none (scope completeness)
- Severity: 3 for Add a shift, the item-type job editor, and Add a lead. 2 for the rest.
- Suggested fix: Before build, add frames for the shift editor (time, spots), the "things to bring" job editor (items and counts, as in "cookies (0 of 6)"), and Add a lead. Either design Copy jobs, Import, QR code, and Talk with us, or mark them out of scope for this release and hide them.

### Way back to editing is missing on screens 6–8, and Event settings appears and disappears
- Where: 6 Ready, 7 Live, 8 Blocked (all widths)
- What happens: Screen 6 has "Event settings" but no clear "Edit details" or "Edit jobs". It's not clear whether the step labels are links. Screen 7 has "Manage jobs and shifts" but no Event settings. Screen 8 has neither, so a blocked organizer can't keep working on the event she's told is "saved".
- Who it hurts: PTO president who comes back later and needs to know "where was I?". Organizer fixing a typo.
- Standard: User control and freedom (3), Consistency (4)
- Severity: 2
- Suggested fix: Put the same row of actions on screens 6, 7, and 8: "Edit details", "Manage jobs and shifts", and "Event settings". State plainly whether the step labels are links (recommended: they are).

### Unpublish is promised but not designed
- Where: 6 Ready ("You can keep editing, and unpublish at any time"); 7 Live
- What happens: No unpublish control or confirmation appears on screen 7. It's also not defined what happens to people already signed up, or, for a plan-limited account, whether unpublishing frees the one conference slot.
- Who it hurts: Organizer who published by mistake. Volunteers already signed up.
- Standard: User control and freedom (3), Error prevention (5)
- Severity: 2
- Suggested fix: Add "Unpublish" (secondary, on screen 7) and a confirm dialog: "Unpublish Cedar Ridge Fall Festival? The page goes offline. The 2 people signed up keep their spots and aren't emailed." Write down the slot rule.

### "Preview as a volunteer" shows things volunteers won't see
- Where: 6 Ready and 8 Blocked ("Preview as a volunteer"); 7 Live ("Preview"); 4 ("preview it")
- What happens: The link says "as a volunteer", but the page it opens shows draft jobs. The three entry points use three different labels. There's also no design for the preview after publishing, where the banner "Volunteers can't see this page yet" would be wrong.
- Who it hurts: Organizer, who can't trust what people will see.
- Standard: Same thing, same word (content); Consistency (4)
- Severity: 2
- Suggested fix: Use the single label "Preview sign-up page" everywhere. After publishing, the banner reads "Preview. Volunteers see this page now, without the outlined draft jobs."

### The picker contradicts itself on cost, and its badge is cut off on desktop
- Where: 1 Picker. The "Free during the pilot" text shows at all widths. The cut-off "Set up now, publish with a plar" badge is desktop only, in light and dark. The lock icon shows on Volunteer event only.
- What happens: The banner says the free period ended. The card says "Free during the pilot". The badge text runs past its card on desktop. Only one of the three locked types has the lock icon. The brief lists fairs and meetings, but the picker shows only four types.
- Who it hurts: Organizer deciding whether to start, and the teacher who needs to know right away.
- Standard: Consistency (4), Match with the real world (2)
- Severity: 2
- Suggested fix: Pick one statement of cost for conferences. Give all three locked badges the same icon, and let them wrap inside the card. Confirm the full list of types: either show all of them, or note that the others are out of scope.

### Disabled buttons look enabled in dark mode
- Where: 4 Job edit "Save and mark ready" (dark, all widths); 8 Blocked "Publish and open sign-up" (dark, all widths)
- What happens: In light mode both are greyed out. In dark mode they look like normal secondary buttons, so the spec doesn't make clear whether they're disabled.
- Who it hurts: Organizer working late at night in dark mode, who presses a button that does nothing.
- Standard: Consistency (4), WCAG 1.4.1 (state not by color alone)
- Severity: 2
- Suggested fix: Define a disabled style for dark mode. Add the reason next to the button in both modes ("Add a shift first" and "Needs a plan").

### Job editor shows another job's shifts without saying why
- Where: 4 Job edit. On desktop the Parking panel sits on the right; on phone and tablet it sits below the form.
- What happens: While editing Face painting, a Parking panel with Edit and Delete buttons sits beside or below the form, with no heading to explain it. It isn't clear whether it's a summary, a second editor, or a mock-up leftover. A builder can't tell what to build.
- Who it hurts: Organizer, who may edit or delete the wrong job's shift.
- Standard: Aesthetic and minimalist design (8), Recognition rather than recall (6)
- Severity: 2
- Suggested fix: Remove the panel, or show the shifts of the job being edited inside its own "Shifts" section. If a side summary is wanted, title it "Other jobs" and make it read-only.

## Acceptance criteria

Plan and type
- Given an account whose free period has ended, when the organizer opens the type picker, then every type can be chosen, and only parent-teacher conferences say they can be published
- Given that account has a published conference, when the organizer picks conferences, then the card says another conference is live and names it
- Given a non-conference event on that account, when the organizer reaches Publish, then the publish button is disabled with the reason, the event stays a draft, and every edit link still works
- Given that account adds a plan, when it returns to the event, then Publish is enabled with no setup redone

Details
- Given a required box is empty, when the organizer presses "Save and continue", then the event is not created, each empty box shows its own error, and focus moves to the first one
- Given Ends is earlier than Starts, when saving, then an error appears next to Ends
- Given details are saved, when the organizer leaves and comes back, then the progress bar shows "Details done" and she lands on Jobs and shifts

Draft jobs
- Given a job is a draft, when a volunteer opens the public page (before or after publishing), then that job does not appear at all, and its name is not in the page source
- Given a job is a draft, when a Host previews, then the job shows with a dashed outline and the label "Draft · volunteers won't see this"
- Given a job is a draft, when its lead previews, then she sees it marked as a draft, and she does not see other leads' drafts
- Given a job has no shift (or no item), when the organizer looks at "Save and mark ready", then it is disabled and the reason is shown next to it, in both light and dark
- Given a ready job has sign-ups, when the organizer tries to move it back to draft, then the agreed rule applies (blocked with a reason, or a confirm that names how many people are affected)

Publish
- Given at least one ready job, when the organizer presses Publish, then the page goes live, the badge reads "Live · sign-up open", and the link and QR code appear
- Given "Keep sign-up closed" is ticked, then the button reads "Publish with sign-up closed", and after publishing the badge reads "Live · sign-up closed" with an "Open sign-up" button
- Given no ready jobs, when the organizer reaches Publish, then the publish button is replaced with a way to the jobs step
- Given the event is live, when the organizer unpublishes and confirms, then the page goes offline, signed-up people keep their spots, and nobody is emailed
- Given the event is published, then no emails are sent to anyone
- Given any save or publish fails, then a plain message appears with a retry, and nothing typed is lost

Consistency
- Given the same event, then "spots filled", "spots left", and the shift count match on screens 4, 5, 6, and 7
- Given any of screens 6–8, then "Edit details", "Manage jobs and shifts", and "Event settings" are reachable

## Working well
- Clear three-step progress with "done", "now", and "needs a plan", plus a "Next, you'll..." hint. Easy to see what's done and what's left
- Screen 6's "When you publish" list answers the organizer's main fear: who gets told, and whether it can be undone
- The draft banner on the job editor and the dashed outline in preview carry the hidden-draft rule in words, not just color
- The plan limit is honest and non-blocking: people can set anything up, are told early (screen 1) and again at the point of publishing (screen 8), and are told their work is saved
- "Start from a past event" on the empty jobs screen serves the PTO president's reuse need at the right moment
- The scope is lean: optional things (team, maps, emails) are kept out of the required path and labeled "Optional. None of these stop you from publishing"

Screenshots opened: 1-picker-desktop, 1-picker-desktop-dark, 1-picker-phone, 1-picker-tablet, 2-details-desktop, 2-details-phone, 3-jobs-empty-desktop, 3-jobs-empty-phone, 4-job-edit-desktop, 4-job-edit-desktop-dark, 4-job-edit-phone, 4-job-edit-tablet, 5-preview-desktop, 5-preview-phone, 5-preview-phone-dark, 6-ready-desktop, 6-ready-phone, 6-ready-tablet, 7-live-desktop, 7-live-phone, 8-blocked-desktop, 8-blocked-desktop-dark, 8-blocked-phone. Not opened: the remaining tablet and dark files.
