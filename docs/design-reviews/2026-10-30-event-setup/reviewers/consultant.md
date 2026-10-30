# Usability consultant (independent)

## Headline
The pieces are well made: plain words, honest "what happens when you publish" text, autosave status, and careful privacy notes. The flow that connects them doesn't hold together. A new organizer goes through a 5-step setup that skips the one thing a volunteer event needs (shifts), lands on a page that counts "1 of 3 needed to publish", and then finds two different Publish buttons that do different things. Dark mode has one real defect (an invisible empty logo box) and a broader loss of visual hierarchy.

I could not run axe: the app wasn't running for this review, and the brief keeps me out of earlier axe runs in the scratchpad. The accessibility findings below come from checking the screenshots by eye and reading the code.

## Findings

### The guided setup leaves out the step a volunteer event needs most
- Where: New event form (screen 2) and the guided steps after it. `src/app/dashboard/events/_components/setup-steps.tsx:8-14` (steps: Event details, Team setup, Email settings, Maps & documents, Publishing & more). The last step's button is "Go to my event" (`src/app/dashboard/events/[eventId]/edit/page.tsx:97-102`)
- What happens: "Step 1 of 5" walks the organizer through team, email, and document settings, but never through sign-ups and shifts. After finishing all 5 steps, the event page says "1 of 3 needed to publish" and "Next step: Add volunteer sign-ups and shifts". So the app shows two progress counts that don't match (5 steps, then 3 "needed"), and finishing the first one doesn't mean you're done.
- Who it hurts: The teacher with a 30-minute lunch spends the time on optional email settings and runs out before reaching shifts. The PTO president finishes "setup" late at night, thinks she's done, and finds out the next day she isn't. The organizer at a laptop loses trust in the progress bar.
- Standard: Heuristic 1 (visibility of status), 4 (consistency), and "Action over information"
- Severity: 3
- Suggested fix: Use one checklist for the whole setup. For a volunteer event: 1 Event details, 2 Sign-ups and shifts (in Volunteer Setup), 3 Publish. Team, email, maps, and documents become optional "Before the day" items, not steps 2 to 5. The first screen should say "Step 1 of 3", and the event page should use the same count.

### "Needed to publish" is really only "recommended", and two main actions compete
- Where: Event page as a draft (screen 3), every width. Checklist label in `src/lib/setup-checklist.ts:283`. Publish panel in `src/app/dashboard/events/[eventId]/page.tsx:972-985`
- What happens: The checklist says "1 of 3 needed to publish", but the Publish panel says "We recommend finishing one more step first" and shows a green "Publish event" button you can press now. The "Publish your event" step also counts as one of the 3 "needed" steps. The page has two main actions: the navy "Start" button under "Next step" and the green "Publish event" button. On phone, a third copy of "Next: Add volunteer sign-ups and shifts" is pinned to the bottom of the screen.
- Who it hurts: The organizer at a laptop can't tell whether publishing now is safe. Some will publish an event with no shifts. Volunteers who follow the link find nothing to sign up for.
- Standard: Heuristic 5 (error prevention), 4 (consistency), and "Action over information". Content: same thing, same word.
- Severity: 3
- Suggested fix: Pick one rule. Either shifts are required, and Publish stays disabled with the reason shown next to it ("Add at least one shift first"), or they aren't, and the label says "1 of 2 steps done" without "needed". Keep a single main action per state, as the plan does: "Next step" while setting up, and "Publish" only in the Ready state.

### "Publish" and "open sign-up" are two separate gates with two different buttons
- Where: Event page Publish panel ("Volunteer sign-up stays closed until you open it") and the sidebar step "Open volunteer sign-up: Optional". Volunteer Setup's green "Publish and open sign-ups" button (`src/app/dashboard/actions.ts:310-317`, `.../volunteering/page.tsx:262-264`)
- What happens: The event page's Publish button puts the page online but keeps sign-up closed. The Volunteer Setup button publishes and opens sign-up together. Both are green buttons that start with "Publish". The sidebar marks "Open volunteer sign-up" as Optional, even though for a volunteer event it's the whole point. The plan (S3Setup, "Saved, not open" state) keeps the two gates.
- Who it hurts: The organizer publishes from the event page, texts the link, and every volunteer parent on a phone lands on a page with nothing to sign up for. The organizer won't know until someone complains.
- Standard: Heuristic 2 (match the real world: to an organizer, "publish" means "people can sign up"), 4 (consistency), 5 (error prevention)
- Severity: 3
- Suggested fix: For volunteer events, have one Publish action that opens sign-up by default, with "Keep sign-up closed for now" as an option inside the confirm dialog. Remove "Optional" from that step. If two gates have to stay, give them clearly different names ("Put page online" and "Open sign-up"), and put a banner on the published event page whenever sign-up is closed.

### Pinned bars cover the content and the field being typed in
- Where: New event form and Event settings (the "Save and continue" / "Save changes" bar), Volunteer Setup (the "What's left / Save for later / Save sign-up" bar), and the setup strip at the bottom of the event page on phone and tablet. All three widths, both modes.
- What happens: The pinned save bar sits over the form. In the screenshots it hides the "Venue name" label, the "Everything wraps up" field, and the "Sign-up name" label. On phone, the Volunteer Setup bar is two rows (about 110 px), and the event page also has a pinned checklist strip, so roughly a quarter of the screen is covered. When someone tabs to a field, it can end up under the bar.
- Who it hurts: Keyboard and zoom users can lose the field they're on. A PTO president on a phone has very little room left to see the form.
- Standard: WCAG 2.4.11 Focus not obscured (minimum); heuristic 8
- Severity: 2
- Suggested fix: Add `scroll-padding-bottom` equal to the bar's height on these pages, so focused fields scroll clear of it. On phone, shrink the bar to one row (a short status line plus the main button, with "Save for later" in a menu). Hide the pinned setup strip on phone while a form is in focus.

### Dark mode: the empty logo box is a white box with invisible text
- Where: New event form and Event settings, "Logo and color", dark mode, all widths. `src/components/logo-form.tsx:104-109` (`bg-white` with `text-muted`, and in dark mode `--muted` is white)
- What happens: "No logo yet" is white text on a white box, so readers see a blank white rectangle. It looks like a broken image.
- Who it hurts: An organizer at night in dark mode can't tell whether a logo uploaded or failed.
- Standard: WCAG 1.4.3 Contrast (about 1:1)
- Severity: 2
- Suggested fix: Use a fixed dark text color (for example #4b5f72) inside the white logo box, which stays white so logos show correctly. Or give the empty state a dashed box on the surface color.

### Dark mode loses the difference between primary and secondary text, and between available and unavailable choices
- Where: Every screen in dark mode. `src/app/globals.css:52-55` (`--muted: #ffffff`) and `:276-283` (cancels `opacity-70` in dark). Most visible on the type picker (`src/components/event-type-picker.tsx:42`).
- What happens: In light mode, event types that aren't in the plan are faded. In dark mode they look exactly like the ones you can pick. Only the small "Not in your plan" badge and a dashed border tell them apart, and the cards can't be clicked. Help text, hints, and "Optional." all have the same weight as labels, so long pages like Volunteer Setup read as a single wall of white text.
- Who it hurts: The organizer tries to click a card that does nothing. Scanning any long form is slower.
- Standard: Heuristic 8; WCAG 1.4.1 (barely passes because of the badge text)
- Severity: 2
- Suggested fix: Bring back a light secondary color in dark mode that still meets 4.5:1 on #0c1f33 (for example #c8d4e0, about 11:1). Mark unavailable type cards with a lock icon and "Not in your plan: see options", and make that text a link to Account.

### Light mode: unavailable event types are too faint to read
- Where: Type picker (screen 1), light mode, all widths. `src/components/event-type-picker.tsx:42` (`opacity-70` on muted text)
- What happens: The description text and the "Not in your plan" badge come out at about 3.3:1 contrast on the cream card. Organizers read these to decide whether to upgrade.
- Who it hurts: The organizer at a laptop, anyone with low vision, and anyone on a school's washed-out projector or screen
- Standard: WCAG 1.4.3 (inactive components are exempt, but this is information people need to read)
- Severity: 2
- Suggested fix: Drop the opacity. Show "unavailable" with the dashed border, a lock icon, and the badge, and keep the text at full contrast.

### The same thing goes by many names
- Where: Across the flow.
  - Navigation: "My events" on desktop, "Events" on phone, and the page heading is "Your events".
  - "Volunteer tracking" on desktop, "Volunteers" on phone.
  - The button says "Event settings", but the page heading is "Event Settings" (`edit/page.tsx:287`).
  - "Volunteer Setup" uses title case, while other headings use sentence case.
  - "Time slots" and "Edit time slot" sit next to "Redo or add shifts", "Morning shift", and "Add volunteer sign-ups and shifts".
  - "Volunteer Check-in" and "Broadcast Message" use title case. Elsewhere it's "Check-in".
- What happens: Organizers who come back once a year have to work out each time that these refer to the same things.
- Who it hurts: The organizer at a laptop and the PTO president (recognition over recall)
- Standard: Heuristic 4; brand voice (same thing, same word; sentence case)
- Severity: 2
- Suggested fix: Choose one word for each thing. Use "shift" (drop "time slot"), "Event settings", "Volunteer setup", and "Check in volunteers" / "Send a message". Use the same nav label at every width ("Events" fits on all of them).

### Defaults and labels on the new event form come from band contests
- Where: New event form, "When" section, all widths. `event-form.tsx:283-287`
- What happens: Every new event defaults to 7:00 AM to 10:00 PM, a 15-hour day. The start-time label is "Gates open / first volunteers arrive", which is band-contest wording for a cleanup day or a potluck. The time zone defaults to Central whatever the school's location.
- Who it hurts: The teacher who accepts the defaults ends up with an event page showing 7 AM to 10 PM. Volunteers then see that range on the public page and in their calendar invites.
- Standard: Heuristic 2 (match the real world); "Defaults that just work"
- Severity: 2
- Suggested fix: Leave start and end times blank and required, or use a short typical range such as 9 AM to 12 PM. For volunteer events, label them "Starts" and "Ends". Default the time zone to the account's saved one, or to the browser's time zone for a first event.

### "Delete" is offered on shifts that can't be deleted
- Where: Volunteer Setup, Time slots, "Delete" on a shift that has people signed up. `.../[eventId]/station-panel.tsx:349`, `src/app/dashboard/actions.ts:806-809`
- What happens: You click Delete and confirm "Delete 'Late morning shift'?", and only then get an error: "Volunteers have signed up for this shift, so it can't be deleted." The error doesn't say what to do next.
- Who it hurts: The organizer gets asked to confirm something that was never possible.
- Standard: Heuristic 5 (error prevention) and 9 (recover from errors); WCAG 3.3.3
- Severity: 2
- Suggested fix: When a shift has sign-ups, hide or disable Delete and show "6 signed up: move or remove them to delete this shift" with a link to the list. If it stays, the error should name the next step.

### The draft event page shows everything at the same weight
- Where: Event page as a draft, all widths
- What happens: Before anything is published, the page shows announcements, live spot counts, an "Event day" card with check-in buttons, and a "To do" box, all as prominent as the next step. The "To do" text reads "1 invitation has expired. Resend them from Team setup." It says "them" for one invitation, gives no link, and has no Resend button. The plan (S2Event, "Setting up") folds most of this away and fixes problems on the spot ("Resend").
- Who it hurts: The PTO president coming back after a break has to scan the whole page to find where she was. The teacher has no time for that.
- Standard: Heuristic 8; "Action over information"; "Interruption-proof"
- Severity: 2
- Suggested fix: Build the plan's draft states: Next step, then Needs you (with a "Resend invitation" button right there), then area cards. Fold the event-day and live-number sections until the event is published or it's the day itself.

### Small buttons and faint button borders in Volunteer Setup
- Where: Volunteer Setup status card ("Copy link", "Preview page", "Check-in", "Print volunteer badges" at 36 px tall with 12 px text; `.../volunteering/page.tsx:240-252`), the shift "Delete" links (`forms.tsx:846`, `text-xs px-2`), and the "×" on Coordinator chips. Matters most on phone.
- What happens: These pass the 24 px minimum but fall short of the 44 px aim for phones. Outlined buttons have a #dfe3e8 border on #fcfbf8 (about 1.2:1), so in light mode they barely look like buttons. "Delete" sits right next to "6 / 6 filled".
- Who it hurts: The PTO president tapping one-handed in the car line
- Standard: WCAG 2.5.8 (passes); house target of 44 px; 1.4.11 (button outlines are weak)
- Severity: 2
- Suggested fix: Make these buttons at least 44 px tall (`min-h-11`) and 14 px text on phone. Use `border-field-border` (#5f6d77, which passes 3:1) for secondary buttons. Make the chip "×" a 44 px target with the label "Remove Pat Kim".

### Your trial can end without warning before you reach Publish
- Where: Home (screen 0): the "Your free period ended…" banner sits right above a draft card that says "Next: finish setup and publish". The publish block appears only in the Publish panel (`.../[eventId]/page.tsx`, `facts.planBlock`).
- What happens: The banner implies only conferences can be published now. The draft card still tells the organizer to finish and publish. In real use, a trial that ends mid-setup lets someone build a whole event they then can't publish, and they find out only at the last step.
- Who it hurts: The organizer at a laptop wastes setup sessions spread over weeks.
- Standard: Heuristic 1 and 5
- Severity: 2
- Suggested fix: When an event's type can't be published under the current plan, say so on its home card ("Can't publish on your current plan: see options") and at the top of the event page, not only at Publish.

### Tabs that scroll sideways hide parts of setup
- Where: Event settings section tabs on phone (they cut off at "Email s…", with "Maps & documents" and "Publishing & more" off screen). Volunteer Setup sign-up tabs on phone and tablet ("+ Add sign-up" and "Import volunteers" cut off). On tablet, the Feedback tab also covers the right edge of the sign-up tabs.
- What happens: Nothing on screen shows there's more to the right, so whole sections go unnoticed.
- Who it hurts: The PTO president on a phone
- Standard: Heuristic 6 (recognition over recall); WCAG 1.4.10 (passes, but discoverability is poor)
- Severity: 1
- Suggested fix: On phone, show settings sections as a stacked list or a select menu. Fade the edge of tab rows that scroll and put "+ Add sign-up" first. Move the Feedback tab out of the way when a tab row reaches the edge.

### Small wording problems
- Where: Various
- What happens:
  - "Optional." has a period after a fragment.
  - "What's left: Finish the details" doesn't say which details.
  - "Your daily volunteer summary" starts with "You don't get…"
  - "Logo and color" on the new event form shows no color option.
  - The logo saves the moment it's uploaded and changes the logo for the whole account, inside a form where everything else waits for "Save and continue". That's two save behaviors in one form.
- Standard: Brand voice (no periods on fragments); content clarity
- Severity: 1
- Suggested fix:
  - Write "Optional" with no period.
  - Name the gaps: "What's left: add a time slot".
  - Start the summary card with what to do: "Get a daily email of new sign-ups. Choose who gets it."
  - Move the logo out of new-event step 1 into account setup, or label it "Saves right away · used on all your events".

### Where the plan itself has problems
- Reuse comes too late. "Copy for next year" appears only in the After and Archived states. The PTO president needs it when she clicks New event: "Start from a past event". Add it to the type picker or the home page.
- The plan keeps two gates (S2 "Ready → Publish" and S3 "Saved, not open → Open sign-up") without saying how they relate. Merge them for volunteer events, as described above.
- The plan's "3 of 5 done" (S2 state 2) doesn't match the built "1 of 3" or the 5-step setup. Settle on one checklist before building.
- IAEvent's "Share: Publish to get your links" conflicts with the built Volunteer Setup, which shows a sign-up link and QR code before publishing. A link that doesn't work yet invites the organizer to share it too early.
- Built screens still contain things the plan removes: the privacy paragraph at the top of Volunteer Setup (planned as a one-line ⓘ) and the daily summary card (planned to move to Email settings). The plan's "What's left here" list, where tapping an item jumps to it, isn't built. Today there's only the vague line in the save bar.

## Working well
- "Draft: only your team can see this" says what the status means. Put it in words like this everywhere.
- The "When you publish:" list (page goes online, nobody is notified, you can unpublish) is exactly the reassurance a nervous organizer needs.
- The "Last change: Co-host Pat Kim saved this today at 4:54 AM" lines and "All changes saved" (announced with `aria-live`, `event-form.tsx:199`) answer "is this saved?".
- The time zone help text ("Every time on volunteer pages… uses this zone, whatever someone's phone is set to") is a good example of help at the moment it's needed.
- Status always comes with a word next to the colored dot ("Draft, not finished", "✓ Arrived", "Not yet").
- Form errors move focus to the first problem field (`action-form.tsx:86-95`). The setup footer buttons are 44 px tall. The checklist animation respects reduce motion. Completed steps have hidden "(done)" text for screen readers.
- The type picker's plain descriptions, and the "Change the kind of event" escape hatch.
- The "Save for later" and "Save sign-up" split matches how part-time organizers work, though "Save for later" needs a short explanation.

## Verdict
**Build after fixes.** The screens are careful and plain-spoken, and the accessibility basics are mostly in place. The defects to fix in dark mode are the invisible empty logo box and the lost text hierarchy, plus the pinned bars that cover fields. The bigger problem is the structure: two progress counts, a guided setup that skips shifts, a "needed" step that's really optional, and two publish gates. Together these mean an organizer can "finish setup", publish, share the link, and have no volunteers able to sign up. **The one change that would help most:** replace the 5-step setup and the 3-item checklist with a single checklist (Details, then Sign-ups and shifts, then Publish), where publishing a volunteer event also opens sign-up.
