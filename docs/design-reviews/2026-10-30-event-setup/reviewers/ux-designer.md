# UX Designer

## Headline
Each screen works on its own. The trouble is how they connect. An organizer goes through three different progress systems (a 5-step wizard, a "1 of 3 needed to publish" checklist, and a settings sidebar with its own checkmarks). The wizard spends their first session on optional settings before they reach the real job, which is adding shifts. Publishing happens in three places, and each one does something slightly different. The "Draft, not finished" label on sign-ups looks like a safety net, but it doesn't stop anything from going live.

## Findings

### "Draft, not finished" sign-ups still go live, and the only fix is a hidden second Save
- Where: Volunteer Setup, sign-up tabs and pinned save bar (all widths, both modes). `src/app/dashboard/events/[eventId]/volunteering/station-steps.tsx:113`, `src/app/dashboard/events/[eventId]/forms.tsx:263-269`, `src/app/dashboard/actions.ts:463`
- What happens: "Save for later" and "Save sign-up" both save everything. The only difference is that "Save for later" leaves the tab marked "Draft, not finished". In the screenshot, Parking has a name, a location, coordinators, two time slots, and six people signed up. It still says "What's left: Finish the details". Nothing on screen says what is unfinished, because the answer is "press the other button". The draft mark (`details_saved_at`) is never checked by the setup checklist (`src/lib/setup-facts.ts:30-32` counts every sign-up) or by the public pages (nothing under `src/app/e` reads it). So a "draft" sign-up shows up for volunteers as soon as sign-up opens, and the checklist can say "done" while every tab says "Draft, not finished".
- Who it hurts: Organizer at a laptop and PTO president. They trust "Draft" to mean "hidden", or they come back days later and can't tell what's left. The teacher who taps "Save for later" between classes thinks the sign-up is parked and private.
- Standard: H1 Visibility of system status, H2 Match with the real world, H5 Error prevention
- Severity: 3
- Suggested fix: Either make "draft" real (hide draft sign-ups from public pages and from the checklist count, and say so: "Draft: volunteers can't see this yet") or remove the draft state and keep one "Save sign-up" button. If draft stays, "What's left" must name a real gap ("Add a time slot"), never "Finish the details". The plan's Editing state (S3Setup state 2) keeps the same "Save for later · Save" pair, so fix it there too.

### Three publish buttons that do different things
- Where: Event page "Almost ready to publish" → "Publish event" (`src/app/dashboard/events/[eventId]/page.tsx:1013`). Volunteer Setup status card → "Publish and open sign-ups" (`volunteering/page.tsx:264`, `src/app/dashboard/actions.ts:309-316`). Event settings → "Publishing & more".
- What happens: On the event page, publishing keeps volunteer sign-up closed, and the page lists four plain effects. On Volunteer Setup, a green button publishes the whole event and opens sign-ups in one tap. It asks for no confirmation and gives no list of effects, even while every sign-up tab still says "Draft, not finished". These are two different results from look-alike green buttons on pages one click apart.
- Who it hurts: The organizer who learned from the event page that "sign-up stays closed until you open it", then taps the Volunteer Setup button expecting the same thing. Volunteers who find a half-built sign-up through a link that was shared early.
- Standard: H4 Consistency and standards, H5 Error prevention
- Severity: 3
- Suggested fix: Keep one place to publish (the event page's panel, with its "When you publish" list). On Volunteer Setup, show "Open sign-up" only once the event is published, and before that show "Publish the event first →", linking to the panel. If the combined button stays, give it the same "When you publish" confirmation and block it while any sign-up is unfinished.

### The guided setup front-loads optional settings and skips the real job
- Where: New event form "Step 1 of 5" → Team setup → Email settings → Maps & documents → Publishing & more → "Go to my event" (`src/app/dashboard/events/_components/setup-steps.tsx:8-14`, `src/app/dashboard/actions.ts:187-188`, `edit/page.tsx:101`)
- What happens: After saving the basics, the organizer goes through four settings steps, two of them marked optional. They then land on the event page, which starts a different count ("1 of 3 needed to publish") whose next step, adding sign-ups and shifts, was never part of the wizard. Event settings then shows a third set of checkmarks ("Team setup · Optional", "Email settings · Default", "Publishing & more · Draft"). Team setup is step 2 of the wizard but "Optional" under "Event settings" in the checklist. Three progress systems disagree about what the steps are and how many there are.
- Who it hurts: The teacher with a 15-minute lunch spends it on email settings and never reaches shifts. The PTO president can't answer "where was I?" because three screens give three answers.
- Standard: H1 Visibility of system status, H6 Recognition rather than recall, Action over information, Interruption-proof
- Severity: 3
- Suggested fix: After step 1, go straight to the event page with "Start here: Add your volunteer shifts" as the main action (this matches the plan's "Just created" state). Make the setup checklist the only progress system. Team, emails, and files appear in it as optional rows, and Event settings becomes a plain set of sections without its own done-ticks. The plan says "Setup checklist 0 of 5" and the built page says "of 3 needed". Settle on one number and one list, and say which steps are needed and which are optional.

### "Needed to publish" but publishing is allowed anyway
- Where: Event page, checklist "1 of 3 needed to publish" vs. "Almost ready to publish … We recommend finishing one more step first" with an active "Publish event" button (`page.tsx:972-1015`, `src/lib/setup-checklist.ts:175-176` `required: volunteerEvent`)
- What happens: The sidebar calls sign-ups and shifts "needed". The publish panel calls them "recommended". The organizer can publish a volunteer event with nothing to sign up for. The bright green Publish button competes with the navy "Start →" of the next step on the same screen, so the page has two main actions.
- Who it hurts: Organizer at a laptop, who can't tell whether they are allowed to publish or should. Volunteers who open a published page with no shifts.
- Standard: H4 Consistency and standards, H5 Error prevention, Action over information
- Severity: 3
- Suggested fix: Pick one rule. If it is required, call it required and show Publish as a quiet, inactive preview ("Publish after you add shifts"). If it isn't, drop the word "needed". In both cases, follow the plan: show the publish panel as the main action only in the "Ready" state, and keep it small or tucked away while setup is still under way.

### Plan limits disagree across Home, the type picker, and the event page
- Where: Home banner "Your free period ended … you can publish parent-teacher conferences" (`src/app/dashboard/page.tsx:621-626`). The type picker shows "Volunteer event" as available, without the "Not in your plan" tag. The event page shows an active "Publish event" (`page.tsx:997`, planBlock comes from a separate check in `src/lib/setup-facts.ts:52`).
- What happens: Home says only conferences can be published. The picker and the event page say a volunteer event can be. Either the banner is wrong, or the organizer builds the whole event and the database refuses at the last click ("Publishing needs an active … plan", `actions.ts:292-294`).
- Who it hurts: Organizer at a laptop and PTO president, who lose an evening of setup to an event they can't publish, or ignore a banner that cries wolf.
- Standard: H1 Visibility of system status, H5 Error prevention, H4 Consistency
- Severity: 3 (if the database refuses publishing) / 2 (if only the banner is wrong)
- Suggested fix: Use one source for "can this account publish this type". When it says no, tag the type card in the picker ("Can't publish on your plan") and show the "Your plan doesn't allow publishing this yet" box at the top of the event page from the start, not only at the bottom.

### Step 1 of the new event can lose everything without warning
- Where: New event form, "← All events" and "Change the kind of event" links (`src/app/dashboard/events/new/page.tsx:71-73`, the back link isn't `guard`ed). No unsaved-changes warning on this page (the only `beforeunload` is in `edit/settings-nav.tsx:31`).
- What happens: Later steps ask "Save and finish later / Discard" before leaving, but step 1 doesn't. Changing the type, or a bell that sends the organizer back to the list, throws away what they typed. Nothing can be saved until every required field is filled, including the venue address, which the person may not have on hand.
- Who it hurts: Teacher with a 30-minute lunch, band director between bells, PTO president in the car line.
- Standard: H3 User control and freedom, Interruption-proof
- Severity: 2
- Suggested fix: Guard both links the same way later steps are guarded. Better still, create the draft once there's a name, and let date and venue be filled in later, shown as checklist gaps.

### Event-day tools crowd the setup screens
- Where: Event page draft, "Event day" section with Volunteer Check-in, What I lead, Broadcast Message (`page.tsx:380`), all widths. Volunteer Setup status card: Check-in and Print volunteer badges next to Copy link (`volunteering/page.tsx:254`). Volunteer Setup opens with a privacy paragraph and ends with a daily-summary card.
- What happens: Weeks before the event, half of the event page and a third of the Volunteer Setup action row are about event day. The privacy note pushes the actual sign-up editor down, by about half a screen on phone.
- Who it hurts: Organizer at a laptop, who has to sort out what matters now. Phone users (PTO president), who scroll past it every time.
- Standard: H8 Aesthetic and minimalist design, Action over information
- Severity: 2
- Suggested fix: Follow the plan. Tuck "Event day" away until the evening before. In setup, the status card shows only Copy link, QR code, and Preview. Shrink the privacy text to one ⓘ line. Move the daily-summary choice to Email settings.

### The built event page doesn't follow the planned order
- Where: Event page draft vs S2Event "Setting up" state
- What happens: The plan's order is: Next step, then Needs you, then Areas, then Share (tucked away). The built order is: Event settings button, announcements, Next step, To do, Volunteers (with live numbers), Publish panel, Event day. "To do" and "Needs you" are the same idea under two names. Announcements can sit above setup on a draft. The plan's "Areas" card ("Set up volunteers") is built as a full stats block with a "Manage volunteers" button. The checklist sidebar puts "Event settings → Add the date, time, and place" (the first thing done) below "After you publish".
- Who it hurts: Organizer at a laptop, who has to read the whole page to find their place.
- Standard: H2 Match with the real world (order), H4 Consistency
- Severity: 2
- Suggested fix: Build the plan's states. Rename "To do" to "Needs you". Put the date-and-place step first in the checklist under "Before you publish". The plan itself has three overlapping lists of what's left (the checklist, "Needs you", and the setup page's "What's left here"). Say which one owns which kind of gap (missing setup vs. something broken).

### Adding another shift is hidden behind "Redo"
- Where: Volunteer Setup, Time slots, "› Redo or add shifts" (`station-panel.tsx:215-221`)
- What happens: Once a sign-up has one time slot, the way to add another is tucked into a collapsed line whose first word, "Redo", sounds destructive. The plan calls for a visible "+ Add".
- Who it hurts: Organizer at a laptop and PTO president, who build shifts over several sessions and need to add one more.
- Standard: H6 Recognition rather than recall, H2 Match with the real world
- Severity: 2
- Suggested fix: Show a "+ Add time slot" button under the list at all times. Keep "Replace all time slots" as a separate, quieter link.

### The tabs row of sign-ups runs off the edge
- Where: Volunteer Setup tabs. On desktop, "Import volunte…" is cut off. On phone, only about 2.5 tabs show and "+ Add sign-up" is off-screen (phone-specific).
- What happens: Nothing on screen shows that the row scrolls. "+ Add sign-up" sits in the middle of the row, and once there are 5 or more sign-ups it's out of view.
- Who it hurts: PTO president on a phone, who can't find how to add a sign-up or see all the gaps.
- Standard: H6 Recognition rather than recall, H1 Visibility of system status
- Severity: 2
- Suggested fix: Put "+ Add sign-up" before the tabs, or as a button above them. On phone, swap the scrolling row for a list or dropdown ("Parking · Draft ▾") that shows how many sign-ups there are.

### Home card doesn't say where they left off
- Where: Home, draft event card "Next: finish setup and publish" (`src/app/dashboard/page.tsx:460`)
- What happens: The same generic line appears whatever the actual next step is, even though the event page already knows it ("Add volunteer sign-ups and shifts", 1 of 3).
- Who it hurts: PTO president and teacher coming back after hours or days.
- Standard: Interruption-proof, H6 Recognition rather than recall
- Severity: 2
- Suggested fix: Show the checklist's next step and count: "Next: add volunteer sign-ups and shifts · 1 of 3". Link straight to that step.

## Working well
- The "When you publish" list on the event page (online, sign-up stays closed, nobody notified, can unpublish) is exactly what a nervous first-time organizer needs. Make it the only path to publishing.
- The "Next step" card with a single "Start →" is a strong main action and matches the plan.
- Later wizard steps and the sign-up tabs ask "Save and switch / Discard" before leaving with changes, and the save bars say "Unsaved changes" or "All changes saved".
- "Last change: Volunteer Lead Lee Lead saved this today at 4:59 AM" helps the PTO president hand off work and pick it back up.
- The setup bar on Volunteer Setup and Event settings ("1 of 3 needed · Next: …") keeps the checklist one tap away. On phone and tablet the sidebar collapses into a bottom bar that works well.
- The type picker explains each kind of event in plain words and shows plan limits before anyone starts.
- No flow differences between light and dark mode. Tablet behaves like desktop except for the collapsed checklist, which works.
