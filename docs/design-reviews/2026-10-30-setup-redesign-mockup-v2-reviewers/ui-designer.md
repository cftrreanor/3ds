# UI Designer

## Headline
Version 2 looks calm and on-brand. Colors, cards, and status badges mostly follow DESIGN.md, status never relies on color alone, and dark mode holds up. The problems are in the system's consistency. One screen (02) has a broken layout. The dashed outline means four different things. Page-level actions like Unpublish look the same as everyday links. And the same pieces (stepper, action rows, job switcher, publish button) change shape and position from screen to screen and between widths. Most of the tap targets for row actions are text links well under 44 px.

## Findings

### Picker with a live conference: card layout is broken
- Where: 02 picker-conf, all three widths, light and dark
- What happens: "Go to Fall conferences" and "Set up →" have fallen outside the Parent-teacher conferences card and sit loose in the grid as if they were cards themselves. On desktop they float in the empty 2nd and 3rd columns, and the Volunteer event card gets pushed to column 4. On phone a bare black "Set up →" sits between two cards with no clear owner. The "Fall conferences is live. Unpublish it to publish another." badge wraps to 2–3 lines inside a pill, and on desktop the text runs into the rounded ends. The lock icon is also missing from the Volunteer event badge, and the other five event types are gone (in 01 they all show).
- Who it hurts: Organizer at a laptop and Teacher with a 30-minute lunch. The one thing they need here (get back to their live conference) looks like a stray link, and the page looks broken, which hurts trust.
- Standard: Consistency and standards; WCAG 1.3.1 (the visual grouping doesn't match what belongs together); DESIGN.md "Actions where the thing lives"
- Severity: 3
- Suggested fix: Put both actions inside the conference card, in its footer row where "Set up →" sits on the other cards: "Go to Fall conferences" as the card's main link, and "Set up" removed or disabled with a reason. Move the long sentence out of the pill into a short note in the card body (warning-soft panel, 8 px radius) and keep the pill short ("1 live now"). Show all seven cards as in 01, and keep the lock icon on every "Publishing needs a plan" badge.

### Unpublish and Close sign-up look like everyday links
- Where: 12 live, "Sign-up and page" panel, all widths and modes
- What happens: "Close sign-up" and "Unpublish" use the same small underlined link style as "Invite" and "Add", in the same kind of row, in the same panel as the optional "Before the day" tasks. Nothing marks them as going-live controls or as actions that take the page away from volunteers. On desktop "Close sign-up" drops onto its own line while "Unpublish" sits beside its label, so the two rows don't even line up.
- Who it hurts: Organizer and PTO president. In a hurry, either could tap Unpublish as if it were a routine settings link, and without a plan it can't be undone. Front office staff on a shared login could do the same.
- Standard: DESIGN.md Setup pages #8 (destructive means red) and #9 (going live is a separate outlined bar that's always on screen); Error prevention
- Severity: 3
- Suggested fix: Pull Close sign-up and Unpublish out into their own outlined "Publishing" bar (pinned under the title on a computer, at the bottom on a phone), as DESIGN.md says. Make them real 44 px buttons: secondary style for Close sign-up, red outline with the warning text right beside it for Unpublish. Keep "Before the day" as its own card.

### The dashed outline means four different things
- Where: 05 (past-event card), 06 and 14 (disabled Mark ready and Hide this job), 08 and 09 (hidden-job cards and "Opens when published" buttons), 10 (Event day card), 11 (Publish placeholder), 15 (disabled Publish), all widths and modes
- What happens: The preview banner tells people "Hidden jobs have a dashed outline", but the same page also uses dashed outlines on the "Opens when published" buttons inside the visible Parking card. Elsewhere, dashed means "disabled button", "optional shortcut", or "comes later". The one visual signal that's supposed to mean "volunteers can't see this" is used all over the product for other things.
- Who it hurts: The Organizer checking the preview can't trust the cue the banner tells them to look for. The Volunteer parent is affected too: if dashed means "not available" to the organizer, they may be less careful about which jobs really go live.
- Standard: Consistency and standards; WCAG 1.4.1 (the outline style alone carries meaning)
- Severity: 3
- Suggested fix: Use the dashed outline only for "hidden from volunteers". Disabled buttons get a solid border, a muted fill, and a lock or info icon with the reason next to them. Shortcut and later-step cards (past event, Event day, Publish placeholder) use the normal solid hairline card on surface fill. In the preview, also put the "Hidden from volunteers" badge with an eye-off icon in the top-left of each hidden card, so the meaning doesn't rest on the outline.

### Row actions are small text links, with Delete right next to Edit
- Where: 06 (chip ×, Cancel), 07 (Edit), 10/12/15 (Invite, Add, Open, Close sign-up, Unpublish), 14 (Edit, Delete, Cancel), and the stepper's "✓ Done" / "Ready to go" links on 05–11 and 15; worst on phone
- What happens: These are underlined text links about 20 px tall, sometimes with a 16–24 px gap between them. On 14 at phone width, "Edit" and "Delete" sit side by side under the shift. The × on the "Maria Lopez · Invited" chip is roughly 16 px. The stepper sub-labels ("✓ Done") are about 12 px text, and the links are about 16 px tall.
- Who it hurts: The PTO president and the Teacher, editing on a phone one-handed, could hit Delete when they meant Edit. The Front office administrator gets slow, fiddly targets.
- Standard: WCAG 2.5.8 (24 px minimum, and we aim for 44 px); DESIGN.md Accessibility (touch targets at least 44×44)
- Severity: 3
- Suggested fix: Make row actions 44 px tall tertiary buttons (padding, no fill), or make the whole row the tap target, with the action label on the right. Put at least 8 px of space between Edit and Delete, or move Delete into the edit panel. Make the chip × a 44 px hit area. In the stepper, make the whole segment (label plus bar) the link, at least 44 px tall.

### The same pieces change shape and position from screen to screen
- Where: stepper on 03, 05, 06, 10, 11, 15 (missing on 04, 07, 14); publish button on 10 vs 15; action rows on 07, 10, 12, 14; Event settings button on 10, 12, 15 vs 11, 13
- What happens:
  - The stepper header reads "Step 2 of 3: Jobs and shifts" on some screens and "2 of 3 steps done" on others. On 06 the current step isn't a link, but on 11 it is. On 07 and 14 the stepper disappears even though they show the same job editor as 06.
  - On phone 10, "Publish and open sign-up" sits in a separate bottom box, below Event day and Before the day, about 700 px from the "Ready to publish" card it belongs to, and it isn't full width (other phone footers are). On tablet and desktop the same button sits inside the card. On 15 it's in the card at every width.
  - In action rows, the action sometimes sits to the right of the label and sometimes wraps underneath: 07 phone "Bottled water" vs "Trash bags", 14 phone first vs second shift, 12 desktop "Close sign-up" vs "Unpublish".
  - "Event settings" shows as both a top button and a row on 10 (tablet/desktop), 12, and 15. It's missing from 11 and 13.
- Who it hurts: The Organizer who sets up 1–2 events a year can't rely on things being where they were last time. The PTO president picking up where she left off has to hunt for them.
- Standard: Consistency and standards; Recognition rather than recall; DESIGN.md Setup pages
- Severity: 2
- Suggested fix:
  - Use one stepper on every setup screen, including 04, 07, and 14, with one header pattern.
  - Use one publish placement: inside the Ready card on wide screens, and as a pinned, full-width bottom bar on phone. Don't use an unpinned box at the end of the page.
  - Use one action-row layout: label on the left, action on the right, vertically centered. It wraps under the label only when the label is longer than one line, and then for every row in that list.
  - Show "Event settings" once, as the header button, on every event-level screen.

### On phone, the job switcher turns into a dropdown that hides every other job's status
- Where: 06, 07, and 14 at phone width, light and dark
- What happens: On tablet and desktop, jobs show as tabs with a green "Ready" or amber "Hidden" badge each. On phone they collapse into one closed dropdown ("Litter pickup · Hidden, add a shift ▾"). It looks exactly like a text box, and the status of every other job is out of sight. On 07 the label wraps to two lines inside it.
- Who it hurts: The PTO president, who works mostly on her phone and needs to see that "nothing is falling through the cracks". She can't tell at a glance which jobs are still hidden.
- Standard: Recognition rather than recall; Visibility of system status; DESIGN.md Setup pages #2 ("tabs with a green ✓ or a yellow dot")
- Severity: 2
- Suggested fix: On phone, keep the job tabs as a row that scrolls sideways (with a partly cut-off last tab as a cue that there's more), or as a short stacked list of job rows with their status badges above the editor. If it stays a dropdown, style it as a selector (filled surface, chevron button, status badge inside) rather than a text box.

### Badges look like buttons and break the badge rules
- Where: "Draft event: only your team can see it" on 05, 10, 11, and 15; "Publishing needs a plan" on 01; the status badges on 02, 06, 07, and 14; all widths
- What happens: Badges are fully rounded pills with a dark 1 px outline and bold text. That's very close to the outlined secondary buttons ("+ Add a job"), so the Draft badge reads as tappable. DESIGN.md says tags use the 8 px radius and keeps full pills for the home hero and header. Sentence-length badges wrap: on 01 desktop "You can publish one at a time" breaks onto two lines, and the pill bulges.
- Who it hurts: The Organizer taps a badge expecting something to happen. Wrapped pills look broken.
- Standard: Consistency and standards; DESIGN.md radius (sm 8 px for tags, pills only in the hero/header)
- Severity: 2
- Suggested fix: Make badges 8 px radius with a soft tinted fill (neutral, success-soft, or warning-soft) and no dark outline, so they can't be mistaken for buttons. Limit them to 2–4 words. Move longer explanations into a line of body text next to the badge.

### On 06, "Continue to publish" outshouts the job being edited
- Where: 06 job-edit, all widths and modes
- What happens: The green "1 job is ready" banner with a filled primary "Continue to publish" button sits above the h1 and is the strongest thing on the page. The task on screen is finishing the hidden Litter pickup job, but the save bar for that job has no filled primary at all: "Save, keep hidden" is outlined and "Mark ready" is dashed and disabled. On phone, the disabled Mark ready sits above Save. On desktop, the order is reversed.
- Who it hurts: The Organizer may jump to publishing halfway through an edit and leave this job's changes unsaved. The Teacher in a rush follows the loudest button.
- Standard: Action over information; Consistency and standards; DESIGN.md Setup pages #9 ("while something is being edited its buttons wait")
- Severity: 2
- Suggested fix: While a job form has unsaved changes, drop "Continue to publish" to a secondary or text style, or replace it with "Save or cancel your changes first, then publish." Make the job's own save the filled primary in the pinned footer. Use the same button order at every width, with the main action last on wide screens and first on phone.

### Dark mode: the unchecked checkbox and radio look filled
- Where: 03 (Ends on a different day) and 10 (Later radio), dark mode, all widths
- What happens: The unchecked checkbox and unselected radio show as solid grey shapes (the browser's default dark style) instead of an outlined box or circle. A filled radio reads as "selected" or "disabled". It also doesn't match the light-blue selected radio beside it.
- Who it hurts: The Organizer working late at night in dark mode (the PTO president) may misread which option is picked.
- Standard: WCAG 1.4.11 (control states must be distinguishable); Consistency
- Severity: 2
- Suggested fix: Style the checkbox and radio yourselves, or set `accent-color` and `color-scheme` so unchecked controls show a 2 px border in the field-border color (#5F7489 in dark mode) on the input background, with the primary color only when checked.

### Grey text in dark mode, and a dim "disabled" look
- Where: helper text ("Pick a time", "Optional", "Leads see who signed up…"), card descriptions on 01, "Opens when published" on 08/09, disabled buttons on 06/14/15; dark mode, all widths
- What happens: DESIGN.md says dark mode has no grey text (supporting text is white). The mock-up uses a light grey for hints and descriptions. The disabled buttons use a mid grey on navy that looks close to or below 4.5:1, yet "Opens when published" is information volunteers would actually read.
- Who it hurts: The Volunteer parent and the Organizer on a phone in low light. The front office on an older monitor.
- Standard: WCAG 1.4.3; DESIGN.md Dark theme
- Severity: 2
- Suggested fix: Use the dark muted token (white) for hints and descriptions in dark mode. For status that has to be read, like "Opens when published", show it as plain text with an icon rather than a faded button, at 4.5:1 or better in both modes.

### The "Preview only" banner will scroll away
- Where: 08 preview and 09 preview-lead, mainly phone (full-page shots of about 1,100 px)
- What happens: The banner that says this is only a preview, and holds "Back to jobs" / "Close preview", sits at the top of the page in normal flow. Once you scroll, the preview looks just like the real volunteer page. Only the small "· Preview" next to the organization name remains.
- Who it hurts: The Organizer or Lead may screenshot it, or think it's live and share it. The rule says it must be clear that it's only a preview.
- Standard: Visibility of system status; WCAG 2.4.11 (if pinned, it must not cover focused items)
- Severity: 2
- Suggested fix: Pin a slim version of the banner (about 48 px: "Preview only" plus the close button) to the top on every width. Also add a light diagonal "Preview" watermark, or a warning-colored side border, around the page content.

### Editing a live job gives no live cue and has no save bar
- Where: 14 job-live, all widths and modes
- What happens: Nothing on the page says the event is live and that changes reach volunteers right away. There's no "Live" badge, banner, or stepper. Unlike 06 and 07, there's no pinned save bar, so a change to the Job name has no visible save. The shift being edited still shows its "Edit" link instead of an "Editing" state.
- Who it hurts: The Organizer making a quick fix on a live event. The Front office administrator, who gets interrupted and comes back unsure what's saved.
- Standard: Visibility of system status; Consistency (same editor as 06/07)
- Severity: 2
- Suggested fix: Add the green "Live · sign-up open" badge next to the h1, plus a one-line note ("Changes show to volunteers as soon as you save"). Bring back the same pinned save bar as 06/07. Swap the row's "Edit" link for an "Editing" label while its panel is open.

### Error state and blocked state lose their main structure
- Where: 04 details-errors (all widths); 15 blocked (all widths); 13 live-closed
- What happens:
  - On 04 the h1, the stepper, and the Date, Time zone, and Where fields all disappear. The page has no heading, and the layout jumps compared with 03. The footer dot stays brown even though the banner is red.
  - On 15 the only way forward is an email address in plain body text. It isn't styled as a link or button, and the page's only button is disabled.
  - On 13 everything below the status card is gone, including Event settings and Volunteers.
- Who it hurts: The Organizer after a failed save, who needs the same page with the problems marked, not a different page. The Teacher who's blocked and needs a clear next step.
- Standard: WCAG 1.3.1 and 2.4.6 (one h1, headings); Consistency; Action over information
- Severity: 2
- Suggested fix:
  - On 04, keep 03's full layout and add the error banner and red outlines on top of it. Turn the footer status dot and text red ("Fill in the 2 boxes outlined in red").
  - On 15, make the email a real mailto link, or better, a secondary "Email us about a plan" button next to the disabled Publish.
  - On 13, keep the same panels as 12 below the card.

### Smaller visual polish
- Where: various
- What happens:
  - The lock appears as a color emoji (🔒) in the stepper and under the disabled button on 15, but as a line icon in the banner and on 01.
  - "Edit this job" (08), "View the sign-up page" (12), and "Preview sign-up page" (10, 15) start about 8 px to the right of the content's left edge.
  - On 14 the Spots hint is boxed to the input's width, so "up" wraps onto its own line even on desktop.
  - The screenshots render in a wide fallback font, not Inter, and the h1s look about 700 weight against DESIGN.md's 500. Line breaks and widths in the real build will differ.
- Who it hurts: Everyone a little. It makes the product feel less finished.
- Standard: Consistency; DESIGN.md Type
- Severity: 1
- Suggested fix:
  - Use one line-icon lock everywhere.
  - Line up text links with the content's left edge.
  - Let hint text use the full form width.
  - Re-shoot the screenshots with Inter loaded and h1 at weight 500 before the build review, and recheck wrapping on the picker cards.

## Working well
- Status always has a word next to the color: Ready/Hidden badges, "Live · sign-up open", "✓ Done", and red error text with a ⚠ icon.
- Required-field errors (04) put red outlines, an icon, and a specific message right at each field, in both modes.
- The color palette is restrained and on-token: one deep blue for actions, warm amber only for "needs attention", and green for done or live. Dark mode keeps the same structure with good contrast for body text and buttons.
- Most cards, inputs, and buttons are a solid 44 px with consistent corner rounding. Filled primary versus outlined secondary is clear on 07, 10, 12, and 13.
- Desktop layouts on 10, 12, and 15 (main card plus a narrow side panel) use the width well and fold cleanly to one column on phone with no sideways scrolling.
- The Ready card's big numbers (2 / 4 / 20) and the selectable radio cards (Now / Later) are easy to scan.
- The live link box in mono with a filled "Copy link" makes the main action after publishing obvious.

Screenshots opened (90): 01-picker, 02-picker-conf, 03-details, 04-details-errors, 05-jobs-empty, 06-job-edit, 07-job-items, 08-preview, 09-preview-lead, 10-ready, 11-ready-none, 12-live, 13-live-closed, 14-job-live, 15-blocked, each at phone, phone-dark, tablet, tablet-dark, desktop, and desktop-dark.
