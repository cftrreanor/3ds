# Heuristic evaluation: Evaluator B (expert users under time pressure)

**Product:** Field Command Events (Next.js + Supabase), repo `/home/user/3ds`
**Perspective:** frequent, expert users who move fast. That means the organizer (Host or Co-host) running several events a season across event types, Volunteer Leads and Coordinators on event day, band directors, and the platform admin at `/admin`. They use a laptop during setup weeks and a phone in a loud stadium on event day.
**Weighting:** I weighted UI consistency and flow across pages and across event types most heavily (heuristic 4). The other nine heuristics are also covered.
**Evidence:** screenshots in `scratchpad/audit/` (`*-d.png` is 1440px, `*-m.png` is 390px), the code under `src/`, and the house standards in `docs/DESIGN.md`, `docs/brand-voice.md` and `CLAUDE.md`.
**Severity scale (NN/g):** 0 not a problem · 1 cosmetic · 2 minor · 3 major · 4 catastrophe.
**Known mock-data artifacts are ignored.** These include dir_dashboard showing "Something went wrong" and the choir pages that only show the event page. Where a number mismatch might be mock data, I say so.

---

## Flow pass (summary of the walk-throughs)

**Organizer season loop: create, set up, publish, event day, after.**
1. *Create:* go to `/dashboard`, click "New event", then the type picker (`band_dashboard_events_new-d.png`). Clear. There is **no "copy last season's event"**, though repeat organizers need it most (F7.1).
2. *Set up:* the event page is a hub. Each area is a card with a "Manage …" or "Set up …" button that opens a setup page, and each setup page has a "← Back to {event}" link. Getting from Volunteer Setup to the Schedule always means going back to the hub first, because setup pages have no event-level navigation between them. A thin `SetupStrip` shows the next checklist step. Each setup page uses a slightly different shell (tabs component, where publish lives, status-badge colour, container width, title wording). An expert has to re-read each page instead of relying on habit (F4.1–F4.9).
3. *Publish:* there are five different publish or open patterns. Event publish is on the event page checklist (`#publish`). Unpublish is in Event Settings → Publishing & more. The schedule uses a pinned PublishBar. Conferences publish from the status card. Band registration is reopened with a green button, and parent registration is reopened by editing a closing time (F4.4).
4. *Event day:* this is the strongest part of the product (DayRail and DayBar, auto-refresh, tap once, tap again to undo). But **three separate sources define "what to open on the day"**, and they disagree. The dashboard's `DAY_SCREEN` sends a family-visitor host to the *registration* setup page and a fair host to the *booth setup* page, not to check-in (F4.2, severity 3).
5. *After:* check-in pages for past events still say "Check-in turns on Mon, Oct 5" and still show "Updates on its own · Updated just now" (F1.3).

**Admin daily loop: Home, Follow-ups, Accounts or Pipeline, record page.** It is tight and CRM-like, with global search, a badge on Pipeline and dense tables. Small issues: filters need an extra "Apply" click, some KPI tiles are links and others are not, and cards say "In stage since Never" (F4.15, F2.4).

---

## 1. Visibility of system status

**Working well**
- **"Last change" / "saved this" lines** (`SavedBy`) on the event page and every setup page tell a busy team who changed what and when, for example "Co-host Pat Kim saved this today at 9:13 PM CDT". Excellent for multi-organizer teams.
- **Live-data labelling:** "Updates on its own · Updated just now" with a green dot (`components/auto-refresh.tsx:75`), and the "2 min ago" value keeps itself current.
- **Pending state on taps:** contest-day buttons switch to "Saving…" and are disabled while pending (`contest-day/controls.tsx:35-51`).
- **Tab status lines:** "✓ Registration settings · Saved" and "Draft, not finished" with a yellow dot show progress at a glance (`band_dashboard_events_e1_bands-d.png`).
- **Pinned save footers** saying "What's left: Finish the details" or "✓ All changes saved" (`band_dashboard_events_e1_edit-d.png`).

**F1.1 · The Team setup status contradicts its own contents**
- **Where:** Event Settings side menu, `edit/page.tsx` and `edit/settings-nav.tsx` (`band_dashboard_events_e1_team-d.png`).
- **Heuristics:** 1, 4.
- **What happens:** the "Team setup" menu item shows an empty circle and "Optional". Inside it, all three role tabs have green ✓ and member counts (1 co-host, 2 Volunteer Leads, 2 Coordinators). The other four sections show green ✓ "Saved", "2 files" or "Live". An organizer scanning for what isn't done will open Team setup for nothing.
- **Recommendation:** derive the menu status from the role tabs. Show ✓ and "3 people" when any member exists, and keep "Optional" only when it is empty. DESIGN.md says sections get "a ✓ in the menu once it has something in it".
- **Severity:** 2.

**F1.2 · The event page and the setup page disagree on counts**
- **Where:** event page card vs. setup page (`band_dashboard_events_e1-d.png` vs `band_dashboard_events_e1_bands-d.png`).
- **Heuristics:** 1.
- **What happens:** the event card says "4 bands registered" while Band Registration says "3 bands registered". The volunteer card says "11 of 19 spots filled", then "Volunteers signed up 412", then "Open spots 8" (19−11 = 8, but 412 cannot fit in 19 spots). This may partly be mock data. Even so, the card mixes *people across all sign-ups* with *spots in shifts* with no label, and experts will distrust the dashboard numbers.
- **Recommendation:** compute both views from one shared selector, for example `lib/setup-facts`. Label the tiles unambiguously, such as "People signed up (all sign-ups)" vs "Shift spots filled". Add a test that the hub and setup counts match.
- **Severity:** 2. It would be 3 if this is real data drift.

**F1.3 · Past events still claim check-in "turns on" a past date and still show live refresh**
- **Where:** `volunteers/desk.tsx:148`, `parents/door.tsx:101`, `booths/check-in/page.tsx:92` (`band_dashboard_events_e1_volunteers-d.png`, `visit_dashboard_events_e1_parents_check-in-m.png`).
- **Heuristics:** 1, 2.
- **What happens:** after the event, the desk says "Check-in and walk-ups turn on Mon, Oct 5, 2026, so no one gets checked in early". The event page says "Contest day is over". `AutoRefresh` keeps polling every 10s on a finished event (`volunteers/page.tsx:126`, `contest-day/page.tsx:130`) and shows "Updates on its own".
- **Recommendation:** give every check-in page three phases: before ("turns on {date}"), during, and after ("This event is over. Check-ins are kept as a record."). Render `AutoRefresh` only during the event window.
- **Severity:** 2.

**F1.4 · The header has no "you are here" state, and pages don't say which event you're in**
- **Where:** `app/dashboard/layout.tsx:36-56`, and every setup page header.
- **Heuristics:** 1, 6.
- **What happens:** the header nav links (My events, Volunteer tracking, Account) never show an active state. The `/my` layout *does* underline the current item (`band_my-d.png`), so this is also a consistency gap. On setup pages the only sign of which event you're in is the small grey "← Back to Cedar Ridge Marching Invitational". An organizer with a band contest and a fair the same month, both named after the school, can edit the wrong event's Volunteer Setup.
- **Recommendation:**
  - Add `aria-current` and an underline to the header links.
  - Put an event context bar on every event sub-page with the event name, type chip, date and a Published/Draft badge (see "Starting fresh" idea 1).
- **Severity:** 2.

**F1.5 · The "Contest day is over" panel shows partial progress with no explanation**
- **Where:** event page and contest-day Overview (`band_dashboard_events_e1_contest-day-d.png`).
- **Heuristics:** 1.
- **What happens:** "Contest day is over" sits above tiles reading Parked 2/4, Check-in 1/4, Warm-up 1/4, Performed 0/4. Did no band perform, or did nobody tap? For post-event review this reads as failure.
- **Recommendation:** after the event, swap the tiles for a summary, for example "4 bands · 0 marked Performed (Gate taps weren't used)".
- **Severity:** 1.

---

## 2. Match between system and the real world

**Working well**
- Domain language is excellent: "Push the schedule back", "Band switch", "Ready position", "Walk-up", "What I lead", "From the organizer".
- Time zones are always explicit ("All times are Central Time", "CDT"). That matters for multi-state contests.
- The contest-day board lists bands in performance order with "#1, #2…", which matches how the day runs.

**F2.1 · One concept goes by many names: "sign-up" / "signup" / "station" / "check-in stop" / "Check-in point"**
- **Where:**
  - `volunteering/page.tsx:226,233,274` ("Signup open", "Signup link", "Close volunteer signup")
  - `page.tsx:727` ("Sign-up open")
  - `lib/contest-day.ts:10` ("Check-in point")
  - Volunteer Setup field "Check-in stop?" with chip "Check-in stop 1 · Parking"
  - Volunteer Check-in column headers "Park / Check / Warm / Gate"
- **Heuristics:** 2, 4.
- **What happens:** within one task (setting up check-in for contest day) the same thing is called a sign-up, a check-in stop, a check-in point and a station. "Signup" and "Sign-up" both appear for the same state on two adjacent pages. brand-voice.md and the rest of the UI use "sign-up".
- **Recommendation:**
  - Make it a single "sign-up" noun with a "check-in stop" kind.
  - Replace "Check-in point" with "Check-in stop".
  - Change every user-facing "Signup" to "Sign-up". Add a lint grep for `\bSignup\b` in JSX strings.
- **Severity:** 2.

**F2.2 · Band identity order flips between pages**
- **Where:** Contest day board (`contest-day/page.tsx`) vs Band Registration list vs director view.
- **Heuristics:** 2, 4.
- **What happens:** the contest-day board leads with the school ("#1 North HS / Northern Lights"). Band Registration, the event-page "Needs people" list and the director page lead with the band name ("Raider Regiment · Cedar Ridge HS"). Broadcast messages and announcements use band names ("Northern Lights now performs at 2:15"). Under pressure, a Lead scanning for "Northern Lights" on the board has to read the second line.
- **Recommendation:** pick one order, band name first with the school muted, as in the registration list. Use a shared `<BandName>` component everywhere.
- **Severity:** 2.

**F2.3 · "Broadcast Message" / "Broadcast Messages" / "announcements" / "Send a message"**
- **Where:**
  - event page buttons (`page.tsx:397`, `page.tsx:529`)
  - page title (`announcements/page.tsx:69`)
  - hub banner "2 live announcements · Manage →" (`page.tsx:909`)
  - DayBar "Send a message" (`lib/event-day-actions.ts:99`)
  - the form's type radio "Announcement"
  - route `/announcements`
- **Heuristics:** 2, 4.
- **What happens:** five labels for one feature. "Announcement" is also one of the *types* inside it, so "2 live announcements" can include an Emergency.
- **Recommendation:** call the feature **"Messages"**. Use "Send a message" as the action, "Live messages" for the banner and "Messages" as the title. Rename the type "Announcement" to "General".
- **Severity:** 2.

**F2.4 · Admin pipeline shows "In stage since Never"**
- **Where:** `/admin/pipeline` (`adm_admin_pipeline-d.png`).
- **Heuristics:** 2.
- **What happens:** "Never" reads as a bug. The card *is* in a stage.
- **Recommendation:** fall back to the request's created date ("In stage since Oct 12") or hide the line.
- **Severity:** 1.

**F2.5 · The phone header's "Volunteers" is easy to read as the event's Volunteers**
- **Where:** `app/dashboard/layout.tsx:44-46` (`*-m.png`).
- **Heuristics:** 2, 4.
- **What happens:** on desktop the link is "Volunteer tracking", a cross-event list of people. On a phone it shortens to "Volunteers", sitting directly above an event page whose section is also called "Volunteers". On event day a Lead tapping "Volunteers" in the header lands on a multi-year tracking list, not check-in.
- **Recommendation:** use "People" or "Tracking" on phones, or move it into the ☰ menu.
- **Severity:** 2.

---

## 3. User control and freedom

**Working well**
- Contest-day taps undo by tapping again, with no dialog (`contest-day/controls.tsx` `DoneButton`). That is the right trade-off for speed.
- Leaving a tab with unsaved changes asks first (`_components/setup-leave.tsx`). The leave guard still respects Cmd/Ctrl-click to open in a new tab (`setup-leave.tsx:142`).
- Every sub-page has a back link to its event.
- Emergency messages stay up until ended, and "End now" is one tap.

**F3.1 · Unpublishing is hidden far from where publishing happens**
- **Where:** publish happens on the event page checklist (`page.tsx:961-1000`, "Ready to publish"). Unpublish lives only in Event Settings → Publishing & more (`edit/page.tsx:467-483`). The code comment at `page.tsx:961` admits "(Unpublishing is in event settings.)".
- **Heuristics:** 3, 4.
- **What happens:** once published, the event page shows only a green "Published" badge with no affordance. An organizer who published by mistake, or needs to pull the page because the date is wrong, has to know to look in Settings → "Publishing & more". The schedule and conference pages put Unpublish right beside the status.
- **Recommendation:** make the event-page status badge a menu ("Published ▾" → View public page · Unpublish…), the same component every setup page uses (see F4.4).
- **Severity:** 2.

**F3.2 · Status cards mix a closed state with no way to reopen**
- **Where:** Parent Registration (`parents/page.tsx:113-160`, `visit_dashboard_events_e1_parents-d.png`).
- **Heuristics:** 3, 4.
- **What happens:** the badge says "Registration closed", but the status card's buttons are Copy link / Preview page / Check-in. Reopening means finding the "Registration settings" tab and changing the closing time (explained at line 157). The event page's share table does have "Registration is closed · Open it". Band Registration has a "Reopen registration" button in the same position.
- **Recommendation:** every status card should carry its state toggle in the same slot: Open / Close / Reopen, Publish / Unpublish. For parents, "Reopen registration" can open a small dialog asking for a new closing time.
- **Severity:** 2.

**F3.3 · Personal settings are buried at the bottom of the shared Volunteer Setup page**
- **Where:** `volunteering/digest-card.tsx`, rendered at the foot of `volunteering/page.tsx` (`band_dashboard_events_e1_volunteering-d.png`, "Your daily volunteer summary").
- **Heuristics:** 3, 8.
- **What happens:** a per-person email preference sits below a long sign-up editor, with its own "Save" button. Co-hosts won't find it, and it is unclear whether it changes everyone's emails.
- **Recommendation:** move it to Event Settings → Email settings ("Your notifications") or to Account. Leave a one-line link here.
- **Severity:** 1.

---

## 4. Consistency and standards (heaviest weight)

**Working well**
- **One header shell and one back-link pattern** ("← Back to {event}") on almost every event sub-page.
- **A shared tab model** (`SetupTabs`) used by Band Registration, Conferences, Parent Registration, Rooms and Team, with the ✓ / yellow dot / status line exactly as DESIGN.md describes.
- **The same "status card" anatomy** on Band Registration, Volunteer Setup, Conference Setup, Parent Registration and Booths: badge + summary, link, Copy link / Preview page, folded QR.
- **The same "Links to share" table** on every event type's hub page.
- **Tokens and buttons are centralised** in `components/ui.tsx`, the admin kit is deliberately separate (DESIGN.md "Admin"), and the 44px vs 32px split is a sensible, documented trade-off.

**F4.1 · The setup-page title, the hub card heading and the hub button never match** (DESIGN.md rule 10: "A page's title matches the card that links to it")

| Hub card heading (`page.tsx`) | Hub button | Page `<h1>` |
|---|---|---|
| Band registration | Manage bands | Band Registration (`bands/page.tsx:135`) |
| Performance schedule | Set up the schedule | Performance Schedule Setup (`schedule/host-schedule.tsx:94`) |
| Volunteers | Manage volunteers | Volunteer Setup (`volunteering/page.tsx:215`) |
| Booths & partners | Manage booths | Booths & Partners (`booths/page.tsx:182`) |
| Conference setup | Manage conferences | Conference Setup (`conferences/page.tsx:93`) |
| Parent registration | Parent Registration | Parent Registration (`parents/page.tsx:91`) |
| Rooms and schedule | Set up rooms & schedule | Rooms & Schedule Setup (`rooms/page.tsx:115`) |
| Contest day | Open contest day | Contest day (`contest-day/page.tsx:128`) |
| (day buttons) | Volunteer Check-in / Parent door check-in / Partner check-in | Volunteer Check-in / Parent check-in / Partner check-in |

- **Heuristics:** 4, 6.
- **What happens:**
  - The case style flips between Title Case `h1`s and sentence-case card headings.
  - The suffix "Setup" appears on some pages and not others.
  - "and" vs "&" varies.
  - The verb varies: "Manage", "Set up", "Open".
  - Event Settings is not titled "Set Up Your Event" / "Edit Event Details" as DESIGN.md §Event settings specifies (`edit/page.tsx:288`), so the doc and the code have drifted.
- **Recommendation:**
  - Define each area once in a single `AREAS` map in `lib/` with `{ title, verb, href, icon }`, and use it for the hub card, the button ("Open {title}" or "Set up {title}"), the `h1`, the `<title>`, the setup checklist and the DayBar.
  - Pick one case rule. Sentence case for titles fits brand-voice.
  - Update DESIGN.md or the code so they agree.
- **Severity:** 3. It is the root cause behind several other findings and costs experts recognition every time.

**F4.2 · Three disagreeing definitions of "the event-day screen"**
- **Where:**
  - (a) `app/dashboard/page.tsx:76-83` `DAY_SCREEN`
  - (b) `lib/event-day-actions.ts:73-100` `loadDayActions`
  - (c) the event page's day buttons, `page.tsx:521-533`
- **Heuristics:** 4, 1, 5.
- **What happens:**
  - On the day, the dashboard card's "Today · Open door check-in →" for a family visitor day links to `/parents`, the *registration setup* page. The DayBar and event page link to `/parents/check-in`.
  - For a fair, "Open booth check-in" links to `/booths` (setup), not `/booths/check-in`.
  - Labels for the same destination differ across the three sources:
    - "Open door check-in" vs "Check in parents" vs "Parent door check-in"
    - "Open volunteer check-in" vs "Check in volunteers" vs "Volunteer Check-in"
  - A host tapping the most prominent button on event morning lands on a settings page and has to find check-in from there.
- **Recommendation:** make `loadDayActions` the single source and have the dashboard card use its first action. Fix the two paths now (`school_visit: "parents/check-in"`, `fair: "booths/check-in"`).
- **Severity:** 3.

**F4.3 · Event-day hubs exist for only two of six event types**
- **Where:**
  - band contest → `/contest-day` (a board with tabs per stop)
  - group/choir → `/event-day`
  - family visitor day, fair and volunteer event → no hub, only separate check-in pages (`/parents/check-in`, `/booths/check-in`, `/volunteers`)
  - conferences → `/conferences/meetings`
  - `lib/event-types.ts:126` `dayLabel` returns "Contest day" or "Event day" only
- **Heuristics:** 4.
- **What happens:**
  - The event page's "Event day" card for a visitor day or fair is a row of up to five equal buttons (`visit_dashboard_events_e1-d.png`: Parent door check-in, Volunteer Check-in, What I lead, plus Broadcast Message when relevant). A band contest instead gets a progress panel with tiles.
  - Experts who run a contest and a fair learn two different event-day mental models.
  - "What I lead" for a fair Lead goes to `/contest-day` (`page.tsx:528`), a route named for band contests.
- **Recommendation:** one `/day` route for every type, with an Overview tab (tiles: people here, volunteers here, booths arrived and so on) plus one tab per check-in job, reusing the contest-day shell. Keep the old paths as redirects.
- **Severity:** 3.

**F4.4 · Five different patterns for going live or closing, with different colours**
- **Where:**
  - Schedule: `PublishBar`, pinned, neutral "Unpublish" and solid red "Reveal 1" (`schedule/host-schedule.tsx`, `bands/schedule-builder.tsx:857-875`, `band_dashboard_events_e1_schedule-d.png`)
  - Rooms: `PublishBar`
  - Conferences: in the status card, red-outline "Unpublish" (`conferences/page.tsx:129-132`)
  - Volunteer Setup: red-outline "Close volunteer signup" in the status card (`volunteering/page.tsx:274`)
  - Band Registration: **green solid** "Reopen registration" (`bands/reopen-registration.tsx:26`, `variant="go"`)
  - Parent Registration: no button (F3.2)
  - Event: publish in the checklist, unpublish in Settings (F3.1)
- **Heuristics:** 4, 5.
- **What happens:**
  - DESIGN.md §Setup pages rule 9 says going live is "a separate, outlined bar that's always on screen". Only 2 of 7 setup pages follow it.
  - `ui.tsx:15-27` has 8 button variants, including `go` (solid green) and `warn` (solid red), that DESIGN.md never mentions ("one deep blue for actions").
  - "Reveal" (non-destructive, but irreversible-ish) in solid red reads as "danger/delete". Red-outline "Close sign-up" reads as delete too. The same "Unpublish" action is red on one page and neutral on another.
- **Recommendation:**
  - Adopt `PublishBar` + `PublishLine` on every setup page (Band registration, Volunteer sign-up, Conference booking, Parent registration, Booths on public page).
  - Use a fixed colour grammar: primary blue = turn on or publish, neutral outline = turn off or unpublish, red only for delete.
  - Remove `go` and `warn` or document them in DESIGN.md.
- **Severity:** 3.

**F4.5 · The same state gets a different badge colour on different pages**
- **Where:** `ui.tsx:93-117` `Badge`, used by:
  - "Registration open" → `live`, solid green (`bands/page.tsx:143`, `parents/page.tsx:115`)
  - "Signup open" → `brand`, solid navy (`volunteering/page.tsx:225`)
  - "Sign-up open" → success-soft (event page, `page.tsx:727`)
  - "On the public page" → `live` (`booths/page.tsx:205`)
  - "Registration closed" → `off`, **solid red** for host (`bands/page.tsx:143`) but neutral for director (`dashboard/bands/[bandId]/page.tsx:383`, `dir_…-d.png`)
- **Heuristics:** 4, 1.
- **What happens:** DESIGN.md: "`danger`: Late, blocked, failed, destructive". Registration closing after its deadline is the *planned, normal* state, yet it shouts red on the host's page. That trains organizers to ignore red, which is dangerous on event day when red really means "late band".
- **Recommendation:** add a `StatusBadge` taking a semantic state (`open | closed | draft | live | scheduled | over`) with a single colour map. Closed is neutral. Live or open is green.
- **Severity:** 2.

**F4.6 · Three (really five) tab implementations**
- **Where:**
  - `_components/setup-tabs.tsx` (`SetupTabs`)
  - `volunteering/station-steps.tsx` (`StationTabs`)
  - `booths/zone-tabs.tsx`
  - contest-day station tabs (`contest-day/page.tsx`)
  - Volunteer Check-in tabs (`volunteers/desk.tsx`)
  - plus the Event Settings side menu (`edit/settings-nav.tsx`) and the numbered `SetupStep` accordions used only on Broadcast Messages (`announcements/page.tsx:81-132`)
- **Heuristics:** 4.
- **What happens:**
  - The tab anatomy differs: ✓ vs yellow dot vs plain, "+ Add sign-up" / "+ Add zone" placement, whether the tab bar scrolls on a phone, and whether each tab has a pinned save footer.
  - Booths save per booth through an "Edit" button. Volunteer Setup uses a pinned footer with "Save for later". Conferences use a footer with "Save meeting times".
  - Broadcast Messages uses "1. 2. 3." numbered steps, though "Showing now" and "Earlier" are not steps in a sequence.
- **Recommendation:**
  - Fold `StationTabs` and `ZoneTabs` into `SetupTabs`, with an `add` slot and `status` props.
  - Make Broadcast Messages a plain page: compose form, then a "Live now" list, then a collapsed "Earlier". Drop the numbering.
  - Keep `SetupStep` only where order matters.
- **Severity:** 2.

**F4.7 · Container widths jump between sibling pages**
- **Where:**
  - `conferences/page.tsx:89` `max-w-3xl`
  - `parents/check-in`, `booths/check-in` and `conferences/meetings` `max-w-3xl`
  - `edit/page.tsx:280` `max-w-5xl`
  - most others inherit the layout `max-w-5xl` (`dashboard/layout.tsx:59`)
  - `meetings/summary` `max-w-4xl`
- **Heuristics:** 4.
- **What happens:** going from the hub to Conference Setup, the whole column shifts about 100px (`conf_dashboard_events_e1_conferences-d.png` vs `conf_…_e1-d.png`). Check-in pages are narrower than Volunteer Check-in. This is small, but it breaks the sense of one app.
- **Recommendation:** one `EventPage` shell with a `width="form" | "wide"` prop. Use it for all event sub-pages.
- **Severity:** 1.

**F4.8 · Back-link wording varies**
- **Where:**
  - "← All events" (event page, new event)
  - "← Back to {event}" (sub-pages)
  - "← Dashboard" (director band page, `dashboard/bands/[bandId]/page.tsx:245`)
  - "← Back to Volunteer Setup" (badges)
  - "← Back to Your meetings" (summary)
  - the header link itself says "My events"
- **Heuristics:** 4.
- **What happens:** the same destination (`/dashboard`) has three names: "All events", "Dashboard" and "My events".
- **Recommendation:** use "← My events" everywhere it goes to `/dashboard`, and "← {parent page title}" otherwise. Build it as a `BackLink` component.
- **Severity:** 1.

**F4.9 · Hub-page anatomy differs by event type**
- **Where:** `page.tsx` order and `navLinks` (`page.tsx:918`, which shows the jump pills only when `navLinks.length >= 4`).
- **Heuristics:** 4.
- **What happens:**
  - The band contest hub gets a pill nav (Contest day · Bands · Schedule · Volunteers). Visitor-day, fair and conference hubs do not, even though the visitor hub is just as long (`visit_dashboard_events_e1-d.png`).
  - Conference hubs have no day section at all, though conference day is when "Your meetings" is used most. "See your meetings" sits as an equal outline button beside "Manage conferences".
  - The links-to-share label varies: "Spectators" for a contest and "Everyone" for the others, with different sub-labels.
- **Recommendation:** always render the jump nav when there are three or more sections. Give conferences a "Conference day" section with "Run today's meetings". Standardise the first share row as "Public page" with a type-specific hint.
- **Severity:** 2.

**F4.10 · Destructive-action styling is inconsistent**
- **Where:**
  - Team setup "Remove" and invite "Cancel" are grey text (`band_…_team-d.png`)
  - time slot "Delete" is grey text (`band_…_volunteering-d.png`)
  - "Delete sign-up" is red text
  - "Delete zone" is red outline (`fair_…_booths-d.png`)
  - "Cancel meeting" is a grey underlined link (`conf_…_meetings-d.png`)
- **Heuristics:** 4, 5.
- **What happens:** DESIGN.md rule 8: "Destructive means red, and honest… say exactly what they do". "Remove" and "Delete" in grey look like secondary links. The labels are also vague ("Remove" rather than "Remove co-host"; the confirm dialog says more but the button doesn't).
- **Recommendation:** use `variant="quiet-danger"` (red text) for in-row destructive actions and `danger` (red outline) for section-level ones. Name the object in the label: "Remove Pat", "Delete time slot", "Cancel Ava's meeting".
- **Severity:** 2.

**F4.11 · Button label case is mixed on the same card**
- **Where:**
  - `page.tsx:527` "Volunteer Check-in" next to "Parent door check-in" and "Partner check-in"
  - "Broadcast Message" next to "Open contest day"
  - "Parent Registration" button next to "Check-in" (`visit_dashboard_events_e1-d.png`)
- **Heuristics:** 4.
- **What happens:** brand-voice.md implies sentence case for buttons, and most buttons follow it. Title Case appears where a button reuses a page title.
- **Recommendation:** use sentence case for every button and fix the page titles at the same time (F4.1).
- **Severity:** 1.

**F4.12 · Account-wide things live inside one event's settings**
- **Where:**
  - Event Settings → Team setup (`edit?section=team`, `band_…_team-d.png`). Its copy says "Hosts and co-hosts have full access to **all of your organization's events**".
  - "Logo and color: One logo for your account…" (`edit/page.tsx:334-351`)
  - Plan details live in Account (`band_dashboard_account-d.png`).
- **Heuristics:** 4, 2, 6.
- **What happens:**
  - Organizers must open *some* event's settings to change org-wide co-hosts or the logo. With five events a season, which event holds that setting is unclear, and changing the logo "in" one event silently changes them all.
  - Volunteer Leads and Coordinators (per-event) and Co-hosts (org-wide) sit side by side as peer tabs, even though they have different scopes.
- **Recommendation:** create an **Organization** page (header: "Organization": name, logo and colour, Co-hosts, plan, Volunteer tracking). Keep only per-event roles (Volunteer Leads, Coordinators) in Event Settings → Team.
- **Severity:** 2.

**F4.13 · Two headers for logged-in people**
- **Where:** `/dashboard` layout (`app/dashboard/layout.tsx`) vs the `/my` header (`band_my-d.png`: "My events · My volunteering", with active underline and no Account or Sign out).
- **Heuristics:** 4.
- **What happens:**
  - An organizer who also volunteers moves between two header sets. The "Volunteer tracking" and "Account" links disappear on `/my`.
  - On desktop the dashboard header shows "My volunteering" only when there are upcoming shifts, so the nav changes shape over time.
- **Recommendation:** one signed-in header everywhere, with a stable set of items (hide by role, never by data). Include the active state.
- **Severity:** 2.

**F4.14 · The event-day jobs bar appears only on calendar event days**
- **Where:** `lib/event-day-actions.ts:31` (`if (today < starts_on || today > ends_on) return null`).
- **Heuristics:** 4, 7.
- **What happens:** the DayBar and DayRail, the best expert affordance in the app, vanish for evening-before setup, load-in and the morning-after cleanup or teardown. They also vanish when an organizer opens the event during rehearsal the week before to practise. So the navigation model of a given page changes depending on the date.
- **Recommendation:**
  - Show the DayBar from the day before through the day after, marked "Tomorrow" or "Yesterday".
  - Also add a persistent "Event day" entry to the event context bar (idea 1) so it is always reachable.
- **Severity:** 2.

**F4.15 · Small inconsistencies in the admin CRM**
- **Where:**
  - `/admin` KPI row: Accounts, At risk, Follow-ups and Pipeline have "→" and are links. "Events, next 14 days" and "Emails not sent" are not (`adm_admin-d.png`).
  - The Accounts filters need "Apply" (`adm_admin_accounts-d.png`), while the global search does not.
  - Home lists Cedar Ridge's event "Sat, Oct 17" in the next two weeks, but Accounts shows "Next event —" for the same account (may be mock data).
- **Heuristics:** 4, 7, 1.
- **Recommendation:** make every KPI tile a link to its filtered list. Apply filters on change. Compute "Next event" from the same query as the Home panel.
- **Severity:** 1.

---

## 5. Error prevention

**Working well**
- Confirmation dialogs with honest consequences: "Reveal 1 finalist? Their names will show on the public schedule…", "Remove this co-host? They'll lose access to all of your organization's events.", and zone deletion that offers to move booths (`booths/booth-form.tsx:317-390`). There are 34 files using `confirmDialog` or `confirmMessage`.
- Check-in buttons are locked until the day before, "so no one gets checked in early".
- "Adults only (18+)" blocks minors from walk-ups (`volunteers/desk.tsx:377`).
- Required fields are faded until filled, with no red-on-type (DESIGN.md §Required answers).
- "Save or cancel your changes first, then publish" (conference-forms `PublishButton`).

**F5.1 · Status colours weaken real alarms**
- **Where:** as F4.5 and F4.4.
- **Heuristics:** 5.
- **What happens:**
  - Solid red appears on routine states: "Registration closed", "Reveal 1", red-outline "Close volunteer signup" and "Unpublish".
  - Red also marks "Emergency" banners, "Late" bands, and the "2 live announcements" strip (`page.tsx:903`, red when *any* emergency exists but also styled red-ish in the screenshot).
  - On a loud field the organizer needs red to mean "act now".
- **Recommendation:** reserve danger red for (a) Late / Emergency and (b) Delete. See F4.5.
- **Severity:** 2.

**F5.2 · Volunteer Setup shows "Draft, not finished" on sign-ups that already have people**
- **Where:** `volunteering/station-steps.tsx:111-118` (`band_dashboard_events_e1_volunteering-d.png`: every tab shows a yellow dot and "Draft, not finished", yet sign-up is open and 6 people are signed up, 2 arrived).
- **Heuristics:** 5, 1.
- **What happens:** an expert will "finish" a sign-up that is already live, possibly changing times people booked. Or they will distrust the dots altogether. This may be partly mock data, but the logic should never say "draft" for something with live sign-ups.
- **Recommendation:** use three states: Draft (no one can sign up), Live (n signed up), Needs attention (missing a time slot, for example). Warn on time edits when people are booked ("6 people are signed up for this time").
- **Severity:** 2.

**F5.3 · Same-name events across types are easy to confuse**
- **Where:** fair hub `fair_dashboard_events_e1-d.png`, titled "Cedar Ridge Marching Invitational" with the fair type, and the band hub with the same name.
- **Heuristics:** 5.
- **What happens:** even with sample data, nothing beyond the small type chip distinguishes the two hubs. There are no type icon, colour or accent per event type on sub-pages.
- **Recommendation:** show the event type emoji or icon (already in `EVENT_TYPES`) beside the event name in the context bar on every sub-page and in the tab `<title>`.
- **Severity:** 1.

---

## 6. Recognition rather than recall

**Working well**
- The setup checklist (`SetupGuide`) beside the hub, plus the `SetupStrip` on sub-pages, shows the next step without the organizer remembering it.
- "You lead Bus & Equipment Parking, Warm-Up, Concessions" reminds a Lead what is theirs.
- Every setup page repeats the event date and time zone.

**F6.1 · Setup pages have no event-level navigation (hub and spokes only)**
- **Where:** every event sub-page header (the `← Back to {event}` link alone). The event layout `app/dashboard/events/[eventId]/layout.tsx` adds only SetupStrip or DayBar.
- **Heuristics:** 6, 7.
- **What happens:**
  - Moving from Band Registration to the Schedule takes two clicks plus a scroll on the hub. Over a setup week of constant hopping this adds up.
  - On a phone, the long hub (`band_dashboard_events_e1-m.png` is about 2,975px tall) has to be scrolled every time.
  - Experts must remember which hub section holds which page.
- **Recommendation:** a persistent event sub-nav:
  - desktop: a left rail or tab row with Overview · Registration · Schedule · Volunteers · Messages · Settings · Day
  - phone: a horizontal scroll tab row under the header
  - It should be built from the same `AREAS` map (F4.1) and filtered by event type and role.
- **Severity:** 3.

**F6.2 · "What I lead" and station pages don't name the event**
- **Where:** Lead flows into `/contest-day?station=…`.
- **Heuristics:** 6.
- **What happens:** a Volunteer Lead who leads stations at two events (same weekend, same school) sees only the station name. See F1.4.
- **Recommendation:** add the context bar (idea 1).
- **Severity:** 1.

---

## 7. Flexibility and efficiency of use

**Working well**
- **DayBar / DayRail** (`components/event-day-nav.tsx`): role-aware, deep-linked "jobs of the day", and on a phone a bottom tab bar with "More". It scrolls to and opens folded targets (`openTarget`). Outstanding.
- Dashboard "Today · Open contest day →" on the card itself.
- Search on Volunteer Check-in, Parent check-in and Meetings. Classification filter chips on bands and status filter chips on the contest-day board (Behind / Due soon / Not here yet).
- Spreadsheet import for volunteers, Download list, print badges, "Print or copy" meetings.
- Admin global search, sortable tables, and the pipeline card stage select plus drag.

**F7.1 · No "copy an event" for repeat organizers**
- **Where:** `dashboard/events/new` only offers the type picker. A grep for duplicate or clone finds nothing for events.
- **Heuristics:** 7.
- **What happens:** organizers run the same contest every October and the same conferences every semester. Today they re-enter stations, shifts, check-in stops, breaks, booth zones, documents, email settings and Volunteer Leads by hand.
- **Recommendation:** add "New event → Start from a past event", which copies settings, sign-ups (shift times shifted to the new date), zones, rooms, breaks, documents and team invites but no people. Also put "Copy this event" in the Publishing & more section.
- **Severity:** 3.

**F7.2 · No search, jump-to or keyboard accelerators in the customer app**
- **Where:** the app-wide header. A grep shows no Cmd-K or shortcut handlers (only Escape and the QA tool).
- **Heuristics:** 7.
- **What happens:**
  - Admins have global search. Organizers have none. Finding "the band whose director called" means opening Band Registration and scanning, with no search box there either (only class chips, `band_…_bands-d.png`).
  - Parents and Meetings do have search, so it is also inconsistent.
- **Recommendation:**
  - A command palette (Cmd/Ctrl-K, plus a search icon on phones) over events, bands, volunteers, families, pages and actions ("Push schedule back", "Send a message").
  - At minimum, add a search box to Band Registration and Volunteer Setup's "Who's signed up".
- **Severity:** 2.

**F7.3 · The dashboard puts the empty state above the work**
- **Where:** `/dashboard` (`band_dashboard-d.png`).
- **Heuristics:** 7, 8.
- **What happens:**
  - With no upcoming hosted events, a large "No upcoming events" card with a second "New event" button pushes the "Competing" content down.
  - "Past (1)" is collapsed, though after an event the organizer's main job is the post-event wrap-up.
  - Draft cards show only "Next: finish setup and publish", with no progress (for example "3 of 6 steps").
- **Recommendation:** make the empty state a single compact line. Show the most recent past event expanded for 14 days after it ends, with "Download volunteer hours" and "Copy for next year". Show checklist progress on draft cards (`setupChecklist` already computes `progress.label`).
- **Severity:** 2.

**F7.4 · No bulk actions on rows**
- **Where:** Team pending invites (single "Send"), Volunteer Setup time slots, contest-day board.
- **Heuristics:** 7.
- **What happens:** the To-do says "1 invitation has expired. Resend them from Team setup." Resending means navigating there and tapping each one. There is no "Resend all expired", no multi-select to message one shift's volunteers, and no "Mark all here" for a bus that arrives with 5 volunteers.
- **Recommendation:** make the To-do items actionable in place ("Resend" button inline). Add "Message this shift" on each time slot and multi-select check-in.
- **Severity:** 2.

---

## 8. Aesthetic and minimalist design

**Working well**
- A calm, consistent visual system. One blue, warm surfaces, generous spacing and tabular numbers.
- The contest-day board is dense yet scannable: four check columns, filter chips and a folded "How this works".
- The admin CRM is appropriately denser, as a deliberate trade-off (DESIGN.md §Admin).

**F8.1 · The hub page is long and equal-weight on phones**
- **Where:** `band_dashboard_events_e1-m.png`.
- **Heuristics:** 8.
- **What happens:**
  - On a phone the key day status sits under about 900px of header, meta, last change, a three-row share table and a live-messages strip.
  - Logistics tiles (Students 670, Box trucks 4, Semi trucks 0…) take a full screen on event morning, though they are a setup-week concern.
  - "Event settings" is a full-width outline button above everything.
- **Recommendation:** make the hub phase-aware:
  - *setup weeks:* checklist, then areas
  - *event day:* day tiles and messages first, with share links and logistics folded
  - *after:* wrap-up
  - Collapse "Links to share" into a "Share ▾" button on phones.
- **Severity:** 2.

**F8.2 · The repeated privacy and help paragraphs crowd setup pages**
- **Where:**
  - Volunteer Setup lead paragraph ("🔒 Volunteers' phone numbers… deleted 10 days…")
  - Announcements: the explanation is repeated twice (intro and under "Stays up for")
  - Booths: the status-card paragraph repeats the section intro
- **Heuristics:** 8.
- **What happens:** experts read these once. After that they push the working controls down.
- **Recommendation:** fold them into a single "ⓘ" line or a `details` element per page, and remember the collapse per user.
- **Severity:** 1.

**F8.3 · The Feedback tab overlaps content on phones**
- **Where:** the fixed right-edge "Feedback" tab (`components/feedback-button.tsx`), as seen in `band_dashboard_events_e1_contest-day-m.png` (covers the "2. Check-in" tab label) and `visit_…_check-in-m.png` (covers the right side of the list).
- **Heuristics:** 8, 4.
- **What happens:** on event day it sits over tap targets in the busiest screens.
- **Recommendation:** hide it on event-day and check-in routes, or move it into the ☰ menu on phones.
- **Severity:** 2.

---

## 9. Help users recognize, diagnose, and recover from errors

**Working well**
- Contest-day taps catch network failures with "That didn't go through. Check your signal and tap again." (`contest-day/controls.tsx:46`). This is exactly right for a stadium.
- `FormMessage` errors use `role="alert"` and focus. Required fields get a summary line and jump to the first one.
- `missing()` explains "a database update is needed" rather than a 404 (`CLAUDE.md`).

**F9.1 · No route-level error or loading boundaries**
- **Where:** `src/app/` has only `global-error.tsx`. There is no `error.tsx` or `loading.tsx` in any route.
- **Heuristics:** 9, 1.
- **What happens:**
  - Any server error on one event sub-page replaces the whole app, including the header and DayBar, with the plain "Something went wrong" page (as in `dir_dashboard-*.png`).
  - On a weak stadium connection, navigating between server-rendered pages shows no skeleton, so the old page stays put and the user taps again.
- **Recommendation:**
  - Add `app/dashboard/events/[eventId]/error.tsx`, which keeps the header and DayBar and offers "Try again" and "Back to {event}".
  - Add `loading.tsx` skeletons for the hub, contest-day and check-in pages.
- **Severity:** 3 on event day.

**F9.2 · Check-in pages don't handle offline**
- **Where:** `volunteers/desk.tsx`, `parents/door.tsx`, `booths/check-in`. There are no `navigator.onLine` or offline cues anywhere.
- **Heuristics:** 9.
- **What happens:**
  - Auto-refresh says "Updated just now" right up until it silently fails, and there is no stale marker if fetches fail.
  - Taps fail one by one with no queue.
- **Recommendation:**
  - Turn the AutoRefresh status amber ("Offline · last updated 4 min ago") when a refresh fails.
  - Queue taps locally and sync them, showing "3 waiting to send".
- **Severity:** 2.

---

## 10. Help and documentation

**Working well**
- Inline hints are consistently good:
  - "Bands not fully parked by then are flagged Late, so you have time to adjust the schedule."
  - "A check-in stop always takes time slots."
  - "How this works" folded at the foot of contest-day.
- Empty states explain the next step: "On the day of the event, this shows who's not here yet…".
- The support email comes from `brand.supportEmail` (global-error) and Account.

**F10.1 · No central help or "what's new" for experts, and the help email is hard-coded in several places**
- **Where:**
  - Account page and dashboard banner: "product@fieldcommandevents.com" repeated three times on Account (`band_dashboard_account-d.png`)
  - the free-period banner on `/dashboard`
- **Heuristics:** 10.
- **What happens:**
  - Help is only inline. An expert looking up "how do finals reveals work?" has no searchable place to go.
  - Changes between seasons (renamed pages, moved settings) are never announced.
- **Recommendation:**
  - Add a "Help" item in the header that opens a searchable panel built from the existing "How this works" blocks.
  - Add a short "What's new" since the user's last event.
  - Use one support link component sourced from `src/lib/brand.ts`.
- **Severity:** 1.

---

## Summary table

| # | Finding | Heuristic | Sev |
|---|---|---|---|
| F4.1 | Titles, hub cards and buttons never match; case and suffix vary | 4, 6 | 3 |
| F4.2 | Three disagreeing event-day sources; dashboard links visitor day and fair to setup pages | 4, 1, 5 | 3 |
| F4.3 | Event-day hub exists for only 2 of 6 types | 4 | 3 |
| F4.4 | Five go-live patterns, green and red buttons, PublishBar on only 2 pages | 4, 5 | 3 |
| F6.1 | No event sub-nav; hub and spokes only | 6, 7 | 3 |
| F7.1 | No copy-event for repeat organizers | 7 | 3 |
| F9.1 | No route `error.tsx` / `loading.tsx` | 9, 1 | 3 |
| F1.1 | Team setup shows "Optional" while full | 1, 4 | 2 |
| F1.2 | Hub vs setup page counts disagree | 1 | 2 |
| F1.3 | Past events: "turns on {past date}", live refresh | 1, 2 | 2 |
| F1.4 | No active nav, weak event context on sub-pages | 1, 6 | 2 |
| F2.1 | sign-up/signup/station/stop/point naming | 2, 4 | 2 |
| F2.2 | Band vs school name order flips | 2, 4 | 2 |
| F2.3 | Broadcast/announcement/message naming | 2, 4 | 2 |
| F2.5 | Phone header "Volunteers" ambiguity | 2, 4 | 2 |
| F3.1 | Unpublish hidden in settings | 3, 4 | 2 |
| F3.2 | Parent registration: closed, no reopen action | 3, 4 | 2 |
| F4.5 | Same state, different badge colours; closed = red | 4, 1 | 2 |
| F4.6 | 5+ tab implementations; numbered steps misused | 4 | 2 |
| F4.9 | Hub anatomy differs by type (jump nav, day section) | 4 | 2 |
| F4.10 | Destructive styling inconsistent | 4, 5 | 2 |
| F4.12 | Org-wide team and logo inside event settings | 4, 2, 6 | 2 |
| F4.13 | Two signed-in headers | 4 | 2 |
| F4.14 | DayBar only on calendar days | 4, 7 | 2 |
| F5.1 | Red overused, weakening real alarms | 5 | 2 |
| F5.2 | "Draft, not finished" on live sign-ups | 5, 1 | 2 |
| F7.2 | No search or command palette in customer app | 7 | 2 |
| F7.3 | Dashboard empty state above work; no draft progress | 7, 8 | 2 |
| F7.4 | No bulk or inline actions | 7 | 2 |
| F8.1 | Hub not phase-aware; long on phones | 8 | 2 |
| F8.3 | Feedback tab overlaps event-day UI on phones | 8, 4 | 2 |
| F9.2 | No offline or stale handling on check-in | 9 | 2 |
| F1.5 | "Day is over" with ambiguous partial tiles | 1 | 1 |
| F2.4 | "In stage since Never" | 2 | 1 |
| F3.3 | Personal digest prefs on shared setup page | 3, 8 | 1 |
| F4.7 | Container widths jump | 4 | 1 |
| F4.8 | Back-link wording varies | 4 | 1 |
| F4.11 | Button case mixed | 4 | 1 |
| F4.15 | Admin KPI tiles, filters, Next event | 4, 7, 1 | 1 |
| F5.3 | Same-name events across types | 5 | 1 |
| F6.2 | Lead station pages lack event name | 6 | 1 |
| F8.2 | Repeated help and privacy paragraphs | 8 | 1 |
| F10.1 | No central help or what's new; email repeated | 10 | 1 |

**Total: 43 findings.** Seven are severity 3, twenty-five are severity 2 and eleven are severity 1. None is a 4.

---

## Starting fresh: iconic ideas (bold, structural; not incremental fixes)

1. **The Event Shell: one frame for every event, every type.**
   - Every event page lives inside a persistent shell. The top row is a context bar (type icon, event name, date, a Draft / Live / Today / Over pill and a "Share ▾" menu).
   - Beneath it is one tab row generated from a single `AREAS` registry: **Overview · Sign-ups (Bands / Families / Booths / Bookings) · Schedule · Volunteers · Messages · Day · Settings**. Event types only switch tabs on or off and rename the noun.
   - Titles, buttons, checklist steps, DayBar jobs and the dashboard's "Today" button all read from the same registry, so they can never drift again (fixes F4.1, F4.2, F4.3, F6.1, F1.4).

2. **Phase-aware everything: Plan → Live → Wrap-up.**
   - The event shell has an explicit phase switch that the date drives and the organizer can override.
   - *Plan* shows the checklist and setup tabs.
   - *Live* turns the whole event into a dark, high-contrast, big-target "stadium mode" with a bottom tab bar, today's jobs, messages first, offline queueing and Feedback hidden.
   - *Wrap-up* shows thank-you emails, volunteer hours export, a "what went late" report and **"Copy for next year"**.
   - Same data, three layouts, chosen for the moment rather than by the calendar alone.

3. **A command palette (Cmd/Ctrl-K, plus long-press on the logo on phones).**
   - It jumps to any event, band, family, volunteer or page.
   - It runs actions: "push schedule 10 min", "message all directors", "check in Ana Lopez", "reveal finalists".
   - It is scoped to the current event by default and global with Tab. This is the single biggest speed-up for experts, and the admin CRM already proves the search back end.

4. **A single "go-live" grammar across the product.**
   - Each publishable thing (event page, registration, sign-up, schedule round, finalists, booking page) gets the same `PublishLine` in one always-visible Publish tray. Each line shows a dot, its state, its scope (who can see it) and one toggle.
   - Colour rules: blue = make live, neutral = take down, red = delete only.
   - An organizer learns it once and uses it on every type.

5. **Seasons and templates as first-class objects.**
   - "Fall 2027" groups the contest, the fair and the conferences.
   - "Start from last season" clones the whole season's structure, with stations, shifts, zones, rooms, breaks, documents and Volunteer Leads, all shifted to new dates.
   - Volunteer tracking becomes the season's people view ("Who helped at 3+ events?").

6. **Organization as a place, not a setting.**
   - A top-level Organization area (logo and colour, co-hosts, plan, volunteer history, email defaults, saved templates).
   - Events inherit from it, and each event's Settings shows only per-event overrides, with a clear "inherits from Organization" label.

7. **A live operations timeline as the Day overview.**
   - For every type, the Day overview is a horizontal "now line" timeline: performances, rooms, meetings or shifts on the axis, late items glowing, and messages pinned at the moment they were sent.
   - Leads see their lane, and the organizer sees all lanes. One visual makes contests, festivals, conferences and fairs feel like one product.

8. **A role-shaped home.**
   - On login the dashboard answers "what do I need to do next?" across all roles: "Tonight: 2 expired invites · Tomorrow 7:00 AM: you lead Parking at Cedar Ridge · Due Fri: publish finals". Each item is a one-tap action.
   - Events become a secondary list. The admin CRM's Follow-ups pattern, applied to customers.

9. **Status as a design-system primitive.**
   - One `StatusBadge`, one `PublishLine`, one `EventShell`, one `SetupTabs`, one `BackLink`, one `ActionRow`. DESIGN.md defines each with a "do / don't" table, and a lint rule forbids raw `Badge tone=` in event pages.
   - Consistency stops depending on reviewers remembering it.
