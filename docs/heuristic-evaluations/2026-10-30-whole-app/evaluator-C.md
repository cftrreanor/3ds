# Heuristic evaluation, Evaluator C: accessibility, visual system, and interaction consistency

**Product:** Field Command Events (Next.js + Tailwind + Supabase), whole product
**Perspective:** accessibility-minded visual and interaction design reviewer (keyboard, screen reader, contrast, touch, small screens, outdoor glare), plus how rigorous the visual system is
**Standards used for heuristic 4:** docs/DESIGN.md, docs/brand-voice.md, CLAUDE.md, `src/components/ui.tsx`, `src/app/globals.css`
**Evidence:** screenshots in `scratchpad/audit/` (`*-m.png` is 390px, `*-d.png` is 1440px) and grep counts over `src/` (taken 2026-10-30)
**Severity:** 0 = not a usability problem, 1 = cosmetic, 2 = minor, 3 = major, 4 = catastrophe

---

## Overall impression (flow pass)

The product already looks calm, trustworthy, and well above typical school software. It has one ink colour, one deep blue, soft cards, generous 44px controls, plain copy, and honest status lines. The marketing pages (`pub_-d.png`, `pub_band-contests-d.png`) look the most finished: the deep-blue hero, real product screenshots in phone frames, and a numbered "How it works" all feel close to Stripe or Linear.

Moving into the app, the feeling changes from "designed" to "assembled". Each page is fine by itself. Side by side, the same job is done in different ways:

- Status chips change colour from page to page.
- Buttons come in three sizes and two primary colours.
- Page titles switch between Title Case and sentence case.
- Delete looks different in four places.
- All iconography is emoji, which change with the operating system.

`ui.tsx` is only 131 lines with 7 primitives. Every other pattern (page header, stat tile, status chip, tabs, sticky bar, empty state, disclosure, back link) was rebuilt locally, often several times. That explains most of the inconsistency below.

### Variant inventory (headline numbers)

| Pattern | Variants found | Evidence |
|---|---|---|
| Page title (`h1`) styling | **18 distinct class strings**, no shared customer `PageHeader` (only `admin/kit.tsx` has one) | `grep '<h1 className'`, e.g. `text-3xl … sm:text-4xl` (20), `text-2xl font-medium` (11), `text-4xl … sm:text-5xl` (5) |
| Page title case | **2** (Title Case: "Volunteer Setup", "Event Settings", "Band Registration", "Performance Schedule Setup", "Booths & Partners", "Conference Setup", "Volunteer Check-in", "Broadcast Messages". Sentence case: "Your events", "Contest day", "Parent check-in", "My volunteering", "Account") | screenshots `band_dashboard_events_e1_*` |
| Back link wording | **≥6** ("← All events", "← Back to {event}", "← Dashboard", "← Back", "← Back to Volunteer Setup", admin "← Accounts"), no `BackLink` component | grep `←`: 17 "Back to", 3 "All events" … |
| Button primary colour | **2**: blue `primary` and green `go` (14 uses + `ActionButton` "go") | `ui.tsx:14-31`; `bands/page.tsx:189`, `volunteering/page.tsx:259` |
| Button size | **3 text sizes** (text-sm default, text-xs in status cards, `min-h-9`/`text-xs!` overrides in 14+ places) | `reopen-registration.tsx:26` `px-3! text-xs!`; `forms.tsx:688` `min-h-9`; `adm`/booths screenshots |
| Destructive button | **4 looks**: solid red `warn`, outlined red `danger`/`stop`, red text `quiet-danger`, grey `ghost` "Delete" | `forms.tsx:823-850` `DeleteButton`; `volunteering-d.png` time slots |
| Same variant, two names | `danger` vs `stop`, `quiet-danger` vs `quiet-stop`, `warn` (which is red) | `forms.tsx:972-982` |
| Hand-rolled filled buttons outside `<Button>` | **49** `bg-brand … text-brand-foreground` class strings, **30** hand-rolled `min-h-11 … border` secondary look-alikes | grep; e.g. `event-type-picker.tsx:57` `NewEventButton` |
| "Open/closed" status chip | **3 tones for the same meaning** (open = `brand` solid navy, `live` solid green, or `success` soft green) and **2 spellings** ("Signup open" / "Sign-up open") | `volunteering/page.tsx:225`, `bands/page.tsx:143`, `[eventId]/page.tsx:726` |
| Status chips not using `<Badge>` | `<Badge>` used 30×; **13+** ad-hoc `rounded-full px-2 py-0.5` pills, plus `rounded-sm` pills in the type picker and `Tag` in admin | grep |
| Tabs / segmented navigation | **6**: underline `SetupTabs`, left-rail section menu (`settings-nav.tsx`), pill jump-links (event page), pill filter chips (bands, contest day), `role="tablist"` tabs (signup form, desk, lead stations), bottom `event-day-nav` | screenshots + grep |
| Stat / KPI tiles | **≥7** implementations: `DayTiles`, `Total`, `Stat`, `ParentNumbers`, `VolunteerStats`, desk `Overview`, admin KPI strip, and `StatusLine` is duplicated (`event-day/page.tsx:226` and `contest-day/on-track.tsx:12`) | grep `function …Stat|Tile|Total` |
| Sticky bottom bars | **9** `sticky bottom` implementations; shadow hand-coded (`shadow-[0_-6px_16px_…]` ×9, 2 opacities) | grep |
| Disclosure affordance | **5 glyphs**: native ▸, `›`, `▲`, `▼`, "View ▾" (41 `<details>`) | `bands-d.png`, `dir_…-d.png`, `schedule-d.png` |
| "Done" mark | **4**: plain `✓` glyph (tabs), green filled circle-check (settings rail), green filled dot with ✓ (contest day), animated ring (setup guide) | `edit-d.png`, `team-d.png`, `contest-day-d.png` |
| Card radius | **2 radii for the same card role**: `rounded-lg` (20px, `Card`) and `rounded-xl` (24px, documented as dialog radius) on 33 card-like elements | grep |
| Font sizes | 10 Tailwind steps + **27 arbitrary** (`text-[11px]` ×16, `text-[13px]` ×10, `text-[10px]` ×1); `text-xs` (12px) used 263× | grep |
| Raw hex outside tokens | **56** occurrences in 20+ `.tsx` files (e.g. `bg-[#f5b301]` yellow dot, `backdrop:bg-[#071a31]/50`) | grep |
| Icons | **5 `<svg>`** in the whole app; **135 emoji/symbol glyphs** in 60 files (✓ 56, ⚠ 14, 🔒 9, 🏆 6, 🎺 5 …) | python scan |
| Container width | **8** `max-w-*` values on page wrappers (6xl 22, 2xl 18, 3xl 8, md 5, 4xl 5, lg 3, 5xl 3, xl 2) | grep |

---

## 1. Visibility of system status

### Working well
- "Saved by … at 9:21 PM" provenance lines under every setup page title (`SavedBy`), plus "Updates on its own · Updated just now" with a green dot on Contest day and Check-in (`band_dashboard_events_e1_contest-day-d.png`). Both are excellent trust cues.
- The sticky save footer says "All changes saved" or "What's left: Finish the details" (`edit-d.png`, `volunteering-d.png`).
- `SubmitButton` gives every action a pending label ("Publishing…", "Deleting…").
- Toasts use `role="status"` with `aria-live="polite"` (`toaster.tsx:41-63`). Emergency banners use `role="alert"` (`event-banners.tsx:41`).
- Progress tiles on the event overview (Parked 2/4, Check-in 1/4) show where the day stands at a glance.

### Findings

**C1. The same status is shown in three colours on three pages** (sev 3)
- **Where:** Volunteer Setup status card (`volunteering/page.tsx:225`, `brand` = solid navy "Signup open"), event overview (`[eventId]/page.tsx:726`, `success` = soft green "Sign-up open"), Band Registration (`bands/page.tsx:143`, `live` = solid green "Registration open" / `off` = **solid red** "Registration closed"). Also the director view shows "Registration closed" as a **neutral** chip (`dir_dashboard_bands_…-d.png`).
- **Heuristics:** 1, 4
- **What happens:** A host learns "green pill = open", then sees navy on the next page. "Closed" is a normal, planned state, yet it is solid red on one page and grey on another. Red tells a host something is broken when nothing is. Colour can't be trusted as a signal, which defeats the point of status colour, especially for a quick glance in sunlight.
- **Evidence:** `band_dashboard_events_e1_volunteering-d.png` (navy "Signup open"), `band_dashboard_events_e1-d.png` (soft-green "Sign-up open"), `band_dashboard_events_e1_bands-d.png` (red "Registration closed").
- **Recommendation:** Add a semantic `StatusBadge` to `ui.tsx` keyed by state, not tone: `state: "live" | "open" | "draft" | "closed" | "attention" | "blocked"`. Map open/live to soft success with a dot, closed/draft to neutral, attention to warning, blocked to danger. Remove the `off` tone (solid red for "not published") from `Badge`. Make all "is it open" chips go through `StatusBadge`.

**C2. "Live announcements" summary uses danger red for routine information** (sev 2)
- **Where:** event overview strip "⚠️ 2 live announcements · Band switch… Manage →" (`band_dashboard_events_e1-d.png`, `fair_…`, `visit_…`)
- **Heuristics:** 1, 4, 8
- **What happens:** A routine band switch is shown with a red border, red text, and a warning emoji, the same look as an emergency. DESIGN.md reserves `danger` for "Late, blocked, failed, destructive". When everything is red, a real emergency stops standing out.
- **Recommendation:** Colour the summary by the most severe live item: danger only if an emergency is live, warning-soft for schedule changes, brand-soft otherwise. Drop the ⚠️ unless it is an emergency.

**C3. Announcement types change colour between where they are posted and where they are seen** (sev 2)
- **Where:** `announcements/page.tsx:112` shows the Emergency badge as `warning` (amber) and Schedule change as `info` (blue). The banner seen by everyone (`event-banners.tsx:31-35`) shows Emergency as red and Schedule change as amber.
- **Heuristics:** 4, 1
- **What happens:** The host's "Showing now" list (`band_dashboard_events_e1_announcements-d.png`) uses one code and the public page uses another. The host can't preview what people will actually see.
- **Recommendation:** Export `LOOK` from `event-banners.tsx` and use it for the badge and card on the announcements page, or simply render `BannerCard` in the list.

**C4. Emergency banner is ordered below a schedule change** (sev 2)
- **Where:** public event page, director band page, Contest day (`pub_e_cedar-ridge-x7k2-d.png`, `dir_dashboard_bands_…-d.png`, `band_dashboard_events_e1_contest-day-d.png`)
- **Heuristics:** 1, 8
- **What happens:** "Lightning in the area. Everyone move indoors" sits second, under a band switch, because the list is sorted by time. On a phone in the stands, the safety message may be below the fold.
- **Recommendation:** In `EventBanners`, sort by priority first (emergency, then schedule, then routine), then by time. Consider a full-width emergency bar pinned to the top of the viewport.

**C5. The dashboard header has no "you are here" state** (sev 2)
- **Where:** `app/dashboard/layout.tsx:35-55`. None of the header links set `aria-current` or any active style. Only `public-nav.tsx:26` does.
- **Heuristics:** 1, 4
- **What happens:** On Volunteer tracking or Account, the header looks the same as on My events (compare `band_dashboard-d.png` and `band_dashboard_account-d.png`). The public "My volunteering" header does underline the active item (`band_my-m.png`), so the two navs behave differently. Screen readers get no current-page cue.
- **Recommendation:** Make `headerLinkClass` a small `HeaderLink` client component that uses `usePathname()`. It should set `aria-current="page"` and draw a 2px white underline, matching `public-nav.tsx`.

**C6. No loading skeletons anywhere** (sev 2)
- **Where:** `find src/app -name loading.tsx` returns 0.
- **Heuristic:** 1
- **What happens:** Event pages are heavy server components (`[eventId]/page.tsx` is 1,301 lines). On a weak signal at a stadium, tapping "Contest day" leaves the old page on screen with no sign that anything is happening.
- **Recommendation:** Add `loading.tsx` to `dashboard/events/[eventId]` and `e/[slug]` with a skeleton that has the page-header shape and 2–3 grey card blocks. Also add a thin top progress bar during route changes.

---

## 2. Match between system and the real world

### Working well
- Real-world vocabulary: "Bus & Equipment Parking", "Check-in Table", "Warm-up", "Gate", "Push the schedule back", "Running behind?". The order of check-in stops follows how a band moves through the day.
- Times always carry a zone ("7:00 AM – 10:00 PM CDT", "All times are Central Time").
- The director's band page reads like a call sheet: Warm-up starts, Warm-up ends, Ready position, Performance, on a vertical timeline (`dir_dashboard_bands_…-d.png`). Very strong.

### Findings

**C7. The same word is spelled two ways: "Signup" and "Sign-up"** (sev 1)
- **Where:** `volunteering/page.tsx:226` "Signup open / Signup closed", "Signup link", "Close volunteer signup". Elsewhere it is "Sign-up open", "sign-ups", and the public page eyebrow is "Volunteer signup" (`pub_e_…_volunteer-m.png`).
- **Heuristics:** 2, 4
- **Recommendation:** Pick one: "sign-up" (noun), "sign up" (verb). Add it to brand-voice.md and grep-fix.

**C8. Hyphens render with wide gaps ("Check - in", "Co - host", "sign - up")** (sev 2, verify on device)
- **Where:** every screenshot, in body text and h1s (`band_dashboard_events_e1_volunteers-d.png` "Volunteer Check - in", `band_dashboard_events_e1_team-d.png` "Co - host").
- **Heuristics:** 2, 8
- **What happens:** Hyphenated words look like typos or two separate words. That hurts the "premium" feel and readability.
- **Likely cause:** `globals.css` sets `font-variant-numeric: tabular-nums` on `body`. Inter's `tnum` feature also gives some punctuation a fixed width.
- **Recommendation:** Remove `tabular-nums` from `body`. Apply a `.nums` / `tabular-nums` utility only to times, counts, tables and stat tiles. If the gap stays, check that the Inter variable font actually loads in production rather than a fallback.

---

## 3. User control and freedom

### Working well
- Leaving a tab or step with unsaved edits asks "Save your changes first?" (`setup-leave.tsx`). Leaving a half-typed invitation asks too.
- "Save for later" sits beside "Save sign-up". The Unpublish, End now and Cancel invitation actions all exist.
- Dialogs are native `<dialog>`, so Escape closes them for free.
- Check-in rows show "tap to undo" (`door.tsx:149`, `desk.tsx:536`).

### Findings

**C9. The Feedback tab covers content and controls on phones** (sev 3)
- **Where:** `components/feedback-button.tsx:38` (`fixed right-0 bottom-1/3 z-30 … -rotate-90 … text-xs`), mounted on every page in `app/layout.tsx:46`.
- **Heuristics:** 3, 8, 4
- **What happens:** At 390px the tab sits on top of the right edge of content. It covers the "6:40 PM" time slot on the conference booking page (`conf_e_cedar-ridge-x7k2_book-m.png`), the "Adults only" badge and shift rows on the volunteer sign-up (`pub_e_…_volunteer-m.png`), the Links card and the tabs on the event page (`band_dashboard_events_e1-m.png`), and the "Not here yet" filter on Contest day. Parents and volunteers who will never send product feedback still have to work around it. The text is rotated, 12px, and the target is about 28px wide.
- **Recommendation:**
  - Hide it on public `/e/*` and `/my` pages.
  - In the app on phones, move "Send feedback" into the ☰ header menu and the footer.
  - On desktop keep the edge tab, but at `right-0 bottom-6`, unrotated, as a small "Feedback" pill.

**C10. A primary button at 50% opacity looks disabled before the form is filled in** (sev 3)
- **Where:** `globals.css` `form [data-not-ready] { opacity: .5 }`. Seen on Sign in (`pub_login-m.png`), My volunteering (`band_my-m.png`), conference booking "Book this time", volunteer "Save and finish", "Broadcast Message", "Send invitation", "Save changes".
- **Heuristics:** 3, 4, 1 (accessibility)
- **What happens:** White text on the faded button measures **2.9:1** (computed: `#fefdfc` on `#8498a8`), which fails WCAG 1.4.3 for 14px text. DESIGN.md says "It still works", but it looks disabled. Users on the very first screen (Sign in) may think they can't continue. In glare it nearly disappears. "All changes saved" plus a faded "Save changes" is fine, but a faded "Email me a sign-in link" is not.
- **Recommendation:** Keep the button at full strength. Signal readiness with the text next to it ("2 boxes left") or with a lighter-weight state, such as an outline style until ready, with label contrast kept at least 4.5:1. Keep 50% only for the true `disabled` state (no changes to save).

---

## 4. Consistency and standards (heaviest section)

### Working well
- Tokens are well-built: one `:root` palette with documented contrast ratios, a dark theme, a focus ring token that switches to white on dark bands (`globals.css:180-190`), and reduced-motion handling.
- `Field`/`Input`/`Select`/`Textarea` are used consistently on forms. Labels sit above, hints below, and `min-h-11`. No `type="number"` anywhere, per CLAUDE.md.
- The "Setup page" pattern (status card, then tabs with ✓/dot and status line, then a sticky save footer) is applied to Band Registration, Volunteer Setup, Booths & Partners, Conference Setup, and Performance Schedule. It is the strongest pattern in the app.
- Admin is deliberately a different, denser kit (`admin/kit.tsx`), and DESIGN.md documents it. Good separation.

### Findings

**C11. No shared page header: 18 h1 variants, two title cases, six back-link wordings** (sev 3)
- **Where:** grep of `<h1 className=` gives 18 class strings. Event overview h1 is `text-4xl … sm:text-5xl` (`band_dashboard_events_e1-d.png`), setup pages `text-3xl sm:text-4xl`, Account `text-3xl`, admin `text-2xl`. Back links read "← All events", "← Back to Cedar Ridge Marching Invitational", "← Dashboard" (`dir_dashboard_bands_…-d.png`).
- **Heuristics:** 4, 6
- **What happens:**
  - Moving between sibling pages, the title jumps size and position.
  - Title Case ("Performance Schedule Setup") and sentence case ("Contest day") sit one click apart.
  - Status line, "saved by" line and description come in a different order on each page.
  - The event overview puts the title in a 2-column layout with a floating "Setup complete" rail, so the title starts at x=430 on one event page and x=505 on another (`band_dashboard_events_e1-d.png` and `fair_dashboard_events_e1-d.png`).
- **Recommendation:** Add `PageHeader` to `ui.tsx` with fixed slots: `back` (one `BackLink` with an "← {parent name}" pattern), `eyebrow`, `title`, `meta` (date · place), `saved` (SavedBy), `description`, `actions`. Use one h1 size (`text-3xl sm:text-4xl`) for app pages. Reserve `text-5xl` for the event overview only, as the "hero" of the app. Add a casing rule to brand-voice.md (recommend sentence case for all titles, matching "Your events" / "Contest day").

**C12. Two primary-action colours: blue `primary` and green `go`** (sev 2)
- **Where:** `ui.tsx:21` `go` = solid green. Used for "Reopen registration" (`bands-d.png`), Publish (`edit/page.tsx:474`, `[eventId]/page.tsx:1023`), "Creating…/Adding…" (`forms.tsx:366,636,688`).
- **Heuristic:** 4
- **What happens:** DESIGN.md says "one deep blue for actions". Green filled buttons also look like the green success badges right beside them ("Published" pill next to a green "Reopen" button). It is unclear which elements are status and which are controls.
- **Recommendation:** Make every primary action `primary` (blue). If Publish deserves extra weight, give it an icon plus the pinned publish bar it already has, not a new hue. Remove the `go` variant or rename it `publish` and make it blue.

**C13. Red is used for non-destructive "celebration" actions** (sev 2)
- **Where:** "Reveal 1" (finalists) uses `warn` = solid red (`schedule-builder.tsx:370,864`; `band_dashboard_events_e1_schedule-d.png`). "Push the schedule back" uses solid red (`contest-day/controls.tsx:171`, `rooms/push-back-form.tsx:55`).
- **Heuristics:** 4, 5
- **What happens:** Revealing finalists is the best moment of the contest, and it is styled like "Delete". The variant is named `warn` but renders `bg-danger`.
- **Recommendation:** Rename `warn` to `destructive` and use it only for irreversible removal. Make Reveal a primary (or the accent "finalist" blue that DESIGN.md already sets aside for finalists, `accent`). Make Push back a primary with a confirm.

**C14. Delete has four visual treatments** (sev 2)
- **Where:** `forms.tsx:823-850` `DeleteButton` renders grey `ghost` text-xs by default, red text when `quiet`, and red outline when `destructive`. Elsewhere `warn` is solid red (delete event, withdraw band).
- **Heuristics:** 4, 5
- **What happens:** Time-slot "Delete" is grey 12px text next to "2 / 6 filled" (`band_dashboard_events_e1_volunteering-d.png`), easy to mistake for a label. DESIGN.md §8 says "Delete buttons are red".
- **Recommendation:** Two treatments only:
  - `destructive-quiet` (red text plus a trash icon, 44px target) for row-level deletes.
  - `destructive` (red outline) for whole-object deletes, with a confirm dialog that uses a solid red confirm.
  - Drop grey deletes.

**C15. Buttons come in three sizes with ad-hoc overrides** (sev 2)
- **Where:**
  - Status cards use `text-xs` buttons ("Copy link", "Preview page", "Check-in", "Print volunteer badges", `reopen-registration.tsx:26` `px-3! text-xs!`).
  - Row actions ("Edit", "Rename", "Remove", "Cancel") are `text-xs`.
  - Section actions ("Manage booths", "Download list") are `text-sm`.
  - 14 `<Button … min-h-9|py-1>` overrides go below the 44px rule.
- **Heuristic:** 4 (and 8)
- **What happens:** On one screen (`fair_dashboard_events_e1_booths-d.png`), "Copy link" (12px) sits above "Rename" (12px) and "+ Add a booth" (14px). It reads as unplanned. Some overrides drop under 44px (`min-h-9` = 36px), which DESIGN.md forbids for the customer app.
- **Recommendation:** Add `size: "md" | "sm"` to `Button`. `sm` = 36px tall on desktop only (`min-h-11 sm:min-h-9`) with text-sm. Ban `!` overrides on Button (lint rule: no `text-xs` on `<Button>`).

**C16. 49 hand-rolled filled buttons and 30 hand-rolled outline buttons bypass `<Button>`** (sev 2)
- **Where:** e.g. `event-type-picker.tsx:57-59` (`NewEventButton` copies the primary class string), `<Link>` CTAs across dashboard pages.
- **Heuristic:** 4
- **What happens:** Any change to the button spec (hover, focus, radius, pending) misses about 80 call sites. Visual drift is already showing: "Email / Call / Text" on the director page are outline buttons with underlined link text inside (`dir_dashboard_bands_…-d.png`), a hybrid that appears nowhere else.
- **Recommendation:** Export `buttonClass({variant,size})` from `ui.tsx` and a `ButtonLink` that wraps `next/link`. Codemod the 79 sites. Add a lint grep in CI for `bg-brand.*text-brand-foreground` outside `ui.tsx`.

**C17. Six different tab and segmented-nav patterns** (sev 2)
- **Where:**
  1. Underline `SetupTabs` (`setup-tabs.tsx`)
  2. Left-rail section menu with circle-checks (`edit/settings-nav.tsx`, `band_dashboard_events_e1_edit-d.png`)
  3. Rounded pill jump-links on the event overview ("Contest day / Bands / Schedule / Volunteers", `band_dashboard_events_e1-d.png`)
  4. Pill filter chips with counts ("All 3 / 4A 1", "All 4 / Behind 0", `bands-d.png`, `contest-day-d.png`)
  5. `role="tablist"` tabs in the signup form, desk and lead stations, built separately
  6. Bottom tab bar `event-day-nav.tsx`
- **Heuristic:** 4
- **What happens:** Pills mean "jump to section" on one page and "filter this list" on the next. DESIGN.md says pills are for the home hero and header only. Only 3 of the 6 use tab semantics, and the ARIA differs between them.
- **Recommendation:** Keep three, each with a distinct look:
  - `Tabs` (underline) for views of one thing
  - `SegmentedControl` (one joined bar with a sliding thumb) for filters
  - `SectionNav` (left rail on desktop, underline on phone) for settings
  - Replace the jump-pills with a sticky in-page "On this page" underline nav.
  - Build all of them on one primitive with roving `tabIndex` and arrow-key support.

**C18. Seven stat-tile implementations with different anatomy** (sev 2)
- **Where:**
  - `DayTiles` (bordered, value, progress bar, `contest-day-d.png`)
  - logistics tiles (borderless white on surface, `band_dashboard_events_e1-d.png`)
  - `Total` (no tile, plain grid, `bands-d.png`)
  - `ParentNumbers` (white, `visit_dashboard_events_e1-d.png`)
  - desk `Overview` (bordered, "2 / 5 here · 7 open spots", `volunteers-d.png`)
  - admin KPI strip
  - `VolunteerStats` (value plus progress bar)
  - Also `StatusLine` is copy-pasted (`event-day/page.tsx:226`, `contest-day/on-track.tsx:12`).
- **Heuristic:** 4
- **What happens:** Numbers are the heart of event-day monitoring. The label sits above the number in some tiles and below it in others. Some tiles have borders and some don't. Borderless white tiles on the `#FCFBF8` surface are almost invisible (white vs surface is about 1.03:1).
- **Recommendation:** Add a `Stat` primitive (label, value, of, sub, progress, tone, href) and a `StatGrid`. Use it everywhere, including admin.

**C19. Iconography is entirely emoji and Unicode glyphs** (sev 2)
- **Where:** 135 emoji/glyphs in 60 files; 5 `<svg>`s in the whole app. Event-type picker (`band_dashboard_events_new-d.png`: 🎺👥🙋🏫🎪🍎🤝), section headings (🏟 Hosting, 🎺 Competing in `band_dashboard-d.png`), ⚠️ in banners, 🔒 for privacy notes, ☕ for breaks (rendered as a tiny grey blur in `schedule-d.png` and `pub_e_…-d.png`), 🏆 Finals.
- **Heuristics:** 4, 8
- **What happens:**
  - Emoji look different on iOS, Android, Windows and ChromeOS (school Chromebooks).
  - Their colours can't follow the palette, and they ignore dark mode.
  - They clash with the restrained navy system. The 3D stadium emoji next to "Hosting" reads as a consumer chat app, not a "dependable" tool.
  - Screen readers announce some of them ("trumpet", "raising hand") unless every instance is `aria-hidden`, and several are inline in strings.
  - The one real icon set (the `Icon` in `event-day-nav.tsx`) proves the team can do better.
- **Recommendation:** Adopt one line-icon set (Lucide, 1.75px stroke, 20px). Map each event type to an icon plus a tint chip. Replace ✓ with a `Check` icon component and ⚠️ with `AlertTriangle`. Keep emoji only in user-written content.

**C20. Raw hex and arbitrary sizes bypass tokens** (sev 1)
- **Where:**
  - 56 hex literals in 20+ files, e.g. `bg-[#f5b301]` ("to-do" yellow dot) in `setup-tabs.tsx:52` and `forms.tsx:241`, and `backdrop:bg-[#071a31]/50` in `confirm-dialog.tsx:107` and `feedback-button.tsx:47`.
  - 27 `text-[10|11|13px]`.
  - 9 hand-written `shadow-[0_-6px_16px…]`.
  - The `violet` and `teal-deep` tokens are named after colours they no longer are.
- **Heuristic:** 4
- **What happens:** The yellow dot is **1.85:1** on white. It is the only "needs doing" signal on tabs (the status text beside it is muted), so it disappears in sunlight. Dark mode can't recolour any hex.
- **Recommendation:**
  - Add tokens `--attention` (the dot; use the existing `warning` #854600, or a darker gold of at least 3:1 for a non-text indicator), `--scrim`, and `--shadow-bar`.
  - Rename `violet` to `sky` and `teal-deep` to `navy-deep`.
  - Add `text-2xs` (11px) as a token, or better, remove 11px entirely (see C25).
  - Add a stylelint/grep CI check for `#[0-9a-f]{6}` in `.tsx`.

**C21. Disclosure and "done" glyphs vary** (sev 1)
- **Where:** ▸ (band rows, Past (1)), › (QR code), ▲ (Contest info), ▼ (finalist time selects), "View ▾" (Your registration). "Done" shows as plain ✓, filled green circle-✓, or a ring (C-table).
- **Heuristic:** 4
- **Recommendation:** Add a `Disclosure` component (`<details>` plus a rotating chevron icon on the right, full-row 44px summary) and a `DoneMark` icon. Use them everywhere.

**C22. Event overview modules differ by event type for the same job** (sev 2)
- **Where:** The band event's "Contest day" module is a status card with four progress tiles and "Open contest day". Fair, visitor and choir events use an "Event day" card with sentence text and 2–3 equal buttons, with labels in mixed case: "Volunteer Check-in" vs "Parent door check-in" vs "Partner check-in" (`fair_dashboard_events_e1-d.png`, `visit_dashboard_events_e1-d.png`). Parent registration puts its two buttons on the right ("Parent Registration", "Check-in"), while Band registration has one ("Manage bands").
- **Heuristic:** 4
- **What happens:** A host running two kinds of event has to relearn the hub page. Title-cased "Parent Registration" button vs sentence-cased "Manage volunteers".
- **Recommendation:** Define one `ModuleCard` anatomy: title row (h2 plus StatusBadge), one-line summary, `StatGrid`, then one primary action and up to two secondary actions on the right. Every event type fills that template.

**C23. Pills and radius drift from DESIGN.md** (sev 1)
- **Where:**
  - DESIGN.md: "pills only in the home page hero and header". The app uses `rounded-full` 97 times: filter chips, jump links, badges, the feedback tab, and "Email/Call/Text".
  - Cards use 20px (`Card`) or 24px (`rounded-xl`, 33×), e.g. the event-type cards and the contest-day table.
  - Type-picker badges are `rounded-sm` squares ("Free", "Not in your plan") while every other badge is a pill.
- **Heuristic:** 4
- **Recommendation:** Update DESIGN.md to allow pills for badges and chips, or change the code. Then lock radius by role: control 12, chip full, card 20, dialog 24. Make `Card` the only card.

---

## 5. Error prevention

### Working well
- Destructive actions go through `confirmMessage` / `ConfirmDialog`, and "delete event" and "withdraw band" need a "sure" checkbox first.
- Full shifts are disabled and labelled "Full" (`pub_e_…_volunteer-m.png`).
- Check-in buttons stay off until the day ("Check-in buttons turn on Mon, Oct 19"), which prevents early check-ins.
- `inputMode` / `type=tel` / `type=email` on 16+14+20 fields help phones show the right keyboard.

### Findings

**C24. Contest-day status dots are 24px tap targets with hover-only detail** (sev 3)
- **Where:** `contest-day/page.tsx:774-783`. Each Park/Check/Warm/Gate cell is a `<Link className="h-6 w-6 …">` with its detail in `title=`.
- **Heuristics:** 5, 4 (WCAG 2.5.8), 6
- **What happens:**
  - Four 24px circles sit 20px apart in a row (`band_dashboard_events_e1_contest-day-m.png`). On a phone outdoors, with gloves or cold hands, mis-taps open the wrong stop.
  - The "due at 2:00" detail lives in `title`, which touch users never see.
  - Empty "not yet" circles are `border-border` (#DFE3E8, **1.25:1** against the surface), so in glare the row reads as blank. That fails WCAG 1.4.11 for a state indicator.
- **Recommendation:**
  - Make each cell a full 44×44 hit area (pad the link and keep the 24px dot visual).
  - Draw "not yet" with `field-border` (5.3:1) or a dashed slate ring.
  - Show "due 2:00" as small text under late or soon dots instead of a tooltip.
  - Consider a high-contrast "field mode" (see Iconic ideas).

**C25. 11px text in safety- and status-critical places** (sev 2)
- **Where:** `text-[11px]` ×16: contest-day column headers ("Park Check Warm Gate"), the event-day bottom bar labels (`event-day-nav.tsx:159`), "Now" / "Walk-up" / "Under 18" / "Guardian co-signed" tags (`desk.tsx:330,479`, `volunteer-tags.tsx`), "tap to undo", "photo ID checked" (`door.tsx:149,154`). `text-xs` (12px) appears 263 times, including "Draft, not finished" status lines and the stat-tile labels.
- **Heuristics:** 5, 8, 4
- **What happens:** These are the words volunteers read in sunlight at the door. "Under 18" and "photo ID checked" are safeguarding cues. At 11px in muted slate they get skipped.
- **Recommendation:** Set a 12px floor app-wide (13px for anything a volunteer reads on event day). Make the safeguarding tags 14px semibold with an icon.

**C26. Locked event types are faded to 70% with no way forward** (sev 2)
- **Where:** `event-type-picker.tsx:42` (`aria-disabled`, dashed border, `opacity-70`) on `band_dashboard_events_new-d.png`.
- **Heuristics:** 5, 10, 4
- **What happens:**
  - Four of seven cards are greyed out. Muted text at 70% drops to about 3.6:1, which fails AA for the 14px blurb.
  - `aria-disabled` on a `div` is ignored.
  - The card doesn't say how to get the type ("Write to us" lives on the Account page).
  - The tiny "Not in your plan" chip is the only explanation.
- **Recommendation:** Keep full-contrast text. Replace the dashed fade with a lock icon plus a "Included in Event Command Plus · Ask us" link that opens the existing contact route. Sort available types first.

---

## 6. Recognition rather than recall

### Working well
- Status lines under every tab label ("3 bands", "Saved", "Optional", "Draft, not finished") keep progress visible without opening each tab.
- Conference booking repeats When, Meetings and How you'll meet at the top (`conf_e_…_book-m.png`).
- The director's page gathers the timeline, organizer contacts, info, documents and registration in one place.

### Findings

**C27. Deep pages lose event context on phones** (sev 2)
- **Where:** All `/dashboard/events/[id]/*` setup pages. The header shows only "Events · Volunteers · ☰". The only cue is the back link "← Back to Cedar Ridge Marching Invitational", which scrolls away.
- **Heuristic:** 6
- **What happens:** A host with two events open in two tabs (band contest and fair, both named "Cedar Ridge…" in the sample) can't tell which one they are editing once they scroll.
- **Recommendation:** Add a slim sticky sub-header under the main header on event pages: event name, date, StatusBadge, and a switcher for sections (Overview · Bands · Schedule · Volunteers · Settings). This also replaces the jump-pills (C17).

**C28. The "Links to share" table relies on recognising truncated URLs** (sev 1)
- **Where:** `band_dashboard_events_e1-d.png` and `-m.png`. Mono URLs are truncated ("localhost:4400/e/cedar-ridge-x7k2/volun…"). "Copy link" isn't underlined but "QR code" is, so one looks like a button and the other like a link.
- **Heuristics:** 6, 4
- **Recommendation:** Lead with the audience ("For spectators"), drop the raw URL into a secondary line or tooltip, and make Copy, QR and Open matching icon buttons with labels.

---

## 7. Flexibility and efficiency of use

### Working well
- Filter chips with counts on Contest day and Registered bands. Search by name or phone on check-in desks.
- Copy link, Download list, Print volunteer badges, Add to calendar (Google, Apple/Outlook).
- The bottom event-day tab bar on phones is a genuine accelerator, and the layout reserves room for it (`--day-bar`).

### Findings

**C29. No keyboard accelerators or command palette for heavy desktop hosts** (sev 1)
- **Where:** app-wide. Admin has a search bar, the customer app has none.
- **Heuristic:** 7
- **What happens:** A host managing many sign-ups clicks through tabs one at a time. There's no "/" to search and no ⌘K to jump to "Volunteer Setup › Concessions".
- **Recommendation:** Add a ⌘K palette (events, sections, sign-ups, people) to the dashboard layout, plus `g e` / `g c` style shortcuts listed in a "?" sheet. This is low cost with the existing route map.

**C30. Status cards on phones wrap into a stack of 4–5 unequal button rows** (sev 2)
- **Where:** Volunteer Setup status card at 390px: "Copy link · Preview page · Check-in", then "Print volunteer badges", then "Close volunteer signup", then "QR code" (`band_dashboard_events_e1_volunteering-m.png`). Same on Bands and Conference.
- **Heuristics:** 7, 8
- **Recommendation:** On phones, show one primary action plus a "Share" button (opens a sheet with Copy, QR, Preview) plus an overflow "⋯" menu for Print and Close. On desktop keep the row.

---

## 8. Aesthetic and minimalist design

### Working well
- A restrained palette, soft shadows, and generous whitespace. The marketing pages have a confident display type scale (`text-6xl`, `leading-[0.96]`).
- Cards are warm off-white on white, a subtle and premium touch. The deep-blue header gives a strong frame.
- The setup guide's ring-sweep and check-draw animation (`globals.css` `setup-*` keyframes) is a lovely, restrained bit of delight that respects reduced motion.

### Findings

**C31. Duplicate primary CTAs and a competing banner on "Your events"** (sev 2)
- **Where:** `band_dashboard-d.png`, `-m.png`. "New event" appears twice (section header and empty state). An "Admin · 1 new pilot request →" bar sits above everything. A full-width amber "Your free period ended" banner sits between the heading and the content. The emoji section icons (🏟 🎺) render at different sizes.
- **Heuristic:** 8
- **Recommendation:** Keep one "New event" (in the header row). Move the admin shortcut into the header menu. Make the plan banner a dismissible slim bar. Replace the emoji with icons (C19).

**C32. The event overview stacks seven equal-weight modules with no hierarchy** (sev 2)
- **Where:** `band_dashboard_events_e1-d.png` (2,341px tall), `-m.png` (2,975px). In order: header, Links to share, live announcements, jump pills, Contest day, To do, Band registration plus logistics, Performance schedule, Volunteers. Each is a same-weight card under a same-size h2.
- **Heuristic:** 8
- **What happens:** "To do: 1 invitation has expired" (the one thing to act on) sits in the middle of the page in amber with a red dot. The empty left column on desktop holds only "Setup complete".
- **Recommendation:** Use the left rail (desktop) as a persistent section nav plus the To-do list. Put "Needs you" first, styled as the page's single alert. Make Links to share collapsible after first use. On event day, swap the order so the Contest day module leads.

**C33. Borders and surfaces too faint for outdoor use** (sev 2)
- **Where:** `--border: #DFE3E8` is **1.25–1.29:1** against the surface/white. It is used for card edges, list dividers, tab underlines, stat tiles and empty check circles. Stat tiles sit white on the `#FCFBF8` surface (`band_dashboard_events_e1-d.png`).
- **Heuristics:** 8, 4 (WCAG 1.4.11 where the border is the only boundary of a control, e.g. the secondary button `border-border bg-surface`)
- **What happens:**
  - On a phone at full sun, secondary buttons ("Copy link", "Unpublish", "Edit finals") lose their outline and read as plain text.
  - The secondary button's only boundary is a 1.25:1 border, which fails 1.4.11.
- **Recommendation:** Give secondary buttons `border-field-border` (5.3:1), as inputs already have. Keep the hairline only for decorative dividers. Add a `--border-strong` token for interactive outlines.

**C34. Dark mode makes all supporting text pure white** (sev 2)
- **Where:** `globals.css` dark: `--muted: #ffffff`, plus forced `opacity:1` on `.opacity-70/80/90`.
- **Heuristic:** 8
- **What happens:** Labels, hints, metadata, "Draft, not finished", "Optional." and past events all render at the same weight as primary text. The whole hierarchy built on `text-muted` collapses, and past and finished items look current. Dark mode is automatic (`prefers-color-scheme`) with no toggle, so many phones at night will see this.
- **Recommendation:** Use a light slate (`#C8D4E0`, already the `on-dark-mute` value, about 11:1 on `#0C1F33`) for `muted` in dark mode. It is well above AA and keeps hierarchy. Restore opacity for past items, or better, use explicit "Past" styling.

---

## 9. Help users recognize, diagnose, and recover from errors

### Working well
- `FormMessage` errors use `role="alert"`, `tabIndex=-1`, red-on-pale-red at 6:1, and sit next to the form.
- The required-field pattern (red outlines only after a save attempt, "Fill in the boxes outlined in red.") is gentle and clear. It never shows browser pop-ups.
- `missing()` shows "a database update is needed" instead of a 404 (CLAUDE.md).

### Findings

**C35. The form-level error is CSS-generated content, which screen readers may not announce** (sev 2)
- **Where:** `globals.css` `form[data-missing]::after { content: "Fill in the boxes outlined in red." }`
- **Heuristics:** 9, 4 (accessibility)
- **What happens:** Pseudo-element text isn't reliably announced and isn't in a live region. A screen-reader user who taps Save hears nothing. Focus does jump to the first empty box, but without "required, missing" context unless the browser's own validity message reads. Red outlines alone signal by colour (1.4.1).
- **Recommendation:** In `required-fields.tsx`, also write the message into a visually styled `<p role="alert">` after the form. Set `aria-invalid="true"` on each missing field (the `Input` already styles `aria-invalid:border-danger`).

**C36. The event-band override turns danger text white** (sev 1)
- **Where:** `globals.css` `.event-band { --danger: #ffffff; --muted: #fff; --brand:#fff }`
- **Heuristics:** 9, 4
- **What happens:** Any error or late indicator rendered inside an event's colour band loses its red. Fine for headings, risky if a form message or "Late" chip ever lands there.
- **Recommendation:** Scope the override to text elements (`.event-band :where(h1,p,a)`), or keep danger as a white-on-red chip within bands.

---

## 10. Help and documentation

### Working well
- Every setup step has a one-line purpose under its title. Inline hints are specific ("Bands not fully parked by then are flagged Late, so you have time to adjust the schedule").
- Privacy explanations sit right where data is collected ("Your child's privacy" on booking, the 🔒 note on Volunteer Setup).
- "How this works" disclosures on Contest day.

### Findings

**C37. In-context help is tiny and grey, and the support route is a mailto in body copy** (sev 1)
- **Where:** "How this works" on Contest day is `text-xs text-muted` at the very bottom (`band_dashboard_events_e1_contest-day-d.png`). It also explains the dot legend in prose ("Green ✓ done, red ! late, gold due soon, grey not yet"), but there's no visual legend above the table. Support appears as `product@fieldcommandevents.com` written inside paragraphs (Account page, plan banner).
- **Heuristic:** 10
- **Recommendation:** Put a 4-item dot legend as a visual key in the table header row. Add a consistent "Help" item (header menu or footer) that opens a side sheet with page-specific tips and a contact button. The support address should come from config.

---

## Summary of findings by severity

| Sev | IDs |
|---|---|
| 3 | C1, C9, C10, C11, C24 |
| 2 | C2, C3, C4, C5, C6, C8, C12, C13, C14, C15, C16, C17, C18, C19, C22, C25, C26, C27, C30, C31, C32, C33, C34, C35 |
| 1 | C7, C20, C21, C23, C28, C29, C36, C37 |

**Root cause:** `ui.tsx` covers 7 primitives. The app needs about 20 (PageHeader, BackLink, StatusBadge, Stat/StatGrid, Tabs, SegmentedControl, SectionNav, Disclosure, StickyBar, ModuleCard, EmptyState, Icon, ButtonLink, IconButton, Sheet, DoneMark, Legend). Building those and codemodding call sites would resolve about 60% of the findings above.

---

## Starting fresh: iconic ideas (visual identity and design system)

These go beyond the heuristics, as bold directions for making the product feel iconic rather than merely tidy.

1. **"Field mode": a sunlight-grade event-day theme.** When an event is live and the user is on a phone, switch to a high-contrast theme:
   - pure white and ink with 2px borders and a 16px minimum text size
   - 56px targets, status as big shape and colour blocks (filled square = done, ring = not yet, triangle = late)
   - an optional auto-dim at night

   Name it in the product ("Field mode is on"). No competitor designs for the parking lot at noon. This would be the signature.

2. **A real brand mark system built from the field.** Take the marching-field grid (yard lines, hash marks) as the core graphic motif:
   - thin yard-line rules as section dividers
   - hash-mark tick progress bars
   - the 50-yard line as the hero's horizon
   - the event's own colour as a "team stripe" across its public page

   It is ownable and instantly reads "school events", with no emoji needed.

3. **A custom icon set (about 40 glyphs) in one stroke weight.** Bus, trailer, music stand, whistle, clipboard, gate, lunch tray, booth tent, ID badge, lightning. Event types each get a glyph plus a muted tint chip. This replaces all 135 emoji. Icons become the second brand asset after the wordmark.

4. **Status as a first-class design language.** Five states only (Draft, Open, Live, Closed, Needs you), each with a fixed shape, colour, word and motion: Live gets a slow 2s pulse dot, Needs you a gentle nudge on load. Use them identically in chips, tabs, the left rail, emails and the public page. The way Linear's issue states are recognisable at 12px, these should be recognisable from across the gym.

5. **The "run sheet" as the hero component.** The director's vertical timeline (warm-up, ready, perform) is the most distinctive screen in the app. Make it the house component for every event type: the parent's conference slot, the volunteer's shift, the choir room rotation. Use a live "now" line that moves down the sheet, sticky at the top on phones. That becomes the screenshot people share.

6. **Typography with a point of view.** Keep Inter for UI, but add a condensed athletic display face (e.g. a variable grotesk condensed such as "Barlow Condensed" or a licensed collegiate face) for event names, big times and scoreboard numbers ("2:15 PM"). Set big times in tabular display at 64–96px on event-day screens, like a stadium scoreboard. Use it only on the h1 and big numbers to stay restrained.

7. **One page-shell grammar.** Every page = `PageHeader` (eyebrow, title, meta, status, actions), then an optional `StatusStrip` (the publish/live bar), then content in `ModuleCard`s, then one `StickyBar`. Document it as a Storybook/Ladle "kitchen sink" page at `/dev/kit` with every primitive and state, plus a CI check that bans raw hex, arbitrary text sizes and hand-rolled buttons. The visual polish of Stripe comes from this rigour more than from any one flourish.

8. **Motion with meaning, not decoration.** Extend the setup-ring animation into a small motion vocabulary:
   - check-in rows slide into "Arrived" with a 150ms check-draw
   - a schedule push animates times sliding later
   - finalists "Reveal" with a single card flip, the one celebratory moment

   All of it respects reduced motion. Hosts will remember the reveal.

9. **The public event page as a living scoreboard.** Spectator and parent pages get the event's colour band, a "Now performing / Up next" ticker at the top, the emergency banner as a full-bleed takeover, and an installable PWA icon generated from the event's logo and colour. Schools will project it on the stadium screen, which is free marketing.

10. **Paper parity.** Every key screen (check-in list, run sheet, badges, schedule) has a designed print stylesheet with the field-grid motif and a QR back to the live page. Clipboards will exist on day one anyway, so make the printout the best-looking thing on the clipboard, branded.
