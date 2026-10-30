# Heuristic evaluation: Field Command Events (Evaluator A)

**Perspective:** first-time, low-tech users on a phone (390px): a parent volunteering for a shift, a parent booking a conference or registering for a visitor day, and a brand-new PTO/booster organizer creating their first event.
**Weighting:** heaviest on cross-page consistency and flow.
**Evidence:** screenshots in `scratchpad/audit/` (`-m` = phone, `-d` = desktop) plus code in `src/`. Standards: `docs/DESIGN.md`, `docs/brand-voice.md`, `CLAUDE.md`.
**Severity:** NN/g 0 to 4 (0 = not a problem, 1 = cosmetic, 2 = minor, 3 = major, 4 = catastrophe).

---

## Flow pass (summary of where I'd hesitate)

**Parent volunteer (public event page, then /volunteer, then confirmation, then /my)**
1. The public event page (`pub_e_cedar-ridge-x7k2-m.png`) opens with schedule changes, an emergency banner, maps, and the band schedule. The "Sign up to volunteer" card only appears in a grid further down (`src/app/e/[slug]/page.tsx:214-262`), so a parent sent "the event link" has to hunt for it. *Hesitation.*
2. On /volunteer the first button is **"Save and finish"** (`signup-form.tsx:155`). It doesn't finish anything: it leads to a review step with **"Confirm sign-up"** (`:446`). A rushed parent who sees "finish" and then a new screen may think they're done and close the tab. *Likely failure point.*
3. The confirmation is excellent: shifts listed, Google and Apple/Outlook calendar links, and an email. *Good.*
4. Coming back later: "My volunteering" in the header only shows if the device remembers them. Otherwise it's an email magic link (`band_my-m.png`). That works.

**Parent booking a conference (/book)**
1. Clear: "Pick a time", then "How would you like to meet?", then "Your family", then **Book this time** (`conf_e_..._book-m.png`). *Good, the smoothest flow in the product.*
2. The confirmation says "You're booked" with a link to "See, change, or cancel this booking" (`booking-form.tsx:130-147`). It has no on-page add-to-calendar button, though the volunteer flow has one. It also doesn't repeat the room or how to join the video.
3. Coming back: there's no "My bookings" page like "My volunteering". The email is the only way back.

**Parent registering for a visitor day (/parents)**
1. Once registration ends, the page says "This event is over." with nothing else: no link, no contact (`visit_e_..._parents-m.png`, `parents/page.tsx:89-96`). It's a dead end.
2. If registration is closed it says "Please contact the school" but doesn't give a name, email, or phone.

**New organizer creating a first volunteer event**
1. The dashboard (`band_dashboard-m.png`) shows two **New event** buttons, an "Admin" pill, and a plan banner. That's busy but navigable.
2. The type picker (`band_dashboard_events_new-m.png`) shows 7 cards. 4 are faded "Not in your plan", and tapping them does nothing, with no explanation or upgrade path on the card (`event-type-picker.tsx:41-44`).
3. The wizard "Set up your event" runs Event details, then Team setup, then Email settings, then Maps, then Publishing (`setup-steps.tsx:8-14`). For a volunteer event, the thing a PTO parent came to do (**make shifts**) isn't one of the steps. They're asked to invite co-hosts and set reply-to email first. On phones the step names are hidden (`hidden sm:block`, `setup-steps.tsx:56`), so they see 5 bars and "Step 2 of 5" with no idea what's coming. *Major flow issue.*
4. Conference and meeting events skip this wizard entirely and use a one-field "Create event" form (`new/page.tsx:93-127`). That gives two different creation flows for the same "New event" button.
5. After setup the event overview is a long scroll of cards. Each card's button goes to a "Setup" page whose status card, save bar, and publish control work differently from page to page (see Heuristic 4).

---

## 1. Visibility of system status

### Working well
- "Last change: … saved this today at 9:23 PM" with a check icon on every overview and setup page (`saved-by.tsx`). It quietly reassures organizers that a co-host's edits stuck.
- Public shift rows show "4 left", "Full", "1 left", and full shifts are disabled (`pub_e_..._volunteer-m.png`).
- Volunteer check-in shows "Updates on its own · Updated just now" with a green dot (`band_dashboard_events_e1_volunteers-m.png`).
- Setup tabs show a ✓ and a status line under each tab ("12 meetings · 3:00 PM – 6:55 PM").
- The setup checklist ("Setup complete / Show the checklist") sits beside the event on desktop (`conf_dashboard_events_e1-d.png`, `setup-guide.tsx`).
- Sticky save footers say "All changes saved" (`band_dashboard_events_e1_edit-m.png`).

### Findings

**A1-1. The live indicator is on Volunteer check-in only; Parent check-in has none** (Severity 2)
- Where: `/dashboard/events/[id]/volunteers` vs `/parents/check-in`
- What: Volunteer check-in says "Updates on its own · Updated just now". Parent check-in, which is used at the door at the same moment, shows no live or stale state. A volunteer at the parent table can't tell whether a co-worker's check-in on another phone has shown up.
- Evidence: `band_dashboard_events_e1_volunteers-m.png` vs `visit_dashboard_events_e1_parents_check-in-m.png`
- Recommendation: Put the same `auto-refresh` "Updates on its own · Updated X ago" line on every check-in page (parents, partners/booths, volunteers). Make it one shared `<LiveStatus>` component.

**A1-2. Parent check-in shows a contradictory "turns on" date after the event is over** (Severity 2)
- Where: `visit_dashboard_events_e1_parents_check-in-m.png`
- What: The overview says "The event is over" (Oct 20), but check-in still says "Check-in buttons turn on Mon, Oct 19, 2026, so no one gets checked in early." The message is written for "before" and shows in every state, so the organizer gets a false status.
- Recommendation: Give the message three states: before ("turn on Mon, Oct 19"), during (hidden), and after ("This event is over. Check-in is closed. Download the list").

**A1-3. "Save and finish" claims completion before the sign-up is confirmed** (Severity 3)
- Where: `src/app/e/[slug]/volunteer/signup-form.tsx:155`, then the review step at `:418-446`
- What: The first button says "finish", but the next screen is "Check everyone before you confirm" with a second, full-width "Confirm sign-up" button. Rushed parents who see "Save and finish", tap, and look away may leave without being signed up. Nothing is saved at that point. "Save" is false too, because state only lives in the browser.
- Evidence: `pub_e_cedar-ridge-x7k2_volunteer-m.png`
- Recommendation: Rename it to **"Review and confirm"** (and "Add another person"). Show "Step 2 of 2: Confirm" on the review screen. Or, when it's only one person, skip the review step and make the button **"Sign up"**.

**A1-4. The overview's announcement strip is always alarm-red** (Severity 2)
- Where: event overview strip "⚠️ 2 live announcements · Band … Manage →" (all overview screenshots)
- What: The strip uses danger styling and ⚠️ even when the live messages are ordinary "Announcement"/"Schedule change" types. DESIGN.md reserves `danger` for "late, blocked, failed, destructive". A new organizer reads it as "something is wrong with my event". It also truncates to "Band …" on phones, so it says nothing.
- Evidence: `conf_dashboard_events_e1-m.png` (a conference event showing a red "Band switch" strip)
- Recommendation: Use `brand-soft` for normal messages and red only when an Emergency is live. On phones, stack the count over the first message instead of truncating.

**A1-5. Setup steps are invisible on phones** (Severity 3)
- Where: `src/app/dashboard/events/_components/setup-steps.tsx:56` (`hidden text-xs sm:block`)
- What: A first-time organizer on a phone sees five coloured bars and "Step 1 of 5". They can't tell that steps 2 and 3 are team and email, or that 4 and 5 are optional, so they don't know how long this takes or what can be skipped.
- Recommendation: On phones, show "Step 2 of 5 · Team setup", then "Next: Email settings" under the bars. Or use a vertical list of the 5 step names with the current one bold.

**A1-6. Badge tones for the same state differ between pages** (Severity 2)
- Where: Volunteer Setup `volunteering/page.tsx:225` uses `tone="brand"` (navy) for "Signup open". Band Registration `bands/page.tsx:143` and Parent Registration `parents/page.tsx:115` use `tone="live"` (green) for "open" and `tone="off"` (solid red) for "closed". The overview uses a soft green outline for "Sign-up open".
- What: "Open" is navy on one page and green on another. "Closed" (a normal, intended state) is solid red, which the Badge doc itself describes as "Not published". Parents see "Registration closed" in red the day after their event and wonder what broke.
- Evidence: `band_dashboard_events_e1_volunteering-m.png`, `band_dashboard_events_e1_bands-m.png`, `visit_dashboard_events_e1_parents-m.png`
- Recommendation: Use one `RegistrationStatus` badge: open = green "live", not open yet / closed = neutral, not published = warning. Keep red for real problems.

---

## 2. Match between system and the real world

### Working well
- Times read the way people say them ("5:00 AM – 10:00 AM CDT"), and the time zone is stated once per page ("All times are Central Time").
- Public copy is in the user's words: "I'm under 18", "How would you like to meet?", "Anything you'd like to talk about?"
- The privacy panel on the booking page explains rules in plain terms ("Other families only see which times are still open").
- The schedule is ordered the way the event runs (performance order, lunch break inline).

### Findings

**A2-1. One feature, three names: Announcements / Broadcast Messages / Broadcast Message** (Severity 2)
- Where: overview strip "2 live announcements · Manage" → page title "Broadcast Messages" (`announcements/page.tsx`) → message type "Announcement" → button "Broadcast Message". The route is `/announcements`.
- What: An organizer who tapped "Manage" on "announcements" lands on "Broadcast Messages" and wonders whether it's the same thing. "Broadcast" is also broadcaster jargon, not PTO language.
- Evidence: `band_dashboard_events_e1_announcements-m.png`
- Recommendation: Call it **"Announcements"** everywhere: title "Announcements", button "Post announcement", types "General / Schedule change / Emergency".

**A2-2. "Family visitor day" vs "Parent registration" vs "Thanksgiving Lunch"** (Severity 2)
- Where: type picker card "Family visitor day"; overview badge "Family visitor day"; setup page "Parent Registration"; public eyebrow "Parent registration"; check-in "Parent check-in"; button "Parent door check-in".
- What: The organizer chose "Family visitor day", but every page after that says "Parent". Grandparents and guardians are told it's for parents.
- Recommendation: Pick "Family" or "Visitor" and use it throughout ("Visitor registration", "Visitor check-in"). Or rename the type to "Parent visit day" to match the rest.

**A2-3. "Signup" vs "Sign-up" vs "sign up" on the same page** (Severity 1)
- Where: Volunteer Setup: "Signup open", "Signup link", "Close volunteer signup" (`volunteering/page.tsx:226,233,274`), but "Volunteer sign-ups", "Save sign-up", "Delete sign-up" on the same screen. The overview says "Sign-up open".
- What: Cosmetic for most users, but it signals carelessness and breaks search ("signup" vs "sign-up").
- Recommendation: The noun is "sign-up" and the verb is "sign up". Fix the three strings and add the rule to brand-voice.md.

**A2-4. "Not in your plan" with no plan words the user knows** (Severity 2)
- Where: type picker (`event-type-picker.tsx:27`), account page "Your plan: Event Command"
- What: A PTO parent doesn't know they have a "plan", what "Event Command" is, or how to get the other types. The faded cards are inert `div`s. The explanation ("Add a one-time event pass or upgrade… Account page") only appears on the conference path (`new/page.tsx:117-125`), not on the picker.
- Recommendation: Make locked cards tappable. Open a short sheet: "Band contests aren't in the free pilot plan. Write to us for a one-time event pass" with the support link.

**A2-5. The brand tagline in code differs from the brand-voice tagline** (Severity 1)
- Where: `src/lib/brand.ts:4` `tagline: "Run event day from one place."` vs brand-voice.md "Every detail organized. Every organizer supported." The home hero h1 is "School events without the clipboards" (`src/app/page.tsx:322`), while brand-voice says the hero headline is the tagline.
- What: This is a standards conflict, not a usability blocker. Whoever reads brand.ts gets a different tagline.
- Recommendation: Settle which is canonical and update brand.ts or the doc.

**A2-6. "What I lead" and "Coordinator/Volunteer Lead" roles are unexplained to a new organizer** (Severity 2)
- Where: overview "Event day" card (`visit_dashboard_events_e1-m.png`, `fair_dashboard_events_e1-m.png`), Team setup tabs "Co-hosts / Volunteer Leads / Coordinators"
- What: Three helper roles plus Host and Account Host. A first-time PTO parent can't tell a Lead from a Coordinator, and "What I lead" is a button with no explanation.
- Recommendation: Put a one-line role definition under each Team tab title (it partly exists for Co-host only). Rename "What I lead" to "My stations".

---

## 3. User control and freedom

### Working well
- Volunteers can add or remove people before confirming ("Remove Maya") and get a change/cancel link by email.
- Booking and parent registration emails carry "see, change, or cancel" links.
- Setup tabs ask "Save your changes first?" before leaving, and "Save for later" exists on a sign-up.
- Announcements have "End now".
- Back links are present on every organizer sub-page.

### Findings

**A3-1. Visitor-day public page is a dead end once over or closed** (Severity 3)
- Where: `src/app/e/[slug]/parents/page.tsx:89-96`; `visit_e_cedar-ridge-x7k2_parents-m.png`
- What: "This event is over." in a card, then nothing. Band registration's equivalent card has "See the event page" (`pub_e_..._bands-m.png`). For "Registration is closed" the copy says "contact the school" but gives no contact. brand-voice.md: "Every page ends with a clear next step, so no path is a dead end."
- Recommendation: Every closed or over state links back to the event page and shows the organizer's reply-to email (it's already configured in Email settings). Use one shared `<ClosedNotice>` across bands, parents, book, and volunteer.

**A3-2. No way back to a conference booking or visitor registration except email** (Severity 2)
- Where: `/my` covers volunteering only (`public-nav.tsx`). There's no equivalent for bookings or registrations.
- What: A parent who deleted the email can't find their booking. Volunteers get "My volunteering" and a "remember this device" flow, but parents booking a conference don't, even though the header shows "My events" (an organizer-only concept).
- Recommendation: Generalise `/my` to **"My sign-ups"**, covering shifts, bookings, and registrations, with the same magic-link email. Show it in the public header for anyone remembered on this device.

**A3-3. Back-link wording varies by page type** (Severity 1)
- Where: overview and the new-event picker say "← All events". Sub-pages say "← Back to {event name}". The dashboard title says "Your events" and the nav says "My events" (desktop) or "Events" (phone).
- What: Three names for the same list screen. Minor, but low-tech users rely on matching words to orient.
- Recommendation: Use one name, "My events", for the title, nav, and back link. Sub-pages say "← {event name}" without "Back to".

**A3-4. Two event-creation flows behind one "New event" button** (Severity 2)
- Where: `src/app/dashboard/events/new/page.tsx:63-91` (5-step wizard, "Save and continue") vs `:93-127` (conference/meeting: name only, "Create event")
- What: An organizer who made a conference first and a volunteer event next meets a different flow. The wizard also has no visible "Skip this step" control. The only exit is the text "Skip anything for now: it's all in Event settings later".
- Recommendation: Use one wizard for all types, with type-specific steps (see A10-1). Every step gets a visible secondary "Skip for now" button beside the primary.

---

## 4. Consistency and standards (heaviest weight)

### Working well
- The shared kit in `ui.tsx` (Button, Field, Card, Badge, FormMessage) is used on every page. Fields, labels, and 44px targets are consistent.
- Every setup page follows the same skeleton: back link, title, "saved by", status card (link, Copy link, Preview page, QR code folded), tabs with ✓, then content. DESIGN.md's "Setup pages" pattern is clearly being followed.
- Copy is calm, without exclamation points in product strings. Host-entered text such as "Thank you for supporting our students!" is the organizer's own.
- The required-field pattern (faded button until filled, red only after a tap) is the same on every form.

### Findings

**A4-1. The same header links have different names on phone and desktop** (Severity 2)
- Where: `src/app/dashboard/layout.tsx:35-48`
- What: Desktop says "My events · Volunteer tracking · Account · Sign out". Phone says "Events · Volunteers · ☰". On a phone, "Volunteers" sounds like *this event's* volunteers, but it opens the cross-event Volunteer tracking report. Meanwhile each event's volunteer check-in lives at `/volunteers`. Organizers who switch between laptop and phone see two vocabularies.
- Evidence: `conf_dashboard_events_e1-d.png` vs `band_dashboard-m.png`
- Recommendation: Use the same words at every width ("My events", "Tracking"). Or move Volunteer tracking into the ☰ menu on phones.

**A4-2. Each setup page's "main action" in the status card looks different** (Severity 3)
- Where and what: status cards on setup pages:
  - Volunteer Setup: **"Close volunteer signup"**, a red outline (`danger`) button, among four grey buttons (`volunteering/page.tsx:274`)
  - Conference Setup: **"Unpublish"**, red outline (`conferences/page.tsx:129`)
  - Band Registration: **"Reopen registration"**, a solid green `go` button (`bands/reopen-registration.tsx:26`)
  - Parent Registration (closed): **no action at all**. Reopening means reading body text that points to Event settings (`parents/page.tsx:157`)
  - Performance Schedule: no status card. It uses a pinned publish bar with "Unpublish" (outline) and **"Reveal 1"** in solid red (`warn`) (`band_dashboard_events_e1_schedule-m.png`)
  - Booths: green "On the public page" badge, with no publish control in the card
- Why it matters: DESIGN.md §9 says "Going live (Publish, Unpublish, Reveal) is a separate, outlined bar that's always on screen". Only the schedule does that. Organizers have to learn a new place and colour for "open/close" on every page. Solid red on "Reveal" reads as destructive, but it's the happy action.
- Recommendation: Build one `StatusCard` component with props `{status, link, actions, primaryToggle}` and one `PublishBar`. Open, publish, and reveal use primary (navy). Close and unpublish use `danger` outline with a confirm. Put the toggle in the same spot on every setup page, and give Parent Registration its own Reopen button.

**A4-3. Save patterns differ across organizer pages** (Severity 2)
- Where:
  - Event Settings: pinned footer, "All changes saved · Save changes" (`band_dashboard_events_e1_edit-m.png`). The "Logo and color" card *below* it saves separately on upload, so a user can't tell whether "Save changes" covers the logo.
  - Conference Setup: pinned footer "Save meeting times" (`conf_..._conferences-m.png`)
  - Volunteer Setup: a save bar pinned at the **top** of the sign-up card ("What's left: Finish the details · Save for later · Save sign-up"), then a *separate* inline "Save" at the bottom for "Your daily volunteer summary" (`band_dashboard_events_e1_volunteering-m.png`)
  - Account: inline "Save" under the boxes (`band_dashboard_account-m.png`)
  - Team setup: "Send invitation" inline; no save bar
  - Broadcast: inline "Broadcast Message"
- Why it matters: Some of this is allowed by DESIGN.md §9. But save-button labels vary ("Save changes", "Save meeting times", "Save sign-up", "Save", "Save and continue"), and two save buttons on one page (Volunteer Setup) make a user wonder whether one saves the other.
- Recommendation: Every pinned footer uses the same label pattern, "Save {thing}". Content saved separately sits in a visually separate card with its own "Saved" line (logo: "Logo saved"). Move the daily-summary preferences out of Volunteer Setup into Event settings › Email settings, where emails live.

**A4-4. The three public forms ask the same questions with different labels and layouts** (Severity 3)
- Where: `volunteer/signup-form.tsx`, `book/booking-form.tsx`, `parents/parents-form.tsx`

  | | Volunteer | Conference | Visitor day |
  |---|---|---|---|
  | Name label | "Full name" | "Name" | "Your name" |
  | Phone | "Cell phone" (no "optional", hint only) | "Mobile phone (optional)" | "Mobile phone (optional)" |
  | Child | — | "Your child's first and last name" | "Child's name" |
  | Section heads | numbered "1. Pick your shifts / 2. Your details" (text-xl) | unnumbered "Your meeting / Your family" (text-2xl) | "You / Your child" (text-xl) |
  | Submit | "Save and finish" then "Confirm sign-up" | "Book this time" | "Register" |
  | Confirmation card | plain card, h2 text-xl | green success card, h2 text-2xl | green success card, h2 text-2xl |
  | Add to calendar | on-page Google + Apple links | email only | email only |
  | Change/cancel link on page | via /my | yes | no |
  | Privacy panel | none | "Your child's privacy" panel | inline lock note on organizer side only |

- Why it matters: The same parent often does all three in one school year. Every difference is a small re-learning, and the missing pieces (calendar, change link) are real losses.
- Recommendation: Extract a shared `PublicFormShell` (numbered sections, the same heading sizes, one `ContactFields` component with "Your name / Email / Mobile phone (optional)") and a shared `Confirmation` component: a green card, "You're signed up / booked / registered", what/when/where repeated, Add to calendar buttons, and a change/cancel link. Labels: "Sign up", "Book this time", "Register".

**A4-5. Page titles don't match the cards and buttons that open them** (Severity 2; DESIGN.md §10 "A page's title matches the card that links to it")
- Overview "Performance schedule", button "Set up the schedule", lands on the title **"Performance Schedule Setup"**
- Overview "Conference setup", button "Manage conferences", lands on **"Conference Setup"**. "See your meetings" lands on **"Your meetings"**. The setup card's button says **"Meetings list"**.
- Overview "Volunteers", button "Manage volunteers", lands on **"Volunteer Setup"**
- Overview "Parent registration", button **"Parent Registration"** (breaks the "Manage X" pattern of Manage bands / booths / volunteers / conferences), lands on "Parent Registration"
- Overview "Event settings" (sentence case) lands on "Event Settings" (Title Case)
- Recommendation: Use one scheme: overview section "Volunteers", button "Set up volunteers", page title "Volunteer setup". Apply the same pattern to bands, schedule, booths, conferences, and visitors.

**A4-6. Title case and sentence case are mixed in page titles and buttons** (Severity 1)
- "Volunteer Check-in" vs "Parent check-in". "Partner check-in" sits next to "Volunteer Check-in" in the *same* button row (`fair_dashboard_events_e1-m.png`). "Broadcast Messages", "Booths & Partners", "Band Registration", and "Event Settings" are Title Case, while "Your meetings", "Parent check-in", and "Set up your event" (`setup-steps.tsx:45`, which DESIGN.md calls "Set Up Your Event") are not.
- Recommendation: Use sentence case for all titles and buttons (it matches brand-voice's plain tone) and add the rule to brand-voice.md.

**A4-7. Overview layouts differ per event type for the same jobs** (Severity 2)
- Band overview: a horizontally scrolling chip row (Contest day / Bands / Schedule / Volunte…, cut off at 390px) plus a "Contest day" card with progress tiles
- Visitor overview: no chip row; an "Event day" card with "Parent door check-in" (primary), "Volunteer Check-in", "What I lead"
- Fair overview: an "Event day" card with "Volunteer Check-in" (primary), "What I lead", "Partner check-in"
- Conference overview: no event-day section and no chip row
- "Links to share": Visitors' **Parents** row shows "Registration is closed · Open it" with **no Copy link / QR code**, unlike every other row
- Evidence: `band_dashboard_events_e1-m.png`, `visit_…`, `fair_…`, `conf_…`
- Recommendation: Use one overview template: a header, then **Today/Event day** (always first, same name, the primary check-in first), Links to share (every row the same: Copy link, QR code, Open/Close), Setup (cards in the same order with "Set up X" buttons), and To do. Show the jump chips for every type, or none.

**A4-8. Destructive actions are styled three different ways** (Severity 2)
- Team setup "Remove" and "Cancel" are grey ghost text (`band_dashboard_events_e1_team-m.png`). Meetings "Cancel meeting" is a navy underlined link (`conf_…_meetings-m.png`). Volunteer time slots "Delete" are grey text, while "Delete sign-up" is red text. Booths "Delete zone" is a red outline button. Status-card "Unpublish" and "Close volunteer signup" are red outline.
- Why: DESIGN.md §8 "Destructive means red". Cancelling a family's conference in navy link style looks like ordinary navigation.
- Recommendation: Every remove/cancel/delete uses `quiet-danger` (in a row) or `danger` (standalone), always with a confirm that names the person or thing.

**A4-9. Placeholder-as-label search boxes on check-in pages, while Meetings has a real label** (Severity 2)
- Parent check-in "Adult, child, or teacher", Volunteer check-in "Find someone by name or phone", and Parent Registration list "Adult, child, or teacher" are placeholder-only. Your meetings has a visible label "Find a meeting".
- Recommendation: Use one `SearchField` with a visible label ("Find a family", "Find a volunteer").

**A4-10. Export controls are named differently** (Severity 1)
- "Download list" (bands, parents), "Print or copy ▾" (meetings), "Print volunteer badges" (volunteers; no download of the list on that page).
- Recommendation: Use one "Download or print ▾" menu in the same spot (top right of the list) on every list page.

**A4-11. "Directions" vs "Map" for the same link** (Severity 1)
- The public event page says "Directions" (`e/[slug]/page.tsx:179`). The volunteer page and organizer overview say "Map" (`volunteer/page.tsx:108`, `dashboard/events/[eventId]/page.tsx:882`). The "Maps & info" section is about uploaded PDFs, so "Map" is ambiguous on top of that.
- Recommendation: Use "Directions" for the address link everywhere and "Maps & info" for files.

**A4-12. The floating Feedback tab covers content on phones** (Severity 2)
- Where: `src/components/feedback-button.tsx:38` (`fixed right-0 bottom-1/3`)
- What: At 390px it sits over shift counts ("4 left"), booking times ("5:00 PM / 6:40 PM"), and overview text. On the booking page it covers the right-hand column of time buttons, the core control.
- Evidence: `conf_e_cedar-ridge-x7k2_book-m.png`, `pub_e_..._volunteer-m.png`
- Recommendation: On public pages, put Feedback in the footer only. On phones in the dashboard, move it into the ☰ menu.

**A4-13. Duplicate "New event" buttons on the dashboard** (Severity 1)
- `band_dashboard-m.png` shows "New event" under Hosting and again inside the "No upcoming events" empty state, about 300px apart.
- Recommendation: Show the empty-state button only when there are no events at all. Otherwise keep the single header button.

---

## 5. Error prevention

### Working well
- Overlapping shifts are blocked with a plain reason ("Same time as your Concessions shift").
- Full shifts and age-restricted shifts are disabled with "Full" / "Adults only (18+)".
- "Close volunteer signup?" has a confirm (`volunteering/page.tsx:272`).
- Conference "Every week" can't be switched to while families are booked, and the page says why.
- Check-in buttons stay off until the day before, so no one is checked in early.
- The required-field pattern stops empty submits without nagging.

### Findings

**A5-1. Unpublish on Conference Setup sits in the everyday button row, and its confirm doesn't mention existing bookings** (Severity 1)
- Where: `conf_dashboard_events_e1_conferences-m.png`. The red "Unpublish" sits directly under Copy link / Preview page / Meetings list in a wrapping button row.
- What: It does confirm (`conferences/page.tsx:130`: "Unpublish your conference? Your public page will be hidden. You can publish again anytime."). But the confirm doesn't say what happens to the 6 families already booked, which is the thing the organizer will worry about.
- Recommendation: Move Unpublish into the PublishBar pattern (A4-2) and confirm with "Unpublish? Families can't book or see open times until you publish again. Their 6 bookings stay."

**A5-2. The type choice is presented as reversible, but isn't always** (Severity 1)
- "You can change this later, until bands or groups register" sits on the picker for everyone, including PTO parents with no bands. Fine, but the caveat should be specific to the type.

**A5-3. Phone format isn't constrained on public forms** (Severity 1)
- The account page explains "10-digit US number", but volunteer and booking phone fields show no format hint. Check that they use `inputMode="tel"` and `autoComplete="tel"`.
- Recommendation: Use one `PhoneInput` with `type="tel"`, autocomplete, and a light format, shared across all forms.

---

## 6. Recognition rather than recall

### Working well
- Volunteer confirmation repeats each shift, its time, and calendar links.
- Booking confirmation repeats "Thu, Nov 5 · 4:40 PM" and the child's name.
- Setup sub-pages repeat the event date and time zone under the title.
- Setup tabs carry status lines, so the organizer doesn't need to open them.

### Findings

**A6-1. Booking confirmation doesn't repeat where or how to meet** (Severity 2)
- Where: `book/booking-form.tsx:130-147`
- What: It shows the date and time, but not "Room 14, second floor" or "Video: we'll email the link". The parent has to remember what they picked or dig through email on the day.
- Recommendation: Add a "Where" line (room/address with Directions, or "Video: join link in your email and calendar invite").

**A6-2. Visitor-day confirmation omits the date and time** (Severity 2)
- Where: `parents/parents-form.tsx:47-71`
- What: It lists the children and the ID reminder but not *when* or *where* the event is.
- Recommendation: Repeat the date, time, and venue in the shared Confirmation (A4-4).

**A6-3. Volunteer Setup radio options look disabled when they're just locked after creation** (Severity 2)
- Where: `band_dashboard_events_e1_volunteering-m.png`, "What do people sign up for? Time slots / Items to bring" both faded
- What: The user can't tell which one is selected or why both are grey.
- Recommendation: Show the chosen type as plain text ("Time slots · can't be changed once people sign up") instead of faded radios.

---

## 7. Flexibility and efficiency of use

### Working well
- "Save and add another person" lets one parent sign up a whole family (up to 7).
- Copy link, QR code, and Preview page sit on every setup card.
- "Auto create shifts" with "Redo or add shifts"; booth zones with tabs.
- Organizers can sign volunteers up as walk-ups; volunteer tracking works across events.
- Calendar invites go out by email for all three public flows.

### Findings

**A7-1. No "copy last year's event"** (Severity 2)
- Where: dashboard "Past (1)" list
- What: PTOs repeat the same fall festival or conference day every year. Starting from scratch means re-entering every station, shift, and booth.
- Recommendation: "Duplicate" on past events, which copies the settings and structure but not the people.

**A7-2. No message-to-volunteers from the volunteer list** (Severity 2)
- Broadcast lets you target "Volunteers" as a banner (and email for emergencies only). A PTO organizer can't email "everyone on the Concessions shift" the night before without exporting.
- Recommendation: Add "Message this sign-up" on each sign-up, which emails its volunteers and goes through the existing Broadcast plumbing.

---

## 8. Aesthetic and minimalist design

### Working well
- The public booking page is focused, with one task per section.
- The type picker uses big tappable cards with plain descriptions.
- Consistent cards, soft shadows, and one blue. DESIGN.md is visibly followed.

### Findings

**A8-1. The event overview is a very long scroll on phones with no "what to do next" up top** (Severity 3)
- Where: `band_dashboard_events_e1-m.png` (about 2,975px), `visit_…` (about 2,600px)
- What: Event settings, three link rows, the announcement strip, chips, contest day tiles, To do, Band registration with 7 logistics tiles, schedule, and volunteers with needs-people. The desktop shows the setup checklist beside it. On phones that checklist is a bottom bar (per `setup-guide.tsx`), but the **To do** card ("1 invitation has expired") sits mid-page. A new organizer can't tell what's most important.
- Recommendation: On phones, order the page as **Next step** (the checklist's next item or today's check-in), then Links to share, then To do, then sections collapsed to one-line summaries with "Open". Move logistics totals onto the Bands page.

**A8-2. Volunteer Setup crams four jobs onto one screen** (Severity 2)
- Where: `band_dashboard_events_e1_volunteering-m.png` (about 3,800px)
- What: The status card, privacy note, sign-up tabs, a sign-up form with a check-in stop and time slots, the who's-signed-up list, and the daily email digest. That makes three save surfaces.
- Recommendation: Split "Who's signed up" into a "People" tab and move the digest to Email settings, as in A4-3.

**A8-3. Public event page puts host notes and alerts above the call to action** (Severity 2)
- Where: `pub_e_cedar-ridge-x7k2-m.png`, `e/[slug]/page.tsx:200-262`
- What: The volunteer CTA card comes after banners. On a fair it's lifted to the top (`:202-210`), but not for other types.
- Recommendation: For every type, place the "What can I do here?" action cards (Sign up / Register / Book) directly under the title. Banners stay above, but compact.

---

## 9. Help users recognize, diagnose, and recover from errors

### Working well
- Signup errors are specific and constructive ("You have two shifts at the same time (Concessions, 12:00 PM). Untick one to go on.").
- FormMessage uses `role="alert"`, and required fields scroll to the first missing one.
- Email-failure fallbacks are honest ("We couldn't send the confirmation email, but you're registered.").
- `missing()` from schema-check covers the database-update case.

### Findings

**A9-1. No app-level `not-found.tsx` or `error.tsx`; only `global-error.tsx`** (Severity 3)
- Where: `find src -name '*error*' -o -name '*not-found*'` returns only `src/app/global-error.tsx`
- What: A parent with a mistyped or expired link (`/e/wrong-slug`) gets Next's default 404, unbranded with no way forward. Any server error on one page replaces the *whole app*, including the header, with an inline-styled "Something went wrong".
- Recommendation: Add `src/app/not-found.tsx` ("We can't find that page. If someone sent you this link, ask them for a fresh one", plus home and "My sign-ups" links) and segment `error.tsx` files for `/e/[slug]` and `/dashboard` that keep the header and offer "Try again" and support.

**A9-2. "Contact the organizer/school" with no contact shown** (Severity 2)
- Where: `parents/page.tsx:94`, `bands/page.tsx:224`, `bands/guest-actions.ts:70`
- What: A parent told to "contact the school" doesn't know who that is.
- Recommendation: Show the event's reply-to name and email (from Email settings) wherever we tell people to contact the organizer.

---

## 10. Help and documentation

### Working well
- Field hints are thoughtful and placed at the moment of need ("Only your Coordinator sees this, and only on event day").
- The setup checklist and the "Set up your event" wizard give first-run guidance.
- Account and pricing questions point to a real email.
- The marketing pages have FAQ sections.

### Findings

**A10-1. The first-run wizard guides the wrong things for most event types** (Severity 3)
- Where: `setup-steps.tsx:8-14`
- What: The five wizard steps are generic (details, team, email, files, publishing). The type-specific heart of the event (shifts for a volunteer event, time slots for a conference, booths for a fair, registration for a visitor day) isn't a step. The new organizer finishes "setup" and still has a non-working event. Team setup as step 2 asks a solo PTO parent to invite people before they've built anything.
- Recommendation: Make the wizard type-aware: 1) Details, 2) **The core** (Shifts / Meeting times / Booths / Registration form), 3) Preview what parents see, 4) Publish and share link. Team, Email, and Maps become optional "Later" items in the checklist.

**A10-2. No help link in the organizer app** (Severity 2)
- Support appears in Account copy and the Feedback tab, but there's no "Help" or "Questions? Email us" in the header menu or setup pages. brand-voice promises "Self-serve help: short guides and answers for common questions".
- Recommendation: Add "Help" to the ☰ menu and desktop nav, linking to short guides plus `brand.supportEmail`. Add a "How this works" disclosure on each setup page.

**A10-3. Empty states vary in helpfulness** (Severity 1)
- The dashboard empty state is good. Broadcast's "3. Earlier: None yet" and "My volunteering: Nothing coming up here" are fine. Check-in pages before the day show a blue box ("On the day of the event, this shows who's not here yet"), which is good, but parent check-in has no equivalent explainer. Align them in one `EmptyState` component with a title, one sentence, and the next action.

---

## Deliberate trade-offs (not issues)
- **Privacy rules:** volunteer phone numbers are visible only to Coordinators on event day, children's details are deleted after 30 days, and other families can't see who booked. These add explanatory copy but are core values and well explained.
- **No accounts for parents/volunteers:** magic links and device memory instead of passwords. That's right for this audience. A3-2 asks only to extend it to bookings.
- **Check-in locked until the day before:** prevents early check-ins. Keep it, but fix the message state (A1-2).
- **Admin back office styled as a dense CRM with 32px controls:** a documented, deliberate exception (DESIGN.md "Admin").

---

## Severity summary

| Sev | Count | IDs |
|---|---|---|
| 3 | 8 | A1-3, A1-5, A3-1, A4-2, A4-4, A8-1, A9-1, A10-1 |
| 2 | 26 | A1-1, A1-2, A1-4, A1-6, A2-1, A2-2, A2-4, A2-6, A3-2, A3-4, A4-1, A4-3, A4-5, A4-7, A4-8, A4-9, A4-12, A6-1, A6-2, A6-3, A7-1, A7-2, A8-2, A8-3, A9-2, A10-2 |
| 1 | 11 | A2-3, A2-5, A3-3, A4-6, A4-10, A4-11, A4-13, A5-1, A5-2, A5-3, A10-3 |

Root cause for most of the consistency findings: there's no shared **StatusCard**, **PublishBar**, **PublicFormShell/Confirmation**, **ClosedNotice**, **LiveStatus**, or **SearchField** component. Each setup or public page hand-builds these, so they drift. Extracting six components would close about 15 findings at once.

---

## Starting fresh: iconic ideas (bold, structural)

1. **One link, one page per person ("Your pass").** Every parent, volunteer, or visitor gets one personal page per event after they sign up: what they signed up for, when and where, Directions, Add to calendar, change or cancel, live announcements, and on the day a big QR "check-in pass". The confirmation email, reminder, and banners all point there. It replaces `/my`, the booking manage link, and the registration change link with one consistent thing. Check-in then becomes "scan their pass".

2. **"Today" mode that takes over the app on event day.** From the night before, the organizer's home becomes a single full-screen event-day cockpit: who's not here, the next band or slot, one big "Post announcement" button, and check-in tabs. No overview scroll, no setup cards. Setup pages fold away behind "Settings". The DayRail exists; make it *the* screen.

3. **Conversational first event ("Tell us about your event").** Replace the type picker and wizard with three plain questions: "What's happening? When and where? What do you need from people: helpers, bookings, or registrations?" Then build a working draft (stations, shifts, slots) from the answers and open a **live preview of the parent page** with "Looks right? Publish". The organizer edits the thing parents will see, not abstract settings.

4. **One component system for every "Setup" page.** Status card, tabs, pinned save footer, and publish bar become a single `SetupPage` primitive with slots. Every event type composes it. Consistency becomes something the code enforces, not something people have to remember.

5. **Duplicate and season templates.** "Run it again" on any past event, plus starter templates ("Fall Festival: 6 booths, 3 shifts each"; "Conference day: 15-minute slots, 3 to 7 PM"). Most PTO events are annual repeats, so this is the single biggest time-saver for the target organizer.

6. **The share kit as a first-class object.** After publish, show a share sheet: a ready-to-paste text message, an email blurb, a printable flyer with QR (with the school's logo), and a "send to the room parent list" option. For PTO organizers, getting the link *out* is half the job.

7. **Unify the vocabulary and nav around tasks, not features.** For organizers, use three top-level words only: **Events, People, Help**. For the public, use one word: **My sign-ups**. Inside an event, every section goes "Set up X → X is open → Today". Publish a glossary in brand-voice.md (sign-up, booking, registration, check-in, announcement) and lint UI strings against it.

8. **Pocket-sized everything.** Design every organizer screen at 390px first, with one primary action per screen pinned to the thumb zone. Move the Feedback tab and secondary actions into a single bottom "More" sheet. Most PTO organizers run their event from a phone in a gym.
