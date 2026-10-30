# UI Designer

## Headline
The flow looks calm and consistent, and light and dark mode mostly hold up. The biggest visual problems: the "main action" color is used for two different things (blue Start and green Publish fight for attention), the save buttons look switched off when they still work, and the tab rows run off the edge of the screen at every width, hiding "+ Add sign-up". Dark mode has two real breaks: a glaring white logo box with invisible text, and native date, time, and dropdown icons that nearly disappear.

## Findings

### Two competing main-action colors, and Publish wins too early
- Where: Event page (draft), "Next step" card "Start →" (blue) vs "Almost ready to publish" card "Publish event" (green), src/app/dashboard/events/[eventId]/page.tsx:1023 (`variant="go"`). Volunteer Setup status card "Publish and open sign-ups" (green), src/app/dashboard/events/[eventId]/volunteering/page.tsx:259-265. All widths, both modes.
- What happens: DESIGN.md says deep blue is for main actions and green means "done, confirmed, saved". The event page has two filled buttons. The green Publish is the brightest thing on the page, especially in dark mode (mint green on navy), even while setup is unfinished and the checklist says "1 of 3". On Volunteer Setup the only filled button in the status card is green Publish, not anything about the sign-up being edited. The plan (S3Setup state 3) says the go-live button is blue.
- Who it hurts: Organizer at a laptop and PTO president: the eye lands on Publish before the next setup step, which invites publishing a half-built event.
- Standard: Heuristic 4 (consistency), "Action over information", DESIGN.md color roles
- Severity: 3
- Suggested fix: Make every go-live button use the brand style (`primary`), and keep green for status only. While setup isn't finished, show Publish as an outlined (secondary) button, and make it filled only in the "Ready" state. Keep one filled button per screen.

### Save buttons look switched off but still work (and fail contrast)
- Where: New event form "Save and continue", Event settings "Save changes", Volunteer Setup footer. The fade is `form [data-not-ready] { opacity: 0.5 }` at src/app/globals.css:240-243. All widths, both modes.
- What happens: At 50% opacity the button text is about 2.9:1 in light mode and 3.4:1 in dark, which is below 4.5:1, and the button really does still work. The same faded look also means two different things. On the new event form it means "required boxes are empty". On Event settings, next to "All changes saved", it means "nothing to save".
- Who it hurts: Organizer and Teacher: they think they can't continue, and a faded button in bright light or on an old classroom monitor is hard to read.
- Standard: WCAG 1.4.3 Contrast (the control is active, so the disabled exemption doesn't apply), heuristic 1 (visibility of status)
- Severity: 3
- Suggested fix: Drop the opacity fade. When required boxes are empty, keep the button at full strength and show "2 boxes left" in the footer's left slot, the way Volunteer Setup's "What's left" does. When nothing has changed, show the button as an outlined secondary button with full-contrast text, or hide it next to "All changes saved".

### Tab rows run off the screen, hiding "+ Add sign-up"
- Where: Volunteer Setup sign-up tabs (src/app/dashboard/events/_components/setup-tabs.tsx:33): "Import volunteers" is cut off even at desktop 1440, "+ Add sign-up" is cut off at tablet 820, and only 2½ tabs show on phone. Event settings section tabs: "Email s…" is cut off on phone, and "Publishing & more" is cut off at tablet.
- What happens: The row scrolls sideways with no arrow, fade, or count to say there's more. The action to add a sign-up is a tab at the far end, so on tablet and phone it's off-screen.
- Who it hurts: PTO president on a phone and Organizer on a tablet: they can't find how to add the next sign-up, and they can't see that a fifth sign-up or section exists.
- Standard: WCAG 1.4.10 Reflow (content hidden behind sideways scroll), heuristic 6 (recognition)
- Severity: 3
- Suggested fix: Move "+ Add sign-up" and "Import" out of the scrolling row onto their own line or button above the tabs, so they're always visible. Add a fade-out edge and a "›" scroll button when the row overflows. On phone, consider a "Sign-up: Parking ▾" dropdown that lists each sign-up with its status dot. On Event settings at tablet width, use the side menu (it fits at 820) instead of tabs.

### Dark mode: white logo box with invisible "No logo yet"
- Where: New event form and Event settings, "Logo and color", src/components/logo-form.tsx:107-109 (`bg-white` with `text-muted`, and muted is white in dark mode). Dark mode only, all widths.
- What happens: The box is solid white and the text inside is white, so it reads as a blank glaring rectangle that looks broken.
- Who it hurts: Organizer working at night in dark mode: it looks like an error, and they lose the "No logo yet" cue.
- Standard: WCAG 1.4.3 Contrast (1:1)
- Severity: 2
- Suggested fix: Keep the white backing only when a logo is shown (logos need it). For the empty state, use `bg-background` with a dashed `border-field-border` and `text-muted`.

### Dark mode: native date, time, and dropdown icons nearly vanish
- Where: Date and time pickers, time zone dropdown arrow, and checkboxes on the new event form and Event settings. There's no `color-scheme: dark` anywhere (src/app/globals.css:48 sets colors only). Dark mode only.
- What happens: The browser draws its built-in calendar and clock icons and the dropdown arrow in their light-mode dark grey on our navy fields, so they almost disappear. Pickers that open may also open in light colors.
- Who it hurts: Organizer and Teacher: they can't see that the date box opens a calendar.
- Standard: WCAG 1.4.11 Non-text contrast
- Severity: 2
- Suggested fix: Add `color-scheme: light` to `:root` and `color-scheme: dark` inside the dark media query. Then check the date and time icons in Chrome and Safari again.

### Setup progress lives in three different places and looks different in each
- Where: Event page desktop: a left sidebar checklist (src/components/setup-guide.tsx:22). Event page phone and tablet: a pinned bottom bar (setup-guide.tsx:42). Volunteer Setup and Event settings at all widths: a card at the top of the page with "Checklist ›".
- What happens: The same "1 of 3 needed to publish" progress moves from the side, to the bottom, to the top as you go deeper, with different wording ("Event setup" or "Setup") and different weight. On the event page at desktop it also squeezes the steps into a 240 px column where every label wraps to three lines, with 11 px pills and 12 px hints (setup-guide.tsx:423-440).
- Who it hurts: PTO president and Organizer coming back after days away: the "where was I?" cue isn't in a place they can learn.
- Standard: Heuristic 4 (consistency), Interruption-proof
- Severity: 2
- Suggested fix: Pick one pattern for every setup screen: the slim top card with the segmented bar and "Checklist ›", which works at all widths. On the event page, drop the sidebar in favor of that card plus the big "Next step" card, and give the content the full width. Raise the pills to 12 px minimum.

### Buttons smaller than our 44 px target in the Volunteer Setup status card
- Where: Volunteer Setup status card: Preview page, Check-in, and Print volunteer badges use `min-h-9 text-xs` (36 px tall, 12 px text), src/app/dashboard/events/[eventId]/volunteering/page.tsx:237-255. Time slot "Delete" is a 12 px ghost button (src/app/dashboard/events/[eventId]/forms.tsx:845). Most visible on phone, where the buttons wrap into uneven rows of mixed height.
- What happens: These are the smallest controls in the flow, and they sit right next to the go-live button. On phone, "Print volunteer badges" is visibly shorter than "Copy link" above it.
- Who it hurts: PTO president on a phone in the car line: mis-taps between Check-in and Publish.
- Standard: WCAG 2.5.8 passes (24 px), but this fails our 44 px house target (DESIGN.md Accessibility)
- Severity: 2
- Suggested fix: Use the standard `min-h-11 text-sm` secondary button for all of them. Put the go-live button alone on its own row (or in the pinned publish bar that DESIGN.md §9 describes), and put the four utility links in a row below it.

### Delete and edit controls on time slots don't look like what they are
- Where: Volunteer Setup, "Time slots" list, src/app/dashboard/events/[eventId]/station-panel.tsx:345-357. All widths, both modes.
- What happens: The per-slot "Delete" is grey text. "Delete sign-up" at the bottom is red. "Edit time slot" is grey, not underlined, and looks like a caption instead of a control. DESIGN.md says destructive actions are red and links are always underlined.
- Who it hurts: Organizer: they miss how to edit a slot, or don't realize Delete is destructive on a slot that has 6 people in it.
- Standard: Heuristic 4 (consistency), heuristic 5 (error prevention)
- Severity: 2
- Suggested fix: Make the per-slot Delete use `quiet-danger` (red text) with a trash icon. Make "Edit time slot" a secondary outlined button or an underlined brand-colored link with a pencil icon, on the same line as Delete.

### A locked "Time slots" choice doesn't look selected
- Where: Volunteer Setup, "What do people sign up for?" radio cards. Light: the selected card is faded, with a faint pale dot. Dark: both radio circles are the same grey and neither shows a dot. Both modes, all widths, worst in dark.
- What happens: The only sign of which option is chosen is a slightly tinted card background (about 1.1:1 against its neighbor), so the current choice is very hard to tell.
- Who it hurts: Organizer: they can't tell what type the sign-up is, which is the setting the rest of the form depends on.
- Standard: WCAG 1.4.1 Use of color, 1.4.11 Non-text contrast
- Severity: 2
- Suggested fix: When the choice is locked, show it as a read-only line instead of two disabled radios: "People sign up for: Time slots · To switch, delete this sign-up's time slots". If the radios stay, keep the checked dot and border at full strength and fade only the option that can't be picked.

### Type picker: unavailable kinds look available in dark mode
- Where: Type picker, src/components/event-type-picker.tsx:42 (`opacity-70`, which globals.css:269-274 cancels in dark mode). Dark mode especially, all widths.
- What happens: In light mode, cards outside the plan are faded (about 3.3:1) with a dashed border, so they read as unavailable. In dark mode they're full strength and the dashed border is barely visible, so the only cue is a small "Not in your plan" pill. The pill also jumps around: inline after short titles, on its own line under long ones. The "Free" pill sits in a different place at each width.
- Who it hurts: Organizer: they tap a card that does nothing.
- Standard: Heuristic 4 (consistency), WCAG 1.4.1 (the difference relies on a faint visual change)
- Severity: 2
- Suggested fix: Give unavailable cards a distinct, mode-safe treatment: no shadow, `bg-background`, a lock icon by the title, and the pill always on its own line above the description. Keep the description text at full contrast. Show the "Add a one-time event pass" note on the page version too. Only the dialog version has it (event-type-picker.tsx:107 vs events/new/page.tsx:32-54).

### Pinned save bars can cover the box you're typing in
- Where: New event form, Event settings, and Volunteer Setup footers. There's no `scroll-padding` anywhere in src/. In the screenshots the bar sits over "Venue name", the time zone dropdown, and the sign-up name box. All widths, worst on phone, where the bar is about 90 px tall.
- What happens: Tabbing or tapping into a box near the bottom can leave it hidden behind the pinned bar.
- Who it hurts: Teacher and PTO president on a phone, and anyone using a keyboard.
- Standard: WCAG 2.4.11 Focus not obscured
- Severity: 2
- Suggested fix: Add `scroll-padding-bottom` equal to the bar's height (for example 6rem) on `html` for pages with a pinned footer. Also add `scroll-margin-bottom` on inputs.

### Draft event page has no clear visual order
- Where: Event page, draft, all widths.
- What happens: Below the title, seven blocks stack at roughly the same weight: the red announcements strip, Next step, To do (amber with a red dot), Volunteers (with stat tiles), Almost ready to publish, Event day, and the sidebar. In light mode the stat tiles are white on off-white (about 1.03:1), so they don't read as tiles, though they do in dark mode. Event day buttons use title case ("Volunteer Check-in", "Broadcast Message") while every other button uses sentence case. The plan (S2Event "Setting up") folds Share and day-of blocks and shows a single "Needs you" alert. The build shows everything.
- Who it hurts: Organizer and PTO president: the next step competes with event-day tools they don't need for weeks.
- Standard: Heuristic 8 (minimalist design), "Action over information", heuristic 4
- Severity: 2
- Suggested fix: Follow the plan's order for drafts: Next step (key), Needs you (only when it has items), area cards, then a folded "Event day" and "Publish" section. Give the stat tiles a `border-border` outline in light mode. Use sentence case on all buttons.

### Small inconsistencies across widths
- Where: Header nav says "My events / Volunteer tracking" on desktop and tablet but "Events / Volunteers" on phone. The page title says "Event Settings" (src/app/dashboard/events/[eventId]/edit/page.tsx:288), while the button that opens it says "Event settings" and DESIGN.md says a draft should say "Set Up Your Event". The time zone dropdown is cut off at "Houst" on phone. The Feedback tab overlaps the right edge of cards at tablet width. On tablet the home page cards use half the width and leave the right half empty.
- Who it hurts: Organizer (names that don't match), Teacher on a phone (cut-off text)
- Standard: Heuristic 4, DESIGN.md §10 "a page's title matches the card that links to it"
- Severity: 1
- Suggested fix: Use the same nav labels at every width. Use one casing for "Event settings". Shorten the time zone labels on phone ("Central (Chicago)"). Inset the Feedback tab or move it into the footer below the `lg` breakpoint. Use a 2-column card grid from `sm` on Home.

### Plan risk: a third tab row on setup pages
- Where: Mock-ups IAEvent and S2Event ("event bar … tabs to every area stays on top"), combined with IASetup's per-sign-up tabs.
- What happens: On Volunteer Setup at phone width, the plan would stack event-area tabs, then sign-up tabs, and on Event settings a third row of section tabs. Single rows already overflow today (see above). The plan also doesn't say where the setup progress card goes on setup pages.
- Who it hurts: PTO president and Teacher on a phone
- Standard: Heuristic 8, WCAG 1.4.10
- Severity: 2
- Suggested fix: On phone, make the event bar a compact "Cedar Ridge · Volunteers ▾" switcher, or a bottom tab bar (the plan mentions one for event day), not a scrolling tab row. Say in the plan that the setup progress card lives in one fixed spot on every setup page.

## Working well
- The tokens hold up across modes. Text, borders, and badges in dark mode are crisp and high-contrast, and the "no grey text" rule makes supporting text easy to read at night.
- The new event form at phone width hides the five step labels behind "Step 1 of 5: Event details". This is a good way to keep the stepper from crowding a phone screen.
- The "What's left: Finish the details · Save for later · Save sign-up" footer on Volunteer Setup reads clearly and matches the plan.
- The "Next step" card on the event page has the right shape: one heading, one line of help, and one button. It should be the only filled button on the page.
- Inputs, main buttons, and checklist rows meet the 44 px target, and the forms reflow cleanly to one column on phone with no sideways page scroll.
- Status badges always carry words ("Draft: only your team can see this", "Draft, not finished"), never color alone.

Note: I didn't run axe for this review. The brief limits scratchpad reading to dr-mocks, so contrast figures were calculated from the design tokens and checked by eye.
