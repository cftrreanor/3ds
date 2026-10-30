# UX Content Manager

## Headline
The words are mostly calm, plain, and on-voice: progress lines like "2 boxes left: Starts and Ends" and "What's left: add a shift" are excellent, and there are no exclamation points. The big problem is the plan rules. "Free period", "pilot", "plan", and "your plan" are used in ways that contradict each other, so an organizer can't tell whether they have a plan or what they'd pay for. The second problem is that "draft" means two things (an unpublished event and a hidden job), and the job-draft wording changes on every screen.

## Findings

### "Free period", "pilot", and "plan" contradict each other
- Where: 1 Type picker, the banner and the Parent-teacher conferences card (all widths, both modes)
- What happens: The banner says "Your free period ended Oct 20". The conferences card then says "Free during the pilot, one published at a time". That's three money words on one screen (free period, pilot, plan), and the screen never says how they relate. A reader can fairly ask: "If my free period ended, why is this free? When does the pilot end?"
- Who it hurts: The PTO president and the teacher, who are deciding in a short window whether they can use the product at all. The Organizer at a laptop, who needs to trust what happens when they publish.
- Standard: Content clarity, "same thing, same word". Brand voice, "promises we keep" (don't hint at a free deal with no end date).
- Severity: 3
- Suggested fix: Use "free period" and "plan" only, and drop "pilot" from in-app copy.
  - Card line, Before: "Free during the pilot, one published at a time" → After: "Free to publish, one at a time"
  - Card badge, Before: "You can publish this" → After: "Free to publish"

### Screen 8 says "Your plan" to someone who has no plan
- Where: 8 Blocked, the warning heading, the summary card heading, and the disabled button (all widths, both modes)
- What happens: The heading says "Your plan can't publish this event yet", but the body says "you can publish it as soon as you add a plan". The reader is left asking whether they have a plan or not. "Ready when your plan is" repeats the confusion. "Publish and open sign-up" is greyed out with no reason next to it.
- Who it hurts: The Organizer at a laptop, who thinks they've done something wrong or that their plan is broken. The PTO president, who may email support instead of acting.
- Standard: Content clarity ("answer first", "same thing, same word"). Heuristic 9 (help users recover from errors).
- Severity: 3
- Suggested fix:
  - Heading, Before: "Your plan can't publish this event yet" → After: "Add a plan to publish this event"
  - Body, Before: "Your free period ended Oct 20. Right now you can publish parent-teacher conferences, one at a time. Everything you set up here is saved, and you can publish it as soon as you add a plan." → After: "Your free period ended Oct 20. Without a plan, you can publish one parent-teacher conference at a time. Everything here is saved, so you can publish as soon as you add a plan."
  - Card heading, Before: "Ready when your plan is" → After: "Ready to publish once you add a plan"
  - Add a line under the disabled button: "Needs a plan to publish"

### Vague link and button: "See what's included"
- Where: 1 Type picker, banner link. 8 Blocked, the main button (all widths)
- What happens: "Included" in what? The organizer doesn't know this leads to plans and prices. It's also the main action on screen 8, so it has to say where it goes.
- Who it hurts: The teacher with 10 minutes, who won't click a link when they can't guess where it goes.
- Standard: Content clarity, "buttons say what happens"
- Severity: 2
- Suggested fix: Before: "See what's included" → After: "See plans and prices" (both screens). Keep "Talk with us": it matches the website.

### Picker badge is long and gets cut off on desktop
- Where: 1 Type picker, the badges on the Volunteer event, Band contest, and Family visitor day cards. The text is clipped ("publish with a plar") on the Volunteer event card at desktop width only.
- What happens: "Set up now, publish with a plan" is a seven-word sentence squeezed into a badge. At desktop width it runs past the card edge and the last word is cut.
- Who it hurts: The Organizer at a laptop, who has to read every card to find out what's allowed.
- Standard: Content clarity ("short", "answer first")
- Severity: 2
- Suggested fix: Before: "Set up now, publish with a plan" → After: "Needs a plan to publish". The banner already says you can set up any kind of event.

### "Draft" means two things, and the job-draft wording changes on every screen
- Where: 3, 6, and 8 (event pill). 4, 5, 6, and 7 (job draft labels).
- What happens: The event pill says "Draft: only your team can see this event" on screen 3, then "Draft: only your team can see this" on screens 6 and 8. Draft jobs are labeled five different ways:
  - "Draft · needs a shift" and "Draft · hidden" (4, job tabs)
  - "Draft: volunteers can't see this job" (4, banner)
  - "Draft · volunteers won't see this" (5)
  - "stays hidden until you mark it ready" (6)
  - "still a draft, so volunteers can't see it" (7)

  On screen 6, an event "Draft" pill sits right above "1 draft job", so the reader has to work out which draft is which.
- Who it hurts: The Organizer at a laptop, who needs to trust what volunteers will see. The PTO president, who skims and could mix up "my event is a draft" with "this job is a draft".
- Standard: Content clarity, "same thing, same word". Heuristic 4 (consistency).
- Severity: 2
- Suggested fix: Choose one pattern for each meaning and use it everywhere.
  - Event pill, everywhere, Before: "Draft: only your team can see this event" → After: "Draft: only your team can see this"
  - Job tab, Before: "Draft · hidden" → After: "Draft · hidden from volunteers"
  - Job tab, Before: "Draft · needs a shift" → After: "Draft · add a shift"
  - Preview pill, Before: "Draft · volunteers won't see this" → After: "Draft · hidden from volunteers"
  - Use "can't" everywhere, never "won't".

### Preview heading and item counts don't fit "things to bring" jobs
- Where: 5 Preview, the "Pick a shift" heading and the Bake sale items card (all widths)
- What happens: The page heading says "Pick a shift", but a job can be a list of things to bring (screen 3 says "Volunteers pick a shift or an item"). Once Bake sale items is ready, the heading will be wrong. "cookies (0 of 6)" is unclear: 0 of 6 what? Shifts nearby say "2 spots left", so the two counts read differently.
- Who it hurts: The Volunteer parent on a phone, who reads "0 of 6" as "none available". The organizer, who checks the preview to trust what parents will see.
- Standard: Content clarity ("plain words", "same thing, same word")
- Severity: 2
- Suggested fix:
  - Heading, Before: "Pick a shift" → After: "Pick how to help"
  - Item line, Before: "Bring: cookies (0 of 6), brownies (0 of 4)" → After: "Bring: cookies (6 needed), brownies (4 needed)"

### "Preview" on a live event
- Where: 7 Live, the third button in "Your event is live" (all widths)
- What happens: The event is already public, but the button says "Preview". On screens 4–6, "preview" meant "a private look before volunteers can see it". Here it would open the real public page.
- Who it hurts: The Organizer at a laptop, who may think the event isn't really live yet.
- Standard: Content clarity, "same thing, same word"
- Severity: 2
- Suggested fix: Before: "Preview" → After: "View your page". Also, Before: "QR code" → After: "Get QR code" (buttons start with a verb).

### Vague follow-up on the live page: "Needs you" and "Finish it"
- Where: 7 Live, the amber box (all widths)
- What happens: "Needs you" is a slightly cute heading that doesn't say what's needed. "Finish it" is a link that doesn't say what you're finishing.
- Who it hurts: The PTO president coming back in the car line, who needs to see in one glance what's left.
- Standard: Brand voice ("warm, not cute", "clear, not clever"). Content clarity ("buttons say what happens").
- Severity: 2
- Suggested fix:
  - Heading, Before: "Needs you" → After: "Still to do"
  - Link, Before: "Finish it" → After: "Finish this job"

### Publish button doesn't change with the "Keep sign-up closed" checkbox
- Where: 6 Ready, the checkbox, the "When you publish" list, and the main button (all widths)
- What happens: If the checkbox is ticked, the button still says "Publish and open sign-up". The first bullet still says "volunteers can sign up". Both would then be false.
- Who it hurts: The Organizer at a laptop, who reads the button as a promise of what happens.
- Standard: Content clarity ("buttons say what happens"). Heuristic 1 (visibility of system status).
- Severity: 2
- Suggested fix: When the box is ticked:
  - Button, Before: "Publish and open sign-up" → After: "Publish with sign-up closed"
  - First bullet, Before: "Your event page goes online, and volunteers can sign up" → After: "Your event page goes online. Sign-up stays closed until you open it"
  - Shorten the checkbox help, Before: "(the page goes online, but nobody can sign up until you open it)" → After: "(people can see the page but can't sign up yet)"

### Awkward time-zone help text
- Where: 2 Details, the help text under "Time zone" (all widths)
- What happens: "From your browser. Every time volunteers see uses this zone." "Browser" is a tech word. The second sentence trips the reader: "Every time volunteers see" reads at first like "every time that volunteers look".
- Who it hurts: The Organizer at a laptop and the teacher, who aren't sure whether they need to change it.
- Standard: Content clarity ("plain words")
- Severity: 2
- Suggested fix: Before: "From your browser. Every time volunteers see uses this zone." → After: "We set this from your computer. Volunteers see all times in this zone."

### Empty-state explanation of "job" is clumsy
- Where: 3 Jobs, empty state (all widths)
- What happens: "A job is a place to help or a list of things to bring, like Parking, Face painting, or a bake sale." A job isn't really "a place". The capitals are inconsistent ("Parking" and "Face painting", but "a bake sale"). And a bake sale is an example of things to bring, which the sentence doesn't make clear.
- Who it hurts: The PTO president setting up for the first time, who needs to understand "job" before adding one.
- Standard: Content clarity ("plain words", "short")
- Severity: 2
- Suggested fix: Before: "A job is a place to help or a list of things to bring, like Parking, Face painting, or a bake sale. Volunteers pick a shift or an item." → After: "A job is a way to help, like parking or face painting, or a list of things to bring, like bake sale treats. Volunteers pick a shift or an item."

### Import and copy buttons are named differently on different screens
- Where: 3 Jobs ("Import from a spreadsheet", "Copy jobs"). 4 Job edit ("Import").
- What happens: The same action is "Import from a spreadsheet" on one screen and just "Import" on the next. "Copy jobs" also leaves out shifts, though the line next to it says "Copy jobs and shifts".
- Who it hurts: The PTO president reusing last year's setup, who has to work out whether these are the same thing.
- Standard: Content clarity ("same thing, same word", "buttons say what happens")
- Severity: 1
- Suggested fix:
  - Screen 4, Before: "Import" → After: "Import from a spreadsheet"
  - Screen 3, Before: "Copy jobs" → After: "Copy jobs and shifts"

### Small wording fixes on the job editor and ready page
- Where: 4 Job edit, the shift panel and the job picker (phone only). 6 Ready, the bullets and the "Before the day" list.
- What happens:
  - The shift-delete rule uses "people", where everywhere else says "volunteers".
  - On phone, "1 job ready · 2 drafts" and "3 jobs: 1 ready, 2 drafts" appear a few lines apart, saying the same thing twice.
  - One bullet on screen 6 is two full sentences ending in a period. The others are fragments with no period.
  - "Daily sign-up email – On for you" doesn't say what the email contains.
  - "Edit" and "Delete" links don't say what they act on.
- Who it hurts: The Organizer at a laptop (small trust and scanning costs)
- Standard: Brand voice (consistent bullet punctuation). Content clarity ("same thing, same word", "short").
- Severity: 1
- Suggested fix:
  - Before: "Shifts with people in them can't be deleted. Move or remove the people first." → After: "You can't delete a shift with volunteers in it. Move or remove them first."
  - Phone: delete "3 jobs: 1 ready, 2 drafts" under the Job picker.
  - Before: "Nobody is emailed. People find out when you share the link." → After: "We don't email anyone, so share the link yourself"
  - Before: "Daily sign-up email" / "On for you" → After: "Daily email of new sign-ups" / "On, sent to you"
  - Edit and Delete links get hidden screen-reader text: "Edit 8:00–11:00 AM shift", "Delete 11:00 AM–2:00 PM shift"

### Product name in the header doesn't match the brand name
- Where: Top bar on screens 1–4 and 6–8 (all widths, both modes)
- What happens: The header reads "FIELD COMMAND". The product name in src/lib/brand.ts is "Field Command Events", and the public link uses fieldcommandevents.com.
- Who it hurts: The Volunteer parent, who sees "fieldcommandevents.com" in a group text and then a different name in the app
- Standard: Project rule, "product name comes from src/lib/brand.ts only"
- Severity: 1
- Suggested fix: Before: "FIELD COMMAND" → After: "Field Command Events" (read from brand.name)

## Working well
- Progress copy that says exactly what's left: "2 boxes left: Starts and Ends", "What's left: add a shift", "2 of 3 steps done. Last step: publish", and "Publish needs a plan"
- Clear preview wording: "Preview only. Volunteers can't see this page yet." This, the "Close preview" link, and "Sign-up opens when published" make it plain that the page is a preview, which the draft-job rule requires.
- The draft-job banner on screen 4 answers first: "Draft: volunteers can't see this job. It stays hidden until you mark it ready. You and its lead can preview it."
- Plain privacy note on leads: "Leads see who signed up. On event day they also see volunteers' phone numbers."
- "When you publish" sets expectations honestly, including "Nobody is emailed". The "Optional. None of these stop you from publishing." line keeps decisions from piling up front.
- "Your event is live" plus "Share the link in your group text or newsletter" uses the audience's own words
- Correct "sign-up" (noun) and "sign up" (verb) throughout. Oxford commas are used ("Check-in, badges, and messages"). Headings and buttons have no stray periods or exclamation points. "Talk with us" matches the website.
- Reassuring lines: "Everything you set up here is saved" and "You can change everything later"

Screenshots opened: 1-picker desktop/phone/tablet, 2-details desktop/phone, 3-jobs-empty desktop/phone, 4-job-edit desktop/phone/tablet, 5-preview desktop/phone/phone-dark, 6-ready desktop/phone/tablet, 7-live desktop/phone, 8-blocked desktop/phone/desktop-dark (20 of 48. The copy is the same across widths and modes; I didn't open the other tablet and dark shots).
