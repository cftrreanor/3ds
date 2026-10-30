# Product Owner

## Headline
Most of the parts of a good setup flow are built: a checklist that knows what's next, a clear "what happens when you publish" list, and a save bar that says what's left. It isn't "done" yet, because the flow has no single definition of "ready". Three screens count setup steps three different ways, there are two Publish buttons that do different things, and "finished" means one thing for a sign-up tab and another for the checklist. The plan covers more states than the built page, but the plan also skips several real states, so two builders working from it would build different things.

## Findings

### Two Publish buttons that do different things, with different safeguards
- Where: Event page, "Almost ready to publish" card, "Publish event" (src/app/dashboard/events/[eventId]/page.tsx:996-1025), compared with Volunteer Setup's status card, "Publish and open sign-ups" (src/app/dashboard/events/[eventId]/volunteering/page.tsx:256-265, action in src/app/dashboard/actions.ts:311). Event settings also has a "Publishing & more" section.
- What happens: On the event page, publishing leaves volunteer sign-up closed. It suggests finishing the remaining steps first, lists what will happen, and warns about plan limits before the click. On Volunteer Setup, publishing also opens sign-up right away. Its only check is a browser confirm box. It gives no readiness check, and plan limits show up only as an error after the click. On phone, this green button is the most prominent thing on the Volunteer Setup page, even though every sign-up says "Draft, not finished".
- Who it hurts: The organizer at a laptop and the PTO president. They can put a half-built event live, with sign-up open, from a page that looks like it's for editing. The teacher with a short lunch could tap the most visible button thinking it saves their work.
- Standard: Heuristic 4 (consistency), heuristic 5 (error prevention), and our "Action over information" rule
- Severity: 3
- Suggested fix: Have one publish flow. Every "Publish" button goes to the same "Ready to publish" panel (the plan's Event page state 3), with the same list of effects and the same plan check. On Volunteer Setup, the status card shows "Open sign-up" only after the event is published. Before that, it says "Publish your event to open sign-up", and that links to the panel.

### "Finished" means different things on different screens
- Where: Volunteer Setup tabs ("Draft, not finished", src/app/dashboard/events/[eventId]/volunteering/station-steps.tsx:113) compared with the checklist step "Add volunteer sign-ups and shifts" (src/lib/setup-checklist.ts:93 and :175)
- What happens: The checklist counts the step as done once there is any sign-up and any shift. A tab counts as finished only after someone clicks "Save sign-up" rather than "Save for later". So the checklist can say an event is ready while every tab says "Draft, not finished". I couldn't find anything on the public sign-up page that hides unfinished sign-ups, so a "draft" sign-up probably goes live when the event is published. The screenshots show the opposite mismatch too: the event page reads "5 sign-ups · 4 shifts" while its Next step still says "Add volunteer sign-ups and shifts".
- Who it hurts: The organizer at a laptop, who can't trust what's done or what people will see. The volunteer parent, who might see a sign-up with no instructions.
- Standard: Heuristic 1 (system status) and heuristic 4 (consistency)
- Severity: 3
- Suggested fix: Pick one rule and use it everywhere. Suggested rule: a sign-up is finished when it has a name and at least one time slot or item. The checklist step is done when at least one sign-up is finished. Then decide whether an unfinished sign-up is hidden from the public page or shown with a warning before publishing, and write that in the "When you publish" list.

### Three different step counts for setup
- Where: New event form, "Step 1 of 5" with five tabs. Event page and setup bar, "1 of 3 needed to publish". Plan S2Event, "0 of 5" and "3 of 5 done".
- What happens: The organizer finishes "step 1 of 5" and then lands on a page that says "1 of 3". The plan uses a third count. The five steps in the form (Event details, Team setup, Email settings, Maps & documents, Publishing & more) are not the checklist steps either. The checklist's "Event settings" group has its own sub-list.
- Who it hurts: The organizer at a laptop, who comes back weeks later and can't tell how much is left. The PTO president, who needs "where was I?"
- Standard: Heuristic 4 (consistency) and heuristic 6 (recognition rather than recall)
- Severity: 3
- Suggested fix: Use one checklist as the only progress count, both in the form and on the event page. Either make the new-event form one screen (details only) and drop "Step 1 of 5", or show the same checklist there. Fix the plan's "Just created" state too: the date, time, and place are required to create the event, so the count can never be 0.

### The plan for the event page by phase is mostly not built
- Where: Event page in draft, at all widths and in both modes, compared with S2Event and IAEvent
- What happens: The built draft page shows every block at equal weight. A live-announcements alert, the "Event day" section (Volunteer Check-in, What I lead, Broadcast Message), and volunteer statistics all appear above or beside the publish step. The plan folds these away in setup weeks and puts "Start here" or "Next step" first. The built page does put "Next step" near the top, but there is no "Ready" state, no "See it as a parent" preview, and "Share" doesn't fold. In real life, a co-host could post an announcement on a draft event, so the alert in a draft is a reachable state.
- Who it hurts: The organizer and the teacher, who have to scroll past tools for the day itself to find the publish step. On phone, "Publish event" is about two screens down.
- Standard: Our "Action over information" rule, and heuristic 8
- Severity: 3
- Suggested fix: Treat the plan's states 1 to 3 (Just created, Setting up, Ready) as the scope for this release. In draft, fold "Event day" and messages. Decide whether announcements can be posted at all on a draft event. If they can't, block it. If they can, say who can see them.

### Missing states (in both the plan and the build)
- Where: S2Event and S3Setup columns, and the built event page and Volunteer Setup
- What happens: Neither the plan nor the build designs these states:
  (a) Published with sign-up still closed. This is exactly what "Publish event" produces, but the plan's "Published" state assumes sign-ups are being taken.
  (b) Unpublished again after people signed up. What do volunteers see, and are they told?
  (c) Plan-blocked: the free period has ended and the event type isn't included.
  (d) A co-host or lead viewing a draft. The Publish buttons are hidden for non-hosts (volunteering/page.tsx:256), but the plan doesn't say what such a person sees instead.
  (e) Loading, and a failed save on the sign-up save bar.
  (f) Event cancelled or postponed.
  (g) A time zone or date change after sign-ups exist.
  (h) Volunteer Setup with sign-ups but zero time slots (the plan's "Needs you" mentions it, but there's no column for it).
- Who it hurts: Every organizer. These are the moments when people call for help.
- Standard: Heuristic 1, heuristic 9, and the role brief (every state has a design)
- Severity: 3
- Suggested fix: Add columns for (a), (b), (c), and (d) to S2Event and S3Setup before building. Give (e) one shared pattern (a "Couldn't save. Try again" message in the save bar, with the work kept). Log (f) and (g) as separate stories.

### Plan limits can surprise the organizer after the work is done
- Where: Home banner ("you can publish parent-teacher conferences", src/app/dashboard/page.tsx:624), type picker (no "Not in your plan" badge on Volunteer event, src/components/event-type-picker.tsx:27), and Volunteer Setup's publish button
- What happens: The banner suggests that only conferences can be published, but the picker lets the organizer choose a Volunteer event with no warning. If publishing is blocked, the event page explains why before the click, but Volunteer Setup shows an error only after it. The rule is ambiguous enough that two builders would build it differently: is a plan block known at pick time, or only at publish time?
- Who it hurts: The PTO president and the organizer, who could spend an evening setting up an event they can't publish.
- Standard: Heuristic 5 (error prevention)
- Severity: 3 (if the block can happen for this type). The demo publishes fine, so please confirm the real rule.
- Suggested fix: Decide the rule once. Any type that can't be published right now gets a badge on the picker: "You can set this up, but publishing needs a plan". Show the same note on the event page and on every Publish button.

### "Save for later" and "Save sign-up" look the same in what they do
- Where: Volunteer Setup save bar (src/app/dashboard/events/[eventId]/forms.tsx:259-269), and the plan's S3Setup "Editing" state
- What happens: Both buttons save the sign-up. The only difference is whether it gets marked "finished", and nothing on screen explains that. Neither the plan nor the build says whether a "saved for later" sign-up shows up publicly.
- Who it hurts: The teacher and the PTO president, who save in short bursts and can't tell which button keeps their work safe.
- Standard: Heuristic 1, and the content rule that buttons say what happens
- Severity: 2
- Suggested fix: Either keep one Save button and let finished status come from the content (see the finding on "finished" above), or rename the two buttons by their effect, for example "Save as draft" (hidden from volunteers) and "Save and show to volunteers".

### Event-day and later tools show up during setup
- Where: Volunteer Setup status card (Check-in, Print volunteer badges, QR code), the bottom card "Your daily volunteer summary", and the "Event day" block on the event page
- What happens: Before anything is published, the setup page offers check-in, badge printing, a QR code for an unpublished link, and an email setting that IASetup says should move out. The plan wants "Copy link · QR code · Preview" only after the event is published.
- Who it hurts: The organizer, who has extra decisions on every visit. A QR code printed before publishing points to a page people can't open yet.
- Standard: Heuristic 8
- Severity: 2
- Suggested fix: Before publishing, the status card shows only "Preview page" and the path to publish. Move Check-in and Badges to the event-day block, and move the email summary to Email settings, as IASetup says.

### The new-event form doesn't say what it needs, or what's lost if you leave
- Where: New event form, every width ("Save and continue" is grey until the required fields are filled)
- What happens: The subtitle says "Skip anything for now", but five fields are required and the disabled button doesn't say which ones are missing. If you leave halfway, nothing is saved (the event doesn't exist yet). The logo "saves as soon as you upload it", even though the event isn't saved yet.
- Who it hurts: The teacher with a 30-minute lunch, and the PTO president in the car line
- Standard: Heuristic 1, heuristic 5, and our "Interruption-proof" rule
- Severity: 2
- Suggested fix: Keep the button enabled. When it's clicked, list the missing fields next to each one. Ask only for the name and date to create the draft, and let the venue be added later from the checklist. That makes "Skip anything for now" true.

## Acceptance criteria (for this flow to count as done)
- Given a new volunteer event, when the organizer finishes the first form, then they land on the event page, and its progress count uses the same steps and numbers as the form they just left.
- Given any setup page, when the organizer clicks a Publish button, then they see the same "What goes live" list and plan check as on the event page, before anything goes live.
- Given an event that is published but has sign-up closed, when the organizer opens Volunteer Setup, then the main action is "Open sign-up" and the page says that volunteers can't sign up yet.
- Given a sign-up with no time slots or items, when the event is published, then that sign-up is either hidden from volunteers or listed in "What's left" before publishing (choose one and document it).
- Given an account whose plan doesn't include this event type, when the organizer opens the type picker, then that type says that publishing needs a plan, before any setup starts.
- Given unsaved changes in a sign-up, when the organizer clicks another tab, Back, or the Checklist link, then they're asked before anything is lost (already partly built in station-steps.tsx:131).
- Given a save that fails, when the save bar shows an error, then the typed work is still on screen and the error says how to retry.
- Given an event that is still a draft, when anyone opens the event page, then the "Event day" tools and messages are folded below the setup steps.
- Given a co-host who isn't the Host, when they open a draft, then they see what's left and who can publish, with no Publish button.
- Given every step is done, when the organizer opens the event page, then the top block is "Ready to publish", with a "See it as a parent" preview.
- Given a screen in this flow, when it's viewed at 390, 820, and 1440 px wide, in both light and dark mode, then the main action for that state is visible without scrolling past tools for the day itself.

## Working well
- The "When you publish" list on the event page (four plain promises, including "Nobody is emailed", and that you can unpublish) is exactly what an organizer needs before going live. Keep it, and reuse it for every Publish button.
- The checklist is worked out from the real data (src/lib/setup-checklist.ts), so it can't fall out of step with what's actually set up. It just needs one definition of "finished".
- The save bar on Volunteer Setup says "What's left" in plain words and asks before you leave with unsaved work. This is the right pattern for the PTO president and the teacher.
- The plan blocks publishing with a reason and a next step before the click, not as an error after it (on the event page).
- "Last change: … saved this today at 4:59 AM" on every setup page helps teams who share the work.
- Breaking the plan down by phase and state (S2Event, S3Setup) is the right way to scope this. It needs the missing columns listed above.
