# Product Manager

## Headline
The flow is aimed at the right person, an organizer who sets up one or two events a year, and the event page's "Next step" card is a real improvement. But the path from "New event" to "people can sign up" doesn't follow the job. The guided setup sends people through four settings steps before they reach shifts, which are the whole point of a volunteer event. There are three different progress counts, and "publish" and "open sign-up" are two separate go-live moments. Worst of all, an account whose plan can't publish a volunteer event can still start one, and only finds out at the very end. Nothing in the design or the code tells us whether setup is getting faster or more people finish it.

## Findings

### People can build a whole event their plan won't let them publish
- Where: Home (free-period banner), Type picker (Volunteer event and Meetings cards have no "Not in your plan" badge), Event page "Almost ready to publish" card. Code: `src/lib/plan.ts:86` (`startableTypes` uses the package's types and ignores whether the plan is still active), `src/app/dashboard/events/new/page.tsx:25`, `src/app/dashboard/events/[eventId]/page.tsx:996-1019` (the plan message appears only on the publish card), `supabase/migrations/20261223000000_packages.sql` header ("When a paid package's plan isn't active ... the account publishes as Free ... one parent-teacher conference at a time")
- What happens: The home banner says "Your free period ended ... you can publish parent-teacher conferences." Then the type picker shows Volunteer event as an open choice, in the same style as the Free conferences card. The organizer creates the event, goes through five setup steps, and adds shifts. The first time they learn they can't publish is a "Your plan doesn't allow publishing this yet" box at the bottom of the event page. The volunteer page's "Publish and open sign-ups" button gives no warning ahead of time.
- Who it hurts: The PTO president and the organizer at a laptop. They give up an evening, find out at the finish line, and email support or leave annoyed. This is the moment most likely to make someone quit, and it's also our best chance to sell them an upgrade.
- Standard: Error prevention (heuristic 5); Visibility of system status (1)
- Severity: 4
- Suggested fix: Work out what's startable from what the account can publish today, not from the package's list. On the type picker, mark those cards "Can't publish on your plan" and add one line with the pass price ("Volunteer event pass, $75") and how to get it. Let people start a draft anyway, but show the same notice at the top of the new event form and on the event page, not only at the bottom. Put the same check on the volunteer page's publish button.

### The guided setup puts the core job last, and doesn't include it at all
- Where: New event form, "Step 1 of 5" (`src/app/dashboard/events/_components/setup-steps.tsx:8-14`). After saving, it goes to Event settings, Team setup (`src/app/dashboard/actions.ts:187-189`).
- What happens: The five steps are Event details, Team setup, Email settings, Maps & documents, and Publishing & more. Adding sign-ups and shifts, the one step the checklist says a volunteer event needs, isn't one of them. A teacher with 15 minutes uses their time on team invitations and email settings, which the checklist later calls optional or default. The plan (S2Event, "1 · Just created") gets this right: "Start here: Add your volunteer shifts", big.
- Who it hurts: The teacher with a 30-minute lunch, who runs out of time before the part that matters. The PTO president, who hits "too many decisions up front". The organizer at a laptop, who can't tell what's needed and what's busywork.
- Standard: Action over information; Match with the real world (2); Aesthetic and minimalist design (8)
- Severity: 3
- Suggested fix: For a volunteer event, after Event details, go straight to Volunteer Setup's empty state ("Add your first sign-up"), as the plan shows. Drop Team, Email, Maps, and Publishing from the up-front steps. They're already in the checklist and in Event settings for later. Name the creation steps "Details → Sign-ups and shifts → Publish".

### Three different progress counts for the same setup
- Where: New event form "Step 1 of 5". Event page sidebar and setup bar "1 of 3 needed to publish". Event settings left list (5 sections, with checks). The plan's checklist says "0 of 5".
- What happens: The organizer sees "5" when they create the event, "3" on the event page, and a five-item list with its own green checks in Event settings. Event details is checked in one place and is "Add the date, time, and place" under a separate "Event settings" heading in another. "Publish your event" counts as one of the "3 needed to publish", which is circular.
- Who it hurts: The organizer at a laptop and the PTO president coming back after a week. They can't answer "how much is left?", which is their top need.
- Standard: Consistency and standards (4); Visibility of system status (1)
- Severity: 3
- Suggested fix: Use one checklist and one count everywhere. Use it in the creation steps, the event page, the setup bar, and Event settings. Count only the steps that block publishing, and don't count Publish itself ("2 steps before you can publish"). Fix the plan's "0 of 5" to match.

### "Publish" and "Open sign-up" are two go-live moments, with two buttons that do different things
- Where: Event page "Publish event" (`src/app/dashboard/actions.ts:304`, which publishes and leaves sign-up closed: "Volunteer sign-up stays closed until you open it"). Volunteer Setup "Publish and open sign-ups" (`actions.ts:311`). Checklist "After you publish: Open volunteer sign-up (Optional)". The plan keeps both (S2 "Ready to publish" and S3 "Saved, not open").
- What happens: For an event that exists only to get volunteers, the main green button on the event page puts the page online with sign-up closed. Parents who follow the link can't sign up. The checklist calls opening sign-up "Optional", but without it the event does nothing.
- Who it hurts: The organizer, who publishes, shares the link in the group text, and gets "how do I sign up?" replies. The volunteer parent, who lands on a page with no way to sign up and gives up.
- Standard: Match with the real world (2); Error prevention (5)
- Severity: 3
- Suggested fix: For volunteer events, make the event page's main button the same as Volunteer Setup's: "Publish and open sign-up". Offer "Publish without opening sign-up yet" as a quieter option for anyone who wants it. Remove "Optional" from that checklist step for volunteer events. Update the plan so a volunteer event has one go-live moment.

### "Needed to publish" isn't actually needed
- Where: Event page "Almost ready to publish": "We recommend finishing one more step first", with the Publish event button active. The sidebar says "1 of 3 needed to publish".
- What happens: One part of the screen says a step is needed. The card below it says it's only recommended and lets them publish with no sign-ups at all. The organizer can't tell which one to believe.
- Who it hurts: The organizer at a laptop, who needs to "trust what people will see"
- Standard: Consistency (4); Error prevention (5)
- Severity: 2
- Suggested fix: Pick one. Either say "Recommended" in the checklist, or block publishing until there is at least one sign-up with a time slot. For a volunteer event, blocking is the better choice. Then show the plan's "Ready to publish" state once nothing is missing.

### Whether sign-ups are done is defined differently on each screen
- Where: Volunteer Setup tabs (every sign-up says "Draft, not finished"), Event page Volunteers card ("5 sign-ups · 4 shifts", "10 of 19 spots filled"), and the Next step card ("Add volunteer sign-ups and shifts"). Code: `src/lib/setup-checklist.ts:93` counts any sign-up and any shift as done.
- What happens: In the screenshots, the same event has five sign-ups and filled spots, but the checklist still says to add them, and every tab says "not finished". Part of this is demo data. But the rule in the code (any row counts) is different from the tabs' "not finished" status, so this could really happen: an organizer who used "Save for later" sees the checklist step done while the sign-ups themselves aren't.
- Who it hurts: The organizer and the PTO president, who rely on the checklist to know "nothing is falling through the cracks"
- Standard: Visibility of system status (1); Consistency (4)
- Severity: 2
- Suggested fix: Mark the checklist step done only when at least one sign-up is saved as finished and has a time slot or an item. Use the same wording for "not finished" on the tabs, the Volunteers card, and the checklist.

### No way to reuse last year's event
- Where: Home ("New event" only), Type picker, New event form. There's no copy or duplicate anywhere in `src/app/dashboard` or `src/lib`. The plan puts "Copy for next year" only on the After and Archived states.
- What happens: Every year the organizer rebuilds the same stations, shifts, instructions, and coordinators by hand. The "Past (3)" section on Home has no "Use as a starting point".
- Who it hurts: The PTO president, whose stated need is "reuse last year's event". Also the organizer who forgets how it works between events. This is likely the biggest time saver for anyone who comes back, and so the biggest reason they come back.
- Standard: Flexibility and efficiency (7)
- Severity: 3
- Suggested fix: Add "Start from a past event" as the first choice after the type picker, and "Copy for next year" on past event cards on Home. Copy stations, shifts (moved to the new date), instructions, and documents. Don't copy people. Then the plan's "Copy for next year" has something to point to.

### The draft event page shows event-day tools and stats before anything is set up
- Where: Event page (draft), every width. The "Event day" section (Volunteer Check-in, What I lead, Broadcast Message) and the "Volunteers signed up / Open spots" tiles appear at the same weight as setup.
- What happens: The page differs from the plan's "Setting up" state, which shows Next step, Needs you, Areas, and Share folded away, with no event-day block. A new organizer sees buttons for a day that's weeks off, and live-looking numbers on an event nobody can see yet.
- Who it hurts: The organizer at a laptop and the teacher. It adds more to read and more ways to wander off. It also makes the product look harder than it is.
- Standard: Aesthetic and minimalist design (8); Action over information
- Severity: 2
- Suggested fix: Build the plan's state order. While the event is a draft, hide the Event day section and the signed-up tiles, and show it starting the week of the event. Keep "Next step" and "To do" as the only things above the fold.

### We can't tell whether this works
- Where: The whole flow. There's no product analytics anywhere in `src` (no tracking calls). The only signal is the Feedback tab.
- What happens: We can't measure time from "New event" to publish, where people drop out of the five steps, how many drafts are never published, how many people publish without opening sign-up, or how often people run into the plan block. Those are exactly the questions the findings above raise.
- Who it hurts: Indirectly, all six. Without numbers we can't tell whether a redesign helped.
- Standard: none
- Severity: 2
- Suggested fix: Record a small set of events with no personal data: event created (type), each setup step finished, first sign-up saved, published, sign-up opened, and plan-blocked publish. Define success before building the plan: median time from creation to publish with sign-up open, and the share of drafts published within 14 days. Look at both the month before and after this change.

### Home doesn't say where you left off
- Where: Home, draft event card, "Next: finish setup and publish" (all widths, light and dark)
- What happens: The card is generic. The event page already knows the next step ("Add volunteer sign-ups and shifts") and the count, but Home doesn't show them.
- Who it hurts: The PTO president, who comes back in short bursts and needs "where was I?" answered on the first screen
- Standard: Recognition rather than recall (6); Interruption-proof
- Severity: 1
- Suggested fix: Show the checklist's next step and count on the card: "1 of 2 before publishing · Next: add sign-ups and shifts". Link it straight to that step.

### By default, nobody hears about new sign-ups
- Where: Volunteer Setup footer, "You don't get the daily summary of new sign-ups..." The wizard's Email settings step is marked "Default".
- What happens: The default setting leaves the organizer uninformed once sign-ups open. They have to check back by hand to know whether shifts are filling.
- Who it hurts: The PTO president and the organizer, who need to "know nothing is falling through the cracks"
- Standard: Visibility of system status (1)
- Severity: 2
- Suggested fix: Turn the daily summary on for the Host by default, and send it only on days with changes. Say so in one line on the publish card: "You'll get a daily email when people sign up."

## Working well
- The "Next step" card on the event page: one clear action, named in plain words, with Start. Keep it and make it the anchor for everything.
- "When you publish:", which lists exactly what happens and that nobody is emailed. It answers the organizer's biggest worry before they click.
- The plan block explains why publishing is blocked *before* the click and links to the event that's using the slot (`page.tsx:997`). It's the right idea, it just shows up too late.
- "Save for later" next to "Save sign-up", and "Last change: ... saved this today", both support coming back across several evenings.
- Coordinators on each sign-up. This is how the PTO president hands jobs to other parents.
- The plan itself: page order that changes by phase, "Job to be done" for each state, and "Copy for next year". The direction is right. It needs to apply the same thinking to creating the event and to having one go-live moment.
