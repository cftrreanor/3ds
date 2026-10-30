# Design review: event setup flow (volunteer event)

| | |
|---|---|
| **What was reviewed** | Built pages: Home, type picker, new event form, event page (draft), Volunteer Setup, Event settings. Also the planned mock-ups for the event page and setup pages (IAEvent, IASetup, S2Event, S3Setup). |
| **Stage** | Screenshots of what's live today, plus the plan for where it's heading |
| **Widths and modes** | Phone 390 px, tablet 820 px, desktop 1440 px, each in light and dark (36 screenshots in `2026-10-30-event-setup/`) |
| **Size** | Full panel: Product Manager, Product Owner, UX Designer, UI Designer, Software Engineer, UX Content Manager, Marketing Manager, and the independent usability consultant |
| **Date** | 2026-10-30 |
| **Not reviewed** | Public pages volunteers see, event day, and other event types' setup |

A note on the test data: the screenshots use shared demo data, so a draft event shows things it couldn't really have (412 volunteers, live announcements). Reviewers were told not to count that as a finding.

## The consultant's verdict

**Build after fixes.** The individual screens are careful and plain-spoken, and the accessibility basics are mostly in place. The structure is the problem. There are two progress counts, a guided setup that skips shifts, a "needed" step that's really optional, and two publish gates. Together, these let an organizer "finish setup", publish, and share the link, and still have no volunteers able to sign up.

**The one change that would help most:** replace the 5-step setup and the 3-item checklist with one checklist (Details, Sign-ups and shifts, Publish), where publishing a volunteer event also opens sign-up.

Every role reached the same conclusion from its own angle. Seven of the eight raised the step-count problem without seeing each other's reviews.

## Blocks people (severity 3–4)

Nothing here gets built on or shipped until you decide.

### 1. One checklist: the setup steps don't agree, and the guided setup skips shifts · severity 3 · found by 8 of 8
- **Where:** New event form ("Step 1 of 5": details, team, email, maps, publishing), event page ("1 of 3 needed to publish"), Event settings sidebar (its own checkmarks), and the plan ("0 of 5")
- **What happens:** Four different counts for the same setup. The 5 guided steps never include adding sign-ups and shifts, which is the whole point of a volunteer event. After finishing "5 of 5", the organizer is told they're on step 1 of 3.
- **Who it hurts:** The teacher spends her 15 minutes on email settings and never reaches shifts. The PTO president "finishes" at night and finds out the next day she isn't done. The organizer stops trusting the progress bar.
- **Standard:** Heuristics 1 (status), 4 (consistency); Action over information
- **Suggested fix:** One checklist everywhere: **Details → Sign-ups and shifts → Publish.** Team, email, maps, and documents become optional "before the day" items. After step 1, go straight to "Add your first sign-up". The plan's "Just created" state already shows this.
- **Decision:** _open_

### 2. Plan limits only show up at the finish line · severity 3–4 · found by 6 of 8
- **Where:** Home banner ("only conferences can be published"), the type picker (Volunteer event shows as available), and the event page (the plan block appears only on the publish card). Code: `src/lib/plan.ts:86` builds the picker from the package's types, not from what the account can publish today.
- **What happens:** An account whose free period has ended can pick a volunteer event, set the whole thing up, and only find out at Publish that it can't go live.
- **Who it hurts:** The organizer and the PTO president lose an evening of work and feel tricked. This is the moment most likely to make someone quit.
- **Standard:** Heuristic 5 (error prevention); brand voice "Promises we keep"
- **Suggested fix:** One rule for "can publish", used everywhere. Tag the picker card ("You can set this up, but publishing needs a plan · See what's included"), and show the same line at the top of the event page from the start.
- **Note:** The Product Manager rated this 4, and the consultant rated it 2 because it depends on how often trials end mid-setup. Please confirm the real rule: after a free period ends, can a volunteer event be published or not?
- **Decision:** _open_

### 3. Two Publish buttons that do different things · severity 3 · found by 6 of 8
- **Where:** Event page "Publish event" (puts the page online, keeps sign-up closed, lists what will happen). Volunteer Setup "Publish and open sign-ups" (publishes and opens sign-up in one tap, with no "what happens" list). The checklist calls "Open volunteer sign-up" optional.
- **What happens:** For a volunteer event, the event page's main button publishes a page nobody can sign up on. The organizer texts the link and gets "how do I sign up?" back. Both buttons are green, and green Publish is the brightest thing on the page even while setup is unfinished.
- **Who it hurts:** The organizer, and every volunteer parent who follows the link
- **Standard:** Heuristics 2, 4, and 5
- **Suggested fix:** For volunteer events, have one go-live action that publishes and opens sign-up, with "Keep sign-up closed for now" as an option inside it. Always show the "When you publish" list. Use the brand blue (not green) for go-live, and make Publish the main button only when the event is ready.
- **Decision:** _open_

### 4. "Draft, not finished" sign-ups still go live · severity 3 · found by 5 of 8 · confirmed in code
- **Where:** Volunteer Setup tabs and the save bar ("Save for later" / "Save sign-up"). The draft mark (`details_saved_at`) is never checked by the public pages or the checklist.
- **What happens:** "Save for later" looks like it parks a sign-up privately. It doesn't: it shows to volunteers as soon as sign-up opens. Meanwhile the checklist can say "done" while every tab says "Draft, not finished", and "What's left: Finish the details" never says which detail.
- **Who it hurts:** The teacher who parks a half-built sign-up between classes. The PTO president checking what's left.
- **Standard:** Heuristics 1, 2, and 5
- **Suggested fix:** Either make draft real (hidden from volunteers and from the checklist count, labelled "Draft: volunteers can't see this yet"), or drop the draft state and keep one Save. "What's left" should name the actual gap ("Add a shift").
- **Decision:** _open_

### 5. "Needed to publish" is really only "recommended" · severity 3 · found by 4 of 8
- **Where:** The event page sidebar says "1 of 3 needed to publish". The publish card says "We recommend finishing one more step first", next to an active Publish button.
- **What happens:** An organizer can publish a volunteer event with nothing to sign up for. Volunteers land on an empty page.
- **Suggested fix:** Pick one rule. The panel's recommendation: for volunteer events, require at least one sign-up with a shift, and show why Publish is waiting ("Add at least one shift first").
- **Decision:** _open_

### 6. The same thing has many names · severity 3 · found by 5 of 8
- **Where:**
  - "Sign-up" means a job like Parking, the public form, and one person's registration.
  - "Shift" and "time slot" are used for the same thing.
  - "Lead", "Coordinator", and "Volunteer Lead" are used for the same role.
  - On phone, "My events" becomes "Events" and "Volunteer tracking" becomes "Volunteers".
  - Mixed case appears: "Event Settings", "Volunteer Setup", "Broadcast Message".
- **What happens:** Someone who sets up one event a year has to relearn the words each time. "Publish and open sign-ups" reads as if it opens the Parking job, and "Delete sign-up" could mean removing one volunteer.
- **Suggested fix (Content Manager):**
  - Call the job a **job** ("5 jobs · 4 shifts", "+ Add job").
  - Use **shift** everywhere, and **lead** for the role.
  - Use the same nav labels at every width, and sentence case on all headings and buttons.
- **Decision:** _open_

### 7. Leaving a page can throw away unsaved work · severity 3 · found by 3 of 8
- **Where:** On the new event form, "All events" and "Change the kind of event" don't ask before leaving. On Volunteer Setup, only the tabs ask, and "+ Add sign-up", the back link, and the header don't. On Event settings, a save that fails no longer warns when leaving. Nothing warns when the browser tab closes.
- **Who it hurts:** The teacher when the bell rings, the band director between classes, the PTO president in the car line
- **Suggested fix:** One shared "unsaved changes" check on every setup page, plus a warning when the tab closes. The plan already says "Leaving asks first".
- **Decision:** _open_

### 8. Fixing a typo in the event name emails every volunteer · severity 3 · found by 1 of 8 · confirmed in code
- **Where:** Saving event details (`src/app/dashboard/actions.ts:241`)
- **What happens:** Any change to the name, date, time zone, or venue sends updated calendar invites to everyone signed up, with no warning and no way to skip it.
- **Suggested fix:** Before saving, say "This will email 64 volunteers an updated invite", with an option not to send. Don't email for a name-only change.
- **Decision:** _open_

### 9. A teammate's change, or an old open tab, can be silently overwritten · severity 3 · found by 1 of 8
- **Where:** Event settings save (`actions.ts:206–237`)
- **What happens:** Every save writes every field. A week-old tab can move the event back to its old date and email everyone.
- **Suggested fix:** Refuse the save if the event changed since the page loaded ("Pat changed this 10 minutes ago. Reload to see it"). Only move shifts when the dates actually changed.
- **Decision:** _open_

### 10. The sign-up link and QR code can be shared before the event is live · severity 3 · found by 2 of 8
- **Where:** Volunteer Setup status card on a draft (Copy link, QR code)
- **What happens:** Parents who get the link early land on a page that doesn't work. The plan already says "Publish to get your links".
- **Suggested fix:** Before publishing, show "Your link appears when you publish" in place of the link and the QR code.
- **Decision:** _open_

### 11. Save buttons look switched off when they still work · severity 3 · found by 1 of 8
- **Where:** New event form "Save and continue", Event settings "Save changes" (`globals.css:240`, 50% fade)
- **What happens:** The faded text measures about 2.9:1 in light mode, below the 4.5:1 minimum. People think they can't continue. The same fade means "boxes left" on one page and "nothing to save" on another.
- **Standard:** WCAG 1.4.3
- **Suggested fix:** Drop the fade. Show "2 boxes left" in the footer, the way Volunteer Setup's "What's left" does.
- **Decision:** _open_

### 12. Tab rows run off the screen and hide "+ Add sign-up" · severity 3 · found by 3 of 8
- **Where:** Volunteer Setup sign-up tabs: "Import volunteers" is cut off even on desktop, "+ Add sign-up" is off-screen on tablet, and about 2½ tabs show on phone. Event settings section tabs on phone and tablet.
- **What happens:** Nothing shows that the row scrolls, so the way to add the next sign-up can't be found.
- **Standard:** WCAG 1.4.10; heuristic 6
- **Suggested fix:** Put "+ Add sign-up" and "Import" on their own line above the tabs. Fade the edge and add a "›" arrow when the row overflows. On phone, use a "Sign-up: Parking ▾" picker.
- **Decision:** _open_

### 13. Error messages don't say which box or what to do · severity 3 · found by 3 of 8
- **Where:** New event form and Event settings ("Venue: Required", "End time must be after the start time" when the box is called "Everything wraps up"). Lowering a shift's spots below the people already signed up shows "Some of the values aren't valid". Delete on a shift people have joined asks to confirm, then refuses.
- **Standard:** WCAG 3.3.1, 3.3.3; heuristic 9
- **Suggested fix:**
  - Use the box's own name and say what to do: "Add the venue address, so volunteers know where to go", "'Everything wraps up' needs to be later than 'Gates open'".
  - Hide Delete on shifts people have joined, and say why next to it.
- **Decision:** _open_

### 14. The draft event page shows everything at equal weight · severity 3 · found by 5 of 8
- **Where:** Event page while it's a draft
- **What happens:** Announcements, live spot counts, the Event day tools (check-in, Broadcast Message), "To do", and Publish all sit at the same weight as the next step. The plan's "Setting up" state folds most of this away, but the build shows it all. "To do" says "1 invitation has expired. Resend them from Team setup", with no Resend button.
- **Suggested fix:** Build the plan's states: Next step, then "Needs you" (with fixes inline, like "Resend invitation"), then the area cards. Keep the Event day tools folded away until the evening before.
- **Decision:** _open_

### 15. No way to start from last year's event · severity 3 · found by 3 of 8
- **Where:** Home, the type picker, and the new event form. The plan has "Copy for next year" only after an event is over.
- **Who it hurts:** The PTO president, who runs the same events every year. This is probably the biggest time saver for returning customers.
- **Suggested fix:** Add "Start from a past event" at the top of the type picker. It copies jobs, shifts (moved to the new date), and instructions, but not people. The Engineer rates this a large job, so give it its own brief.
- **Decision:** _open_

### 16. The plan and the build both miss real states · severity 3 · found by 1 of 8
- **The missing states:**
  - published with sign-up still closed
  - unpublished after people signed up
  - blocked by the plan
  - a co-host viewing a draft
  - a failed save
  - cancelled or postponed
  - date or time zone changed after sign-ups
  - a job with no shifts
- **Suggested fix:** Add these columns to the "Every state" boards before building.
- **Decision:** _open_

## Should fix (severity 2)

**Dark mode**
- **Empty logo box is a blank white rectangle.** "No logo yet" is white text on white. Found by 3 of 8 (`logo-form.tsx:104`).
- **Date, time, and dropdown icons nearly disappear.** No `color-scheme: dark` is set. Found by 1 of 8.
- **Help text has the same weight as labels, and unavailable event types look just like available ones.** Found by 2 of 8.

**Accessibility and layout**
- **The pinned save bar can cover the box being typed in.** WCAG 2.4.11, found by 2 of 8. Fix: `scroll-padding-bottom`.
- **Small buttons in the Volunteer Setup status card.** They're 36 px against our 44 px target, with faint outlines. Found by 2 of 8.
- **Shift Delete is grey, and "Edit time slot" doesn't look clickable.** Found by 1 of 8.
- **The locked "Time slots" choice doesn't look selected**, especially in dark mode. Found by 1 of 8.
- **In light mode, unavailable event types are too faint to read** (3.3:1). Found by 1 of 8.

**Flow**
- **"Redo or add shifts" hides adding a shift.** Fix: an always-visible "+ Add shift". Found by 1 of 8.
- **The Home draft card says "finish setup and publish" whatever the next step is.** Fix: show the real one. Found by 2 of 8.
- **New events default to 7 AM–10 PM with "Gates open" wording**, which comes from band contests. Found by 1 of 8.
- **Uploading a logo on the new event form changes every live event right away.** The screen doesn't say so. Found by 3 of 8.
- **The daily sign-up email is off by default**, and its card heading says the opposite of its text. Found by 2 of 8.
- **No "you're all set" moment.** "Almost ready" shows even at 1 of 3, and nothing celebrates when everything's done. Found by 1 of 8.

**Reliability (Engineer)**
- **Some saves are two or three separate writes and can end up half done**, including "Redo shifts" and publish-and-open.
- **Overnight shifts can't be made, and shifts can fall outside the event's hours.**
- **"Volunteers signed up" and "spots filled" count from different data.**
- **The back button after "Save and continue" can create a duplicate event.**
- **Pages load more than a phone needs**: the QR image, every shift, and lookups run one after another.
- **Unpublishing doesn't end live announcements or tell signed-up volunteers.**
- **Several boxes in the plan are large features.** These are copy for next year, waitlist, sign-ups that open at a set time, live "updated 1 min ago" numbers, and archiving. Each needs its own ticket.

**Words and promises**
- **Plan banners:**
  - The "free period ended" banner's only next step is an email address.
  - The "Free" badge doesn't say "during the pilot".
  - Locked event types are a dead end.
- **The email footer tagline is wrong.** It says "Run event day from one place." instead of the brand tagline (`src/lib/brand.ts`).
- **The privacy line on Volunteer Setup reads as if children are deleted.** Fix: "We delete volunteers' phone numbers, and everything about under-18 helpers, 10 days after the event."
- **"Adults only" hint, "To do" wording, and the "Skip anything" vs "required" contradiction.** The Content Manager has exact rewrites for each.

**Measuring**
- **There are no numbers to show whether setup gets faster or more events get published.** Suggest a few anonymous counts, for example created, sign-ups added, published, and plan-blocked.

## Polish (severity 1)

- Periods on fragments ("Optional."), "&" in labels, "e.g.", "anytime" vs "at any time"
- "All times are Central Time." repeats the line above it
- The type picker subtitle mentions "bands or groups" to everyone
- On tablet, the Feedback tab overlaps cards
- The time zone dropdown is cut off on phone
- On tablet, Home cards use half the width

## What's working well

Every role praised the first one.

- **The "When you publish" list:** page goes online, sign-up stays closed, nobody is emailed, and you can unpublish. Keep it and use it for every Publish button.
- **The "Next step" card:** one heading, one line, one button. Make it the only filled button on the page.
- **"Draft: only your team can see this":** status and meaning in a few words.
- **Save status:** "Last change: … saved this today at 4:59 AM" and "All changes saved" (announced to screen readers) answer "is this saved?".
- **Time zone help** that explains itself at the moment it's needed.
- **Specific privacy promises** ("deleted 10 days after") instead of a vague "privacy protected".
- **Solid basics underneath:**
  - Times are correct across daylight saving.
  - Phone-number privacy is enforced by the database.
  - Joined shifts can't be deleted.
  - Errors move focus to the first problem box.
  - Status always has words, never color alone.
- **The plan's direction:** states by phase, a job to be done for each, "See it as a parent", and "Copy for next year".

## By role

- **Product Manager:** The flow aims at the right person, but the path doesn't follow the job. Raised the plan-limit trap as the worst problem (4). Only the PM raised that we have no numbers to tell whether setup works.
- **Product Owner:** No single definition of "ready" or "done". Listed the missing states and wrote the acceptance criteria below.
- **UX Designer:** Each screen works alone, and the problem is how they connect. Only the UX Designer caught "Redo or add shifts" hiding the add action.
- **UI Designer:** Calm and consistent overall. Found the faded Save buttons failing contrast, green competing with blue for the main action, and two dark-mode breaks.
- **Software Engineer:** Solid foundations, but risk around saves. Only the Engineer raised the name-typo email blast, overwrites from old tabs, half-done saves, overnight shifts, and duplicate events. Sized the plan's features.
- **UX Content Manager:** The copy is calm and on-voice, but the naming isn't. Gave Before → After rewrites for every finding.
- **Marketing Manager:** The flow keeps its promises, except around plans. Only Marketing caught the wrong email tagline, the "Free" badge, and the missing "you're all set" moment.
- **Consultant:** Build after fixes. One checklist, with publish opening sign-up.

**Where reviewers disagreed:** Severity of the plan-limit trap (PM 4, consultant 2), because it depends on how often trials end mid-setup. Whether to keep "Save for later" at all: the UX Designer would remove it unless it really hides the job, while the consultant likes how it matches part-time work.

## Acceptance criteria (from the Product Owner)

- Given a new volunteer event, when the organizer finishes the first form, then they land on the event page, and its progress count uses the same steps and numbers as the form.
- Given any setup page, when the organizer clicks a Publish button, then they see the same "What goes live" list and plan check as on the event page, before anything goes live.
- Given an event that is published but has sign-up closed, when the organizer opens Volunteer Setup, then the main action is "Open sign-up" and the page says volunteers can't sign up yet.
- Given a job with no shifts or items, when the event is published, then that job is either hidden from volunteers or listed in "What's left" first (choose one and document it).
- Given an account whose plan doesn't include this event type, when the organizer opens the type picker, then that type says publishing needs a plan, before any setup starts.
- Given unsaved changes, when the organizer clicks another tab, Back, or the Checklist link, then they're asked before anything is lost.
- Given a save that fails, when the save bar shows an error, then the typed work is still on screen and the error says how to retry.
- Given a draft event, when anyone opens the event page, then the Event day tools and messages are folded below the setup steps.
- Given a co-host who isn't the Host, when they open a draft, then they see what's left and who can publish, with no Publish button.
- Given every step is done, when the organizer opens the event page, then the top block is "Ready to publish", with a "See it as a parent" preview.
- Given any screen in this flow, at 390, 820, and 1440 px in light and dark, then the main action for that state is visible without scrolling past event-day tools.

## Limits

This is an AI review, not testing with real people. Reviewers worked from screenshots and code with demo data. Axe wasn't run this time, so contrast figures were calculated from the color values. For anything rated 3 or 4, try the flow with two or three real people from the six groups before launch, especially a PTO president and a teacher on a lunch break.
