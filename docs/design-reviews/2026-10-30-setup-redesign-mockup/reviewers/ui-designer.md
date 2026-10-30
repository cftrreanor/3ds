# UI Designer

## Headline
The layout is calm and on-brand. Each screen has one clear filled button for the main action, status pills come with words, and the tablet and desktop widths hold together well. The biggest problems are in dark mode and at phone width. In dark mode, buttons that can't be used look the same as buttons that can, and empty boxes look filled in. On a phone, the step bar drops its "done" and "now" words and the Account link disappears. A few spots also have controls that are too small or line up differently from one row to the next.

## Findings

### Disabled buttons look usable in dark mode
- Where: 4 Editing a job, "Save and mark ready" (all widths, dark). 8 Not allowed to publish, "Publish and open sign-up" (all widths, dark). 5 Preview, "Sign-up opens when published" (dark).
- What happens: In light mode these buttons are washed out, so they look unavailable. In dark mode they get full-strength white or light-blue text and a normal outline. On screen 4 (dark), "Save and mark ready" (white text) stands out more than the button that does work, "Save as draft" (blue text). On screen 8 (dark), the Publish button looks ready to tap right under a banner that says you can't publish. This matches the dark-theme rule that faded text shows at full strength, so the usual 50% fade doesn't work there.
- Who it hurts: Organizer at a laptop and PTO president working late at night in dark mode. They tap a button that looks ready and nothing happens, or they can't tell which save button is the main one.
- Standard: Heuristic 1 (visibility of system status), heuristic 4 (consistency); WCAG 1.4.1 (the state is shown by fading alone, and that fade is missing in dark)
- Severity: 3
- Suggested fix: Give "unavailable" its own look that doesn't depend on fading: a dashed or no border, a `surface` fill, `muted` text, and a lock or "not yet" icon, in both themes. Put the reason right next to the button ("Add a shift first", "Needs a plan"). On screen 4, whichever save button is the main action should be the filled one in both themes.

### Empty time boxes look filled in, in dark mode
- Where: 2 Details, Starts and Ends ("Pick a time"), all widths, dark
- What happens: In dark mode the hint text "Pick a time" is near-white, the same as real answers like "Sat, Nov 14, 2026". The only clue that two required boxes are empty is the line in the save bar. In light mode the grey hint is easier to tell apart, but only just.
- Who it hurts: Teacher with a 30-minute lunch and the PTO president. They scan the form, think it's done, and tap "Save and continue" anyway.
- Standard: Heuristic 1; WCAG 1.3.1 and 3.3.2 (the box's state should be clear), heuristic 5 (error prevention)
- Severity: 3
- Suggested fix: Don't put the instruction inside the box. Leave empty boxes blank or show a clock icon, and put "Pick a time" as hint text under the label. If hint text inside the box stays, make it noticeably dimmer than real answers in both themes. That needs a muted color for dark mode, even though the dark-mode "no grey text" rule would have to allow it here.

### Phone step bar shows progress by color only
- Where: Step bar on 3, 4, 6, and 8, phone (light and dark)
- What happens: On tablet and desktop each step says "done", "now", or "needs a plan". At 390 px those words disappear. Only a green, dark-blue, or grey bar is left to show which step is done, which is current, and which is blocked. On screen 8 (phone) the reason Publish is grey (it needs a plan) is gone from the bar.
- Who it hurts: Busy mom / PTO president on her phone, the main phone user for setup, and anyone who is color-blind. In bright light, green and dark blue are hard to tell apart.
- Standard: WCAG 1.4.1 (use of color); heuristic 1
- Severity: 3
- Suggested fix: Keep a word or icon on phone too: a ✓ before finished step names, "now" under the current one, and a lock or "needs a plan" under a blocked one. If space is tight, stack each step's name over its status, or swap the bar for one line: "Step 2 of 3: Jobs and shifts · Details ✓".

### Account link missing from the phone header
- Where: Every screen with the app header, phone width (light and dark)
- What happens: The header shows "My events" and "Volunteer tracking". "Account" is cut off with no menu to reach it. That's where plans and billing live, which is exactly what screens 1 and 8 point people to.
- Who it hurts: PTO president on her phone who hits the plan limit and wants to add a plan. Also anyone trying to sign out.
- Standard: WCAG 1.4.10 (reflow: content lost at narrow width); heuristic 3 (user control)
- Severity: 3
- Suggested fix: Below about 480 px, put the nav links behind a menu button (44 × 44 px) that lists all three links. Or shorten the brand mark to one line and let the links wrap to a second row. Make every header link at least 44 px tall on phone.

### Small tap targets on phone
- Where: 4 Editing a job, the "×" on the "Maria Lopez" lead chip (about 10 px), the Edit and Delete text links on shift rows, and "+ Add a lead". 6 Ready to publish, the "Keep sign-up closed for now" checkbox (about 14 px on phone; light grey and filled in dark). The inline "preview it" (4) and "Finish it" (7) links. The header links (all screens).
- What happens: These are text-sized controls, well under 44 px and some under the 24 px minimum. Delete sits right next to Edit.
- Who it hurts: PTO president in the car line, one-handed. She could easily remove a lead by mistake, or tap Delete when she meant Edit.
- Standard: WCAG 2.5.8 (target size minimum); house target 44 × 44 px
- Severity: 3 for the chip × and Edit/Delete; 2 for the others
- Suggested fix: Give the chip's remove button a 44 px hit area (pad it out invisibly, or use a "Remove" text button on phone). Make Edit and Delete 44 px tall with at least 8 px between them, or put them in one "Edit shift" view where Delete sits at the bottom. Draw the checkbox at 20–24 px with the whole label tappable, and use the brand style in both themes. Give inline links extra padding above and below on phone.

### Edit and Delete line up differently from row to row
- Where: 4 Editing a job, Parking shift list (desktop side panel and phone). 6 Ready to publish, "Before the day" panel (desktop only)
- What happens: On screen 4 the first shift has "Edit" on the right of its row. The second shift's "Edit" and "Delete" wrap onto their own line and move left. On screen 6 (desktop), "Invite" sits on the right of its row, but "Add" and the "On for you" pill drop below their labels and indent. Tablet and phone line these up correctly, so it's the narrow side column causing it.
- Who it hurts: Organizer at a laptop and the front office. Actions jump around, so you have to look for them on every row.
- Standard: Heuristic 4 (consistency); Gestalt alignment
- Severity: 2
- Suggested fix: Use one row layout everywhere: label and details on the left, actions in a fixed right-hand slot that never wraps. In the 20rem side column, either stack every row the same way (actions always on their own line, left-aligned) or widen the column. Don't mix the two layouts.

### Screen 4 shows a different job's panel next to the one being edited
- Where: 4 Editing a job. On desktop, the right column. On tablet and phone, the card below the form.
- What happens: The selected job tab is "Face painting", but the side card shows "Parking" with its shifts. On tablet and phone it sits right under the Face painting form, so it looks like Face painting's shift list. On desktop it reads as a summary, but nothing says why Parking is the one shown.
- Who it hurts: Organizer at a laptop and PTO president. They may edit or delete a Parking shift thinking it belongs to Face painting.
- Standard: Heuristic 8 (minimalist design), Gestalt proximity; heuristic 1
- Severity: 3
- Suggested fix: Show only the selected job's content in the edit area. If a summary of other jobs helps, put it in the job tabs (shift counts are already there) or in a clearly labeled "Other jobs" section with a different look, set apart from the form by a heading. On phone, never stack another job's card directly under the form.

### Save bar buttons wrap and crowd on phone
- Where: 4 Editing a job, save bar, phone (light and dark)
- What happens: "Save as draft" and "Save and mark ready" are squeezed side by side, each wraps onto two lines, and the text sits off-center near the top edge. In real use this bar is pinned to the bottom of the screen, so it will cover part of the form and must never cover the box someone is typing in.
- Who it hurts: PTO president on a phone. Cramped, two-line buttons are slow to read and easy to mis-tap.
- Standard: WCAG 2.4.11 (focus not hidden, for the pinned bar); heuristic 8
- Severity: 2
- Suggested fix: At phone width, stack the two buttons full width, main action on top, each on one line, or shorten the labels ("Save draft", "Mark ready"). Keep the "What's left" line above them. When pinned, give the page bottom padding equal to the bar's height and scroll the focused box clear of it.

### Picker cards don't look tappable, and one looks already chosen
- Where: 1 Type picker, all widths
- What happens: The four cards have no button, arrow, or hover cue. In light mode three of them have a faint hairline border (about 1.3:1 against white). Parent-teacher conferences has a dark border, so it looks already picked rather than just "available". The badges also differ: "Volunteer event" has a lock icon, while Band contest and Family visitor day show the same badge without one. On desktop, the Volunteer event badge spills past the card's right edge and is cut off ("publish with a plar").
- Who it hurts: Teacher with a 30-minute lunch and the organizer. They don't see that the card itself is the button, may think conferences is already chosen, and see a broken-looking badge.
- Standard: WCAG 1.4.11 (non-text contrast of control boundaries); heuristic 4 (consistency); WCAG 1.4.10 (content clipped)
- Severity: 3 for the clipped badge and the unclear selection; 2 for the card cues
- Suggested fix: Give every card the field-border edge (#5F6D77, about 5.3:1), plus a chevron or a "Choose" line at the bottom, and a hover and focus state. Show nothing as selected before a choice. Use one badge design on all three plan-locked cards (with the lock icon). Let the badge wrap inside the card, or shorten it ("Publish with a plan") so it fits at 4 columns. Below about 1100 px, drop to 2 columns.

### Preview banner can scroll away
- Where: 5 Preview, all widths
- What happens: "Preview only…" is the only page-wide signal, and it sits at the top of the page. On a real event with many jobs it scrolls off. After that, the ready jobs (Parking) look exactly like the live page. The marking is also uneven: Parking (ready) has no preview marking at all, while the draft jobs get dashed borders. In dark mode the banner flips from dark brown to bright amber, so the two themes look quite different.
- Who it hurts: Organizer and job lead. Partway down, they can forget it's a preview and share a screenshot or the link thinking it's live.
- Standard: Heuristic 1; brief requirement that it be clear it's only a preview
- Severity: 2
- Suggested fix: Pin the banner to the top (or bottom on phone) for the whole preview, compact once scrolled ("Preview · Close"). Add a faint "Preview" label to the event header card too. Keep the banner's weight the same in both themes (for example a `warning-soft` fill with `warning` text and border in both).

### The main action is below the fold on phone (screen 6)
- Where: 6 Ready to publish, phone (light and dark)
- What happens: At 844 px tall, the title, draft pill, date, an outlined "Event settings" button, the step bar, stats, and four list items all sit above "Publish and open sign-up", which starts at about y = 960. The first button you see is "Event settings". DESIGN.md says the publish bar should always be on screen, pinned to the bottom on a phone.
- Who it hurts: PTO president on her phone. She has to scroll to find the one thing this screen is for, and the first button she sees isn't it.
- Standard: House rule "Action over information"; DESIGN.md Setup pages rule 9
- Severity: 2
- Suggested fix: On phone, pin a bottom bar holding "Publish and open sign-up" (and "Preview"), as the house pattern says. Move "Event settings" below the main card, or make it a text link, on phone.

### A new stepper and status style that differs from the house setup pattern
- Where: 2–4, 6, 8 (step bar and job tabs); pills across screens
- What happens: DESIGN.md describes setup pages built from numbered `SetupStep` accordions with a ✓ "Done" / "Needs to be done" and tabs with a ✓ or a yellow dot. This mock-up adds a new 3-segment progress bar, card-style job tabs with pills, and three pill styles: outlined neutral ("Draft: only your team can see this"), soft-filled color ("Ready", "Draft · hidden"), and solid filled ("Live · sign-up open"). The headings render at about 700 weight, against the spec's 500 for page titles. That's probably the mock-up's font, not Inter.
- Who it hurts: Organizer at a laptop who also uses Band Registration or Conference setup. The same idea (status, progress) looks different from page to page.
- Standard: Heuristic 4 (consistency); DESIGN.md Setup pages, Type
- Severity: 2
- Suggested fix: Either update DESIGN.md so this stepper and pill set become the new standard for all setup pages (and log that decision), or build them from the existing `StepStatus` and `SetupTabs` pieces. Settle on one pill recipe (for example soft fill, colored text, and border for every status, with solid fill reserved for none). Build the headings in Inter at the specified weights.

### Faint borders on dashed and outlined cards in dark mode
- Where: 3 "Start from a past event" (dark), 6 and 7 "Event day" (dark), 5 draft job outlines (dark), 2 and 6 inactive step-bar segments (dark)
- What happens: The dashed borders and the unfilled step segments use the dark `border` color (#253A51) on the #06121F background, roughly 1.5:1. The cards and the "not done yet" steps almost blend into the page.
- Who it hurts: Organizer at night in dark mode, and anyone with low vision. They miss the "copy last year" option and can't see how many steps remain.
- Standard: WCAG 1.4.11 (non-text contrast) where the border is the only cue
- Severity: 2
- Suggested fix: Use the dark field-border (#5F7489) for dashed cards and unfilled step segments in dark mode, and the light field-border in light mode for the step bar's grey segments too.

## Working well
- One clear filled main button per screen in light mode ("Save and continue", "+ Add a job", "Publish and open sign-up", "Copy link", "See what's included"), with outlined secondary actions next to it
- Status always has words ("Ready · 2 shifts", "Draft · needs a shift", "Live · sign-up open", "Draft · volunteers won't see this"), not just color, on tablet and desktop
- The phone job picker becomes a labeled dropdown with status in the text instead of squeezing tabs, a good adaptation
- No sideways scrolling at 390 px on any screen
- The save bar's "What's left" line (dot plus words) is a strong, consistent status pattern on screens 2 and 4
- The draft and preview treatment (amber soft panel, eye-off icon, dashed outline) is easy to recognize and carries from screen 4 through 5 to 7
- Tablet layouts are the most polished: rows line up, actions sit in a consistent right-hand slot, and the cards reflow to two columns cleanly
- Dark mode generally keeps text at full strength, and the success, warning, and brand colors read well on the dark surfaces

Screenshots opened: all 48 (1–8, each at phone, tablet, and desktop, in both light and dark).
