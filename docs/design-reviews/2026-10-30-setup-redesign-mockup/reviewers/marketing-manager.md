# Marketing Manager

## Headline
The setup flow itself sells the product well: it's calm, it tells organizers what happens when they publish, and the copy-from-last-year card shows real value. The weak spots are around the plan. The mock-up promises a self-serve "add a plan" step that the product doesn't offer, it says "free period", "pilot", and "plan" in ways that seem to contradict each other, and it never mentions the cheaper one-time event pass. The two moments that decide whether an organizer pays, the type picker and the blocked publish page, are where these gaps show most.

## Findings

### "Add a plan" promises a self-serve step that doesn't exist
- Where: 1 Type picker, free-period banner ("publish it once you add a plan"). 8 Blocked, warning card ("you can publish it as soon as you add a plan"). All widths, both modes
- What happens: The words suggest the organizer can add a plan in the app and publish right away. In the current product there is no way to buy a plan in the app. The dashboard and Account page say "Email us to keep going" or "Write to us ... about an upgrade". "As soon as" also suggests it happens instantly, when it really waits on a person replying.
- Who it hurts: Organizer at a laptop and PTO president. They plan around "as soon as", go looking for a button that isn't there, and lose trust. A principal who sees this would expect a checkout.
- Standard: brand-voice claims guardrails ("Promises we keep", "Promise real people, not instant ... availability"), and content clarity on the same word for the same thing
- Severity: 3
- Suggested fix: Describe how it really works. For example: "Everything you set up is saved. To publish it, add a plan or a one-time event pass. Write to us and we'll reply within a day." Use "Write to us" (or the existing "Talk with us") as the main button. Keep "See what's included" as the secondary button. Only say "as soon as" once self-serve checkout exists.

### "Free during the pilot" next to "Your free period ended"
- Where: 1 Type picker, Parent-teacher conferences card ("Free during the pilot, one published at a time") under the banner "Your free period ended Oct 20". All widths, both modes
- What happens: The same screen says the free time is over and that the pilot is still free. The website says the pilot runs until January 1, 2027 for everyone, so an organizer whose free period ended Oct 20 can't tell whether they're still in the pilot or what they're paying for.
- Who it hurts: Organizer at a laptop and front office administrator. It reads like a billing mistake, and it would embarrass us in front of a principal who signed off on the pilot.
- Standard: content clarity (same thing, same word), plus "anything that would embarrass us"
- Severity: 3
- Suggested fix: Pick one term for this account's status and use it everywhere: banner, card, Account page, and emails. On the conferences card, say what's actually true: "Always free, one published at a time." Drop "during the pilot", because conferences stay free after the free period. In the banner, say "Your free pilot ended Oct 20" (or "free trial", to match the dashboard's existing wording for that account) and avoid using both "pilot" and "free period".

### The cheaper path, a one-time event pass, is never mentioned
- Where: 1 Type picker (badges "Set up now, publish with a plan"), 8 Blocked
- What happens: The only path offered is "a plan". The product also sells one-time passes for a single event (for example, a Volunteer event pass). A PTO that runs one fall festival a year is the main buyer for a pass, and this flow pushes them toward the bigger purchase or leaves them thinking it's too expensive.
- Who it hurts: PTO president and teacher. They're cost-sensitive, run one event, and leave instead of asking.
- Standard: Marketing role (moments to show value, and not over-selling), plus heuristic 6 (show the options)
- Severity: 3
- Suggested fix: Change the badge to "Set up now, publish with a plan or pass". On screen 8, add one line: "One event? A one-time event pass covers just this one." Link it to the same "See what's included" page, and list passes there.

### The picker shows 4 of the 7 event types, and the sample event is in the wrong one
- Where: 1 Type picker (Parent-teacher conferences, Volunteer event, Band contest, and Family visitor day only). The sample event in 2–8 is "Cedar Ridge Fall Festival", set up as a Volunteer event
- What happens: The website and the product also offer "Choir, orchestra, or group festival", "School fair or fundraiser", and "Meetings". The fair type's own description names fall festivals. A school that came in from the "School fairs & fundraisers" website page won't find its event type. The mock-up also shows a fall festival going through the volunteer flow, which suggests the fair type doesn't fit.
- Who it hurts: Organizer at a laptop and PTO president. The website promised something the first screen doesn't show them.
- Standard: Marketing role (names of event types match the website), and heuristic 4 (consistency)
- Severity: 3 (if the real picker shows all types, drop this to 1 and just fix the sample)
- Suggested fix: Show every type the website sells, labeled exactly as in the existing event-types list, with publish status badges on each one. Change the sample event to something that's clearly volunteer-only, like "Cedar Ridge Spring Book Fair volunteers" or a "Campus clean-up day". Or keep the festival and show it as a School fair.

### Plan names never appear, so "a plan" means nothing
- Where: 1, 8 ("add a plan", "Your plan can't publish this", "Ready when your plan is")
- What happens: The product has named packages (Volunteer Command, Event Command, and others), and the Account page says "Your plan: <name>". This flow only ever says "a plan", so the organizer can't tell which plan would unlock this event or match it to the website or an email from us.
- Who it hurts: Organizer at a laptop. They have to go to Account or write to us just to find out what to ask for.
- Standard: Marketing role (plan names match the website and emails), heuristic 6 (recognition over recall)
- Severity: 2
- Suggested fix: Name the smallest plan that covers the event type. On screen 8: "Volunteer events are included in Volunteer Command and Event Command, or with a one-time pass." Keep the rest of the card as it is.

### The "you're live" moment is quiet, and a warning sits right under it
- Where: 7 Live, all widths. On phone it's most noticeable, where the orange "Needs you" card fills the screen right below the success card (light and dark)
- What happens: This is the biggest payoff in the flow, and it gets one sentence. The "Before the day" helpers from screen 6 disappear, and the next thing the eye lands on is a warning. Nothing reminds the organizer what the product will now do for them, like the daily sign-up email or event-day check-in opening Nov 13.
- Who it hurts: Organizer at a laptop and PTO president. They miss the reassurance that "nothing is falling through the cracks", and that reassurance is our brand promise (organized and supported).
- Standard: Marketing role ("you're all set" moments). Brand voice: calm, no hype.
- Severity: 2
- Suggested fix: Keep the tone calm, no confetti. Under "Your event is live", add a short "What happens next" list: "You'll get a sign-up email each morning", "Event-day check-in opens Nov 13", and "Invite your team to help". Show the draft job reminder as a neutral line inside the Volunteers card ("1 job still a draft: Bake sale items. Finish it"), not as an orange alert.

### Shifts already filled before the event is published
- Where: 4 Job edit, Parking side panel ("2 of 4 spots filled"). 5 Preview ("2 spots left"). 6 says 24 spots. 7 says "0 of 24 spots filled". All widths and modes
- What happens: The sample data contradicts itself. An unpublished event already has sign-ups, and those sign-ups disappear after publishing. Screen 4 also warns that "Shifts with people in them can't be deleted" on a draft event.
- Who it hurts: Organizer at a laptop. If this ends up in a demo or on a website screenshot, a careful director will notice and doubt the numbers.
- Standard: Marketing role ("would embarrass us"), and the brand's "promises we keep"
- Severity: 2 (in screenshots or demos built from this mock-up)
- Suggested fix: Before publishing, show "0 of 4 spots filled" everywhere, and show the delete rule only once there are sign-ups. Check the sample data against the event's state before any of it goes into marketing material.

### "Unpublish at any time"
- Where: 6 Ready, "When you publish" list ("You can keep editing, and unpublish at any time")
- What happens: It's true in the product, but once volunteers have signed up, unpublishing strands them. "At any time" is the kind of open-ended promise the guardrails warn about, and it sounds like it has no consequences.
- Who it hurts: Organizer at a laptop, and volunteers if an organizer unpublishes casually
- Standard: brand-voice claims guardrails (avoid "always" or "anytime" style promises)
- Severity: 1
- Suggested fix: "You can keep editing after you publish. To take the page down, use Event settings."

### Lock icon on only one badge, and the badge is cut off on desktop
- Where: 1 Type picker, desktop light and dark. "Set up now, publish with a plan" on the Volunteer event card runs past the card edge ("plar"). Only that card has a lock icon, and Band contest and Family visitor day don't
- What happens: A clipped badge on the first screen looks unfinished. With a lock on only one card, that event type looks more restricted than the others.
- Who it hurts: Organizer at a laptop. First impressions count most on this screen.
- Standard: Marketing role (first impressions), heuristic 4
- Severity: 2 (desktop only for the clipping, all widths for the icon)
- Suggested fix: Use the same badge (icon plus a shorter label, like "Publish with a plan") on every locked card, and let it wrap inside the card.

### Product name in the header
- Where: Header on every screen ("FIELD COMMAND"), all widths and modes
- What happens: The product is "Field Command Events" (brand file, URL, and emails). The header drops "Events" and switches to all caps, and the share link on screen 7 shows the full fieldcommandevents.com.
- Who it hurts: Organizers matching the app to the website and invitation emails
- Standard: CLAUDE.md (product name comes from the brand file only), and the Marketing role (names match)
- Severity: 1
- Suggested fix: Pull the header name from the brand file ("Field Command Events"), and use the same logo style as the website.

### The volunteer page misses a chance to say "no account needed"
- Where: 5 Preview (the volunteer page), all widths
- What happens: The page volunteers see is the first time most parents meet us. It doesn't tell them they won't need an account or a password, or that we won't spam them. That's one of the three website promises ("Respectful").
- Who it hurts: Volunteer parent on a phone, who may hesitate. Organizers, too, because this is the page they promote.
- Standard: brand-voice homepage promise ("no account for families, volunteers, or visitors, and no ads or spam"), and the claims wording "emails used only for your event"
- Severity: 2
- Suggested fix: Add one quiet line under "Pick a shift": "No account needed. We only email you about this event." Optionally, add a small footer, "Sign-ups by Field Command Events". Keep it to that one line so it helps and doesn't sell.

## Working well
- "When you publish" on screen 6 is honest and specific. "Nobody is emailed. People find out when you share the link." is exactly the "promises we keep" voice
- "Start from a past event: Copy jobs and shifts from Spring Carnival 2026" on screen 3 is the clearest value moment in the flow for the PTO president. Keep it near the top
- The picker lets people set up any type and publish later ("Set up now"), so nobody hits a wall before they've seen what the product can do
- Screen 8 is calm and reassuring ("Everything you set up here is saved") and offers "Talk with us", which matches the website's secondary call to action
- The live page puts the link, Copy link, and QR code first, and "Share the link in your group text or newsletter" uses the audience's own words
- The tone holds up in both modes and at every width: no exclamation points, no hype, and "organizer"-appropriate role words

Screenshots opened: 1-picker-desktop, 1-picker-desktop-dark, 1-picker-phone, 1-picker-tablet-dark, 2-details-desktop, 2-details-phone-dark, 3-jobs-empty-desktop, 3-jobs-empty-phone, 4-job-edit-desktop, 4-job-edit-phone-dark, 5-preview-desktop, 5-preview-phone, 5-preview-tablet-dark, 6-ready-desktop, 6-ready-phone, 7-live-desktop, 7-live-phone-dark, 8-blocked-desktop, 8-blocked-phone, 8-blocked-tablet-dark.
