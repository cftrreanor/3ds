# Marketing Manager

## Headline
The setup flow mostly sounds like the brand: it's calm and specific, and it keeps its privacy promises honest. The biggest risk is a broken promise around plans. An organizer whose free period has ended can still pick a Volunteer event and set the whole thing up, and only learns at the publish button that they can't publish it. That is the moment most likely to cost us trust. Beyond that, the flow never stops to show what the organizer has built, the step counts disagree with each other, which undercuts the "guided setup" claim, and the same features go by different names depending on the screen and the width.

## Findings

### Plan limits show up after the work, not before
- Where: Home banner (src/app/dashboard/page.tsx:621-627), Type picker (src/components/event-type-picker.tsx:14-27, src/lib/plan.ts:86-91), Event page "Almost ready to publish" panel (src/app/dashboard/events/[eventId]/page.tsx:996-1011). All widths, both modes.
- What happens: The Home banner says the free period has ended and only parent-teacher conferences can be published. The Type picker still offers Volunteer event and Meetings as open choices, with no "Not in your plan" tag, because what you can start is worked out separately from whether the free period has ended. The organizer fills in five setup steps, adds sign-ups and shifts, and only then sees "Your plan doesn't allow publishing this yet" where the Publish button should be. The planned mock-ups (S2Event, state 3 "Ready") have no state for this either.
- Who it hurts: The organizer at a laptop and the PTO president lose an evening of work and feel tricked. A teacher with a 30-minute lunch spends the whole window on something she can't use. Word of mouth from a pilot account that feels baited is the kind of thing a principal hears about.
- Standard: Brand voice "Promises we keep"; heuristic 5 (error prevention); heuristic 1 (visibility of system status)
- Severity: 3
- Suggested fix: Use one rule for "can publish" everywhere. On the Type picker, tag any kind they can set up but not publish: "You can set this up, but publishing needs a plan" with "See what's included" linking to Account. On the new-event form and the event page header, show the same line from the start, not only in the publish panel. Add a "Ready, but your plan doesn't include publishing" state to the S2Event mock-up.

### The free period banner sells instead of helping
- Where: Home, Hosting section banner (src/app/dashboard/page.tsx:624-625). All widths, both modes. On phone it sits between "New event" and the draft card, so it's the first thing under the button.
- What happens: "Email product@fieldcommandevents.com to keep going." The only way forward is to send an email. It doesn't say what "keep going" costs or includes, it has no link to the Account page that lists the plan, and it doesn't say which drafts are affected. It also says only conferences can be published, but the Meetings marketing page says Meetings is "Free during the pilot" (src/app/meetings/page.tsx:192).
- Who it hurts: The organizer and the PTO president: they can't tell whether the draft in front of them is stuck. A director or principal who sees it reads a bare email address as "pay us" with no detail.
- Standard: Brand voice "Every page ends with a clear next step", "Promises we keep", and "In-app: brief, direct, and calm"
- Severity: 2
- Suggested fix: "Your free period ended Oct 20, 2026. Published events stay live. You can still publish parent-teacher conferences. To publish other events, see your options" with "See what's included" (Account) and "Talk with us" (email). If a draft can't be published, say so on that draft's card: "Needs a plan to publish". Make the conferences and Meetings story the same on the website and in the app.

### "Free" badge promises more than the fine print
- Where: Type picker, Parent-teacher conferences card (src/components/event-type-picker.tsx:23-25, src/lib/event-types.ts:39). All widths, both modes.
- What happens: A green "Free" tag sits next to the name with no conditions. The blurb underneath says "Free during the pilot", and the event settings copy adds "with one published conference at a time" (src/app/dashboard/events/[eventId]/edit/page.tsx:50). The tag reads as free forever and unlimited. Meetings is also marketed as free during the pilot but has no tag.
- Who it hurts: Teachers and principals who later find a limit they weren't told about. This is the kind of claim that embarrasses us in front of a district.
- Standard: Brand voice claims guardrails ("specific claims only, never overpromising")
- Severity: 2
- Suggested fix: Change the tag to "Free during the pilot" and drop the repeat from the blurb. Put the limit in the blurb: "One published conference at a time." Tag Meetings the same way if the website says it's free.

### The step counts disagree, so "guided setup" feels longer than promised
- Where: New event form, "Step 1 of 5" with a 5-part progress bar (src/app/dashboard/events/_components/setup-steps.tsx:7-13). Event page, Volunteer Setup, and Event settings: "1 of 3 needed to publish". All widths.
- What happens: The organizer finishes "5 steps" (Event details, Team setup, Email settings, Maps & documents, Publishing & more) and lands on a page that says they've done 1 of 3. The step that matters most, adding sign-ups and shifts, isn't one of the five. The website sells "guided setup" and "ready in minutes", and the first progress bar they see makes a promise the second one takes back.
- Who it hurts: The organizer at a laptop thinks they're nearly done and isn't. The teacher at lunch can't tell whether she can finish in her window.
- Standard: Brand voice "Promises we keep"; heuristic 4 (consistency); heuristic 1
- Severity: 3
- Suggested fix: Use one checklist everywhere. Either make the guided setup the same checklist as the event page (details, sign-ups and shifts, publish, with team and email as optional), or drop the "of 5" count from the form and say "Next, you'll add your sign-ups and shifts." Never show two different totals for the same event.

### No "you're all set" moment
- Where: Event page, publish panel (src/app/dashboard/events/[eventId]/page.tsx:972-985). Mock-ups S2Event states 3 "Ready" and 4 "Published".
- What happens: The panel says "Almost ready to publish" even at 1 of 3, which takes the weight out of "almost". When everything is done, it shows one small line, "Everything your event needs is set up." The plan goes straight from "Ready" to a "Needs you" alert as the first block after publishing. Nothing celebrates, sums up what they built (5 sign-ups, 19 spots, a link ready to share), or shows the page as a parent will see it, which is "See it as a parent" in the plan.
- Who it hurts: The organizer and the PTO president don't get proof that "nothing is falling through the cracks". This is our best moment to show value, and right now it's quiet.
- Standard: Marketing brief (value moments); heuristic 1
- Severity: 2
- Suggested fix: Say "Almost ready" only when one step is left. Before that, say "2 steps before you can publish". When everything is done, show a calm summary card: "Your event is ready. 5 sign-ups, 19 spots, check-in set up," with "Preview as a volunteer" and "Publish event". Right after publishing, the first block should be "Your event is live" with the link, Copy link, and QR code, and "Needs you" should come second. Keep it calm, with no confetti or exclamation points.

### No way to start from last year's event
- Where: Type picker and New event form. All widths. In the plan, "Copy for next year" only appears on the after and archived states (S2Event 6-7, IAEvent "Next year").
- What happens: A returning organizer has to start from a blank form. The copy action lives on the old event, which they have to know to go find.
- Who it hurts: The PTO president, who repeats the same events every year. "Reuse last year's event" is one of her core needs and one of our strongest reasons for renewing.
- Standard: Heuristic 7 (flexibility and efficiency); heuristic 6 (recognition rather than recall)
- Severity: 2
- Suggested fix: On the Type picker, when the account has past events, add a row at the top: "Start from a past event", with the last three events and "Copy setup". Keep the plan's "Copy for next year" too.

### The same thing goes by different names
- Where: Navigation: "My events" and "Volunteer tracking" on desktop and tablet, but "Events" and "Volunteers" on phone. Home h1 is "Your events". Headings are "Event Settings" (src/app/dashboard/events/[eventId]/edit/page.tsx:43, page h1) and "Volunteer Setup", while links say "Event settings". Buttons are "Volunteer Check-in" and "Broadcast Message" in Title Case, while other buttons use sentence case. Website router categories ("Contests and festivals", "School events", "Classroom sign-ups") don't line up with the Type picker names.
- What happens: An organizer who reads "Volunteer tracking" on the laptop can't find it as "Volunteers" on the phone. Mixed capitals look unfinished in front of a director.
- Who it hurts: The PTO president, who switches between phone and laptop. The organizer, who learns the product from our website and emails.
- Standard: Content standard "Same thing, same word"; heuristic 4
- Severity: 2
- Suggested fix: Pick one name per place and use it at every width ("My events", "Volunteer tracking", or shorter names everywhere). Use sentence case for all page titles and buttons: "Event settings", "Volunteer setup", "Check in volunteers", and "Send a message". Add one plain line under each Type picker card name that uses the website's words, e.g. Volunteer event: "Simple sign-ups".

### Emails from setup carry the wrong tagline
- Where: The footer on every system email, including team invitations sent from Team setup (src/lib/email-format.ts:173, src/lib/brand.ts:4)
- What happens: The footer says "Field Command Events · Run event day from one place." The brand tagline is "Every detail organized. Every organizer supported." Co-hosts and Volunteer Leads invited during setup see a different promise from the one on the website.
- Who it hurts: Everyone the organizer invites. It's a small inconsistency, but it's the first thing a new co-host sees from us.
- Standard: Brand voice tagline ("use exactly as written")
- Severity: 2
- Suggested fix: Set `tagline` in src/lib/brand.ts to "Every detail organized. Every organizer supported." If the shorter line is meant for event-day emails, rename it so it isn't mistaken for the tagline.

### "Not in your plan" is a dead end
- Where: Type picker, locked cards (src/components/event-type-picker.tsx:27, :44). All widths. In dark mode the dimmed cards are close to the open ones, so it's harder to tell which you can pick.
- What happens: Locked kinds are shown dimmed with "Not in your plan", but you can't tap, open, or ask about them. The organizer can see what they're missing and has no way to learn more.
- Who it hurts: The band booster who wants a Band contest next. To them it feels like a closed door, and for us it's a missed chance to sell without being pushy.
- Standard: Brand voice "Every page ends with a clear next step"; marketing brief (sell gently where it helps)
- Severity: 2
- Suggested fix: Make each locked card open a short panel: what the kind includes, "Available on [plan name]" or "one-time event pass", and "Talk with us". Change the tag to "Add to your plan".

## Working well
- The publish panel's "When you publish" list is honest and reassuring: nothing is emailed, sign-up stays closed, and you can unpublish. Keep it.
- The privacy lines are specific and checkable ("phone numbers deleted 10 days after the event", "Student details are deleted 30 days after") instead of a vague "privacy protected". That is exactly what the guardrails ask for.
- The Type picker blurbs talk about the organizer's own event in plain words, with no hype and no exclamation points.
- The "Draft: only your team can see this" tag answers the first worry a new organizer has.
- "Next: finish setup and publish" on the Home draft card makes picking up where you left off easy.
- The plan's "See it as a parent" block and its "Copy for next year" state are both strong value moments. Build them.
