# UI Designer

## Headline
Version 3 looks calm, consistent, and on-brand. The cards, outlined secondary buttons, status badges, and the light and dark themes all follow the house look, and most screens make the next action easy to spot. The real problems are a few layout bugs and two dark-mode gaps. On phones, the "Draft" badge pushes five pages sideways. On desktop, a status badge spills out of its card. In dark mode, disabled buttons and empty boxes look exactly like working buttons and filled-in boxes. Beyond those, the main things to tidy are where the main button sits, how the lock and amber colors are used, and how row actions are laid out.

## Findings

### The "Draft" badge makes five phone pages scroll sideways
- Where: 06 jobs-empty, 12 ready, 13 ready-none, 14 ready-vlead, 21 blocked. Phone only, light and dark.
- What happens: the badge "Draft · Hosts, Co-hosts, and Volunteer Leads only" stays on one line, so it runs past the right edge. These five phone shots are 404 px wide instead of 390, and you can see the badge cut off against the edge in 06 and 12. The whole page can drift sideways under a thumb.
- Who it hurts: the PTO president and the teacher, who set things up on a phone. The page wobbles sideways while they scroll, and the end of the badge is cut off.
- Standard: WCAG 1.4.10 Reflow (no sideways scrolling at 320 px)
- Severity: 3
- Suggested fix: let the badge wrap (`whitespace-normal`, `max-w-full`), or shorten it on phones to "Draft · team only" and give the full text to screen readers. Check every screen again at 320 px.

### A badge spills out of its card on desktop
- Where: 03 picker-ended, the "Parent-teacher conferences" card. Desktop only, light and dark.
- What happens: the grey badge "Fall conferences runs until Feb 12" is wider than the narrow card in the three-across layout, so it runs past the card's right border into the gap. It sits on the one card that matters most on this screen.
- Who it hurts: the organizer at a laptop. It looks broken right where the screen explains the plan limit, which hurts trust.
- Standard: WCAG 1.4.10 / 1.4.12 (content cut off or overlapping); consistency
- Severity: 3
- Suggested fix: let badges wrap inside their card (`max-w-full`, normal wrapping). Or use the two-across layout from the tablet view at desktop width as well, so these cards are never this narrow.

### In dark mode, disabled buttons look like working buttons
- Where: 07 job-edit, "Mark ready". 18 job-live, "Hide this job". 21 blocked, "Publish". Dark mode at every width.
- What happens: in light mode these buttons are grey with faded text, so they clearly can't be pressed. In dark mode the label is full white on the same panel color as a normal outlined button. The only remaining clues are the lock icon and the slightly thinner border. The house rule "dark mode has no grey text" removes the faded look.
- Who it hurts: the organizer and PTO president working at night in dark mode. They tap "Mark ready" or "Publish", nothing happens, and they can't tell why.
- Standard: WCAG 1.4.1 (the state is mostly carried by one visual cue); consistency with light mode; heuristic 1 (visibility of status)
- Severity: 3
- Suggested fix: give disabled buttons their own dark-mode style that doesn't depend on grey text. For example a dashed border, no outline color, and a label prefixed with the lock icon and set in the `raised` background. Keep the reason line ("Needs a plan", "You can't hide this job while...") directly underneath, as 18 and 21 already do. Add the same treatment to `globals.css` next to the opacity override.

### In dark mode, empty boxes look filled in
- Where: 07 job-edit, the "Coordinator's email" box. Dark mode, every width.
- What happens: the hint text inside the empty box is full white, the same as a typed answer. "Coordinator's email" reads like a saved value, so it isn't clear the box is empty and waiting.
- Who it hurts: the organizer and PTO president. They may think an invite email is already filled in and press "Send invite" with nothing in the box.
- Standard: WCAG 1.3.1 / 3.3.2 (a hint used as a label); consistency with light mode
- Severity: 2
- Suggested fix: never rely on hint text inside a box. Put a visible label above it ("Invite a Coordinator by email") and leave the box empty. If a hint stays, give it a dark-mode color that is clearly different from typed text while still passing 4.5:1 (for example `#B9C7D6` on `#06121F`). That means agreeing a small exception to the "no grey text" rule.

### A failed save looks almost the same as a successful one
- Where: 19 job-live-error, the bottom bar. All widths, worst in dark mode.
- What happens: "Couldn't save..." sits in the same plain white (or navy) bar as "All changes saved" in 18. The only difference is a small red dot. DESIGN.md asks for a light red note for this kind of warning, but it isn't used here.
- Who it hurts: the PTO president on a weak phone signal and the organizer who glances away. A failed save is easy to read as "saved", and they lose changes they think they made.
- Standard: WCAG 1.4.1 (the alarm is mostly color); DESIGN.md setup rule 7 (`border-danger/30 bg-danger/5`); heuristic 1
- Severity: 3
- Suggested fix: use the light red note style for the bar with a warning icon instead of the dot, and start with a bold lead-in ("Not saved."). Announce it with role="alert". In dark mode use a tinted red surface, not the plain panel.

### Too many filled buttons compete on one screen, and none on another
- Where: 08 job-items ("Continue to publish" at the top and "Mark ready" at the bottom are both filled). 19 ("Save shift" and "Try again" both filled). 03 picker-ended and 13 ready-none (no filled button at all).
- What happens: the eye has two equal targets in 08 and 19 and none in 03 and 13. In 13, the quickest win ("Mark it ready" on the job that's ready) looks the same as "Finish Litter pickup". In 03, the one event type that can still be published (conferences) looks the same as the two that can't.
- Who it hurts: the teacher with 10 minutes and the PTO president. They have to stop and work out which button moves them forward.
- Standard: action over information (standards.md); heuristic 8
- Severity: 2
- Suggested fix: allow one filled button per view. In 08, make "Continue to publish" an outlined button or a link while a job is open, and keep "Mark ready" filled. In 19, while the field has an error, make "Save shift" outlined or wait to enable it, and keep "Try again" filled. In 13, fill "Mark it ready". In 03, fill "Set up conferences".

### The lock icon and the amber color each mean too many things
- Where: 02 ("Try it" badge: lock icon, amber). 03 ("Publishing needs a plan": lock icon, grey). 05 and 21 ("Needs a plan": lock, amber). 07, 18, and 21 (disabled buttons: lock). 07, 08, and 10 ("Hidden" badges and the preview bar: amber).
- What happens: the lock shows up on something you're invited to try ("Try it"), on something you can't publish, and on a button that's waiting for a shift. Amber also means "try it", "hidden", "needs a plan", "sign-up closed", and "preview". A padlock on "Try it" tells people "you can't" right where the screen means "go ahead".
- Who it hurts: the organizer at a laptop, who learns the icons and colors and then sees them mean something else.
- Standard: consistency and standards (heuristic 4); DESIGN.md (warning = "needs attention")
- Severity: 2
- Suggested fix: keep the lock only for "needs a plan". Give "Try it" a neutral or `accent-soft` badge with a sparkle or beaker icon. Leave the lock off disabled buttons and rely on the reason line beneath. Keep amber for things that need action (hidden, needs a plan). Show the preview bar in `brand-soft` with an eye icon so it doesn't look like a warning.

### Row actions sit in different places from screen to screen
- Where: phone in 08 ("Edit" under each item), 09 ("Edit" on its own indented line), 12, 15, and 17 ("Invite" on the right but "Add" and "Change" dropped to an indented second line), 18 ("Edit" on the right), and 21 (all on the right). Desktop side panel in 12, 15, 17, and 21 ("Add" and "Change" wrap under the label while "Invite" and "Open" stay on the right). 20 ("Remove" is a blue link).
- What happens: the same kind of row lays out three different ways, and the links that drop to a second line are indented 12 px off the text edge. Underlined text links like "Edit", "Add", and "Remove" are about 20 to 24 px tall on phones. That's below the 44 px house target, and on 08 phone it's about 33 × 24 px. "Remove" in 20 takes someone off a shift but is styled like an ordinary link.
- Who it hurts: the volunteer parent and PTO president on a phone (small targets, one hand). The organizer reads the layout as messy.
- Standard: WCAG 2.5.8 (target size; we aim for 44 px); DESIGN.md "Touch targets at least 44×44px"; DESIGN.md setup rule 8 (destructive means red); consistency
- Severity: 2
- Suggested fix: make one row component: label (and status) on the left, the action on the right, and the action sitting on the same line as the label, never wrapped. Give each action at least a 44 × 44 px hit area with padding. Line it up with the text edge, with no extra indent. Make "Remove" red ("Remove from shift"). In the narrow desktop side panel, shorten the labels ("Maps and documents", "Daily sign-up email: on") so the action fits.

### Page width jumps between steps of the same flow
- Where: desktop. 04, 05, and 09 use a narrow column of about 728 px. 01–03, 06–08, and 10–21 use about 1088 px. 01–03 desktop also leaves the included types in a three-card row about 812 px wide while the "Interested in more?" panel is 1088 px.
- What happens: the stepper and the back link jump sideways and stretch when you move from step 1 (Details) to step 2 (Jobs), and the same "New shift" form is shown at two widths (07 compared with 09). On the picker, the top cards stop short of the panel below, so the right edge looks ragged.
- Who it hurts: the organizer at a laptop. The layout shifts under them, so it feels like moving to a different tool.
- Standard: consistency (heuristic 4); aesthetic and minimalist design (heuristic 8)
- Severity: 1
- Suggested fix: use one page width for all of setup (1088 px). Keep forms in a readable column inside it if you want, but anchor the stepper and the title to the same edges on every step. On the picker, use a four-column grid for both sections, or make the "more" panel the same width as the cards above it.

### The status badge isn't lined up in the publish bar
- Where: 17 live-closed, tablet and desktop, light and dark.
- What happens: "Published · Sign-up closed" sits at the top of the bar while the buttons are centered, about 10 px off. In 15 the same bar is centered. The closed badge also loses the check icon that the open badge has, so the two states look like different components.
- Who it hurts: the front office and the organizer glancing at status. It's a small polish issue, but status needs to read at a glance.
- Standard: consistency; WCAG 1.4.1 (an icon plus a word helps status not rely on color)
- Severity: 1
- Suggested fix: center the badge vertically in the bar (`items-center`) and give the closed state its own icon (a pause or closed-circle), so both states show icon, word, and color.

### On phones, the "Preview only" bar scrolls away
- Where: 10 preview and 11 preview-coord, phone (full page 1067 px). Also tablet when the page is long.
- What happens: the amber "Preview only" bar is only at the top. Once you scroll to the jobs, nothing on screen says it's a preview except the dashed borders on the hidden jobs. The shown job (Parking) looks exactly like the live page.
- Who it hurts: the organizer and Coordinator, who might screenshot or share what they think is the live page. The brief requires that "it must be clear that it's only a preview".
- Standard: heuristic 1 (visibility of status); WCAG 2.4.11 (if pinned, it must not cover the focused item)
- Severity: 2
- Suggested fix: pin a compact preview bar (about 44 px: "Preview only" plus "Back to jobs") to the top on every width, and leave matching padding at the top of the page so it never covers focused content. Optionally add a faint "Preview" tag to each shown job card too.

### The phone stepper labels crowd together, and the save bars don't match
- Where: phone, 04, 06–08, 12, 13, and 21 (stepper). 12 phone ("Publish and open sign-up" bar) compared with 07 and 08 (full-width buttons).
- What happens: "Jobs and shifts" and "Publish" nearly touch (about 8 px apart), and "Needs a plan" wraps to two lines under Publish in 05 and 21. The pinned action bar on phones has full-width buttons on job screens but a centered, auto-width button on the publish step.
- Who it hurts: the PTO president on a phone. It's hard to read at a glance, and the bottom bar shifts from screen to screen.
- Standard: consistency; aesthetic and minimalist design
- Severity: 1
- Suggested fix: on phones, show only the current step's name under the bars ("Step 2 of 3: Jobs and shifts" is already above them) and use a ✓ or a lock for the others. Make every pinned phone action bar use full-width buttons.

### Small mismatches in the dialog and link styles
- Where: 16 unpublish (all widths). Links across screens.
- What happens: the dialog corners look about 12 px, while DESIGN.md asks for 24 px (`xl`) on dialogs. Some inline links are bold ("Preview the sign-up page", "Edit") and others are regular ("preview it", "See who", "Directions") with no clear reason.
- Who it hurts: no one is blocked. The product just reads as a little less finished.
- Standard: DESIGN.md radius and type tokens; consistency
- Severity: 1
- Suggested fix: use `rounded-xl` for the dialog. Make inline links inside sentences regular weight and standalone action links semibold (600), and apply that everywhere.

## Working well
- The two-color system works. Deep blue for actions and selection, green for done and live, and amber for hidden all carry a word too ("Ready · 2 shifts", "Hidden · needs a shift"), so status never depends on color alone.
- Light and dark themes are mostly well balanced. Cards, borders, and the light-blue primary button in dark mode read clearly, and status colors stay legible on their tinted backgrounds.
- Hidden jobs in the preview use a dashed border, an eye-slash icon, and a label. That's a strong, color-independent way to mark "volunteers can't see this".
- The job cards across the top of 07, 08, and 18 show which job is selected (filled, thicker border), and each card's status is readable at a glance.
- Buttons and form boxes are a consistent 44 px tall, the outlined secondary style is used the same way everywhere, and Unpublish and "Take it offline" are correctly red and outlined, not filled.
- The required-field asterisks, the hint text above each box, and the inline spots error in 19 (red border, warning icon, and text above the box) follow the house form pattern.
- Tablet layouts make good use of two columns (02 and 03 picker, 12 and 15 with the side panel), and the stats rows (1 / 2 / 8) give quick, scannable numbers.

Screenshots opened (126): 01-picker, 02-picker-more, 03-picker-ended, 04-details, 05-details-ended, 06-jobs-empty, 07-job-edit, 08-job-items, 09-job-multiday, 10-preview, 11-preview-coord, 12-ready, 13-ready-none, 14-ready-vlead, 15-live, 16-unpublish, 17-live-closed, 18-job-live, 19-job-live-error, 20-shift-people, 21-blocked, each at phone, phone-dark, tablet, tablet-dark, desktop, and desktop-dark.
