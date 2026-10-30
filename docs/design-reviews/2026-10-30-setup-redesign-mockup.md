# Design review: setup redesign mock-up

| | |
|---|---|
| **What was reviewed** | The clickable mock-up of the redesigned volunteer event setup: 8 screens (type picker, details, first job, editing a job, preview, ready to publish, live, plan doesn't allow) |
| **Stage** | Mock-ups, before building |
| **Widths and modes** | Phone 390, tablet 820, and desktop 1440, each in light and dark (48 screenshots in `2026-10-30-setup-redesign-mockup/`) |
| **Size** | Full panel (7 roles plus the consultant) |
| **Date** | 2026-10-30 |
| **Fixed rules (not reviewed)** | After a free period ends, only parent-teacher conferences can be published, one at a time. Draft jobs are hidden from volunteers, and Hosts and the job's lead can preview them, clearly marked as a preview. |

## The consultant's verdict

**Build after fixes.** The structure is right: pick a type, enter details, add jobs, then publish. The plan messaging is honest, and the preview is clear. Three things would cause real failures:
- the job editor shows another job's shifts next to the one being edited
- the jobs step has no visible way forward to publishing
- the live page drops the Unpublish and Event settings controls that the ready screen promised

**The one change that would help most:** rebuild screen 4 so it shows only the selected job, with that job's shifts inside its own form, and add a clear "Continue to publish" button.

## Blocks people (severity 3)

### 1. The plan words promise things the product can't do · found by 8 of 8
- **"Add a plan" sounds self-serve.** No one can buy a plan in the app today. Today the only path is emailing us, so "as soon as you add a plan" over-promises.
- **Three money words on one screen.** "Free period ended" sits next to "Free during the pilot", and "Your plan" is used when the account has no plan.
- **The cheaper path is never mentioned.** One-time event passes exist in the database, but no screen offers them.
- **The conference card can be wrong.** "You can publish this" shows even when a conference is already live.
- **The "add a plan" route is hidden on phone.** The Account link is missing at phone width.
- **The person who sees the block often can't pay.** For example, a PTO president needs the treasurer.
- **Fix:**
  - Describe how it really works: "Write to us and we'll reply within a day."
  - Name a pass where one is available.
  - Use one money word.
  - Add a conference badge that names the event already live.
  - Say who can add a plan ("Ask your Account Host").
  - Base every badge on the database's own answer, so screens and rules can't drift apart.

### 2. Hidden draft jobs need a real database rule, plus a preview mode · found by 5 of 8
- **The database doesn't hide anything yet.** It has no draft state for a job. Once an event is published, anyone can read every job and sign up for any shift. Hiding drafts only on the screen would leak through links, passes, and calendar files.
- **Leads see more than the rule allows.** Every lead can currently see every job, but the rule says only Hosts and that job's own lead.
- **After publishing, a Host on the public link would see drafts mixed in.** There's no preview label.
- **The mock-up only shows the Host's preview.** It doesn't show what a lead sees, or how a lead gets there.
- **Fix:**
  - Add a "ready" flag enforced in the database, everywhere "published" is enforced today, with security tests.
  - Existing jobs start as ready, so live events don't go dark.
  - Make preview its own mode, available before and after publishing, and always marked "Preview only".
  - Design the lead's version of the preview.
- **Size:** Large. This is the biggest piece of the build.

### 3. The job editor shows a different job's shifts · found by 6 of 8
- **What happens:** while you edit Face painting, a Parking card with Edit and Delete sits beside or under the form. On phone it reads as Face painting's own shifts.
- **Fix:** show only the selected job, with its shifts inside its form. *This is a mistake in my mock-up.*

### 4. No way forward from jobs to publishing · found by 3 of 8
- **What happens:** the save bar saves one job, and nothing says "Continue to publish".
- **Fix:** add a page-level "Continue to publish" once at least one job is ready, and make the steps in the progress bar into links.

### 5. Disabled buttons look usable in dark mode · found by 5 of 8
- **What happens:** "Save and mark ready" and the blocked Publish button show at full strength in dark mode. On screen 4, the button you can't use stands out more than the one you can.
- **Fix:** give disabled buttons their own look that doesn't rely on fading. Put the reason next to the button in both modes.

### 6. "Keep sign-up closed" doesn't change the button · found by 5 of 8
- **What happens:** tick the box and the button still says "Publish and open sign-up". There's no screen for "live, sign-up closed".
- **Fix:**
  - The button label follows the choice: "Publish with sign-up closed".
  - Add a "Live · sign-up closed" state with an "Open sign-up" button.
  - Or move the option to Event settings (Product Manager).

### 7. The live page drops Unpublish and settings, and unpublishing can be one-way · found by 4 of 8
- **What happens:** screen 6 promises "unpublish at any time", but screen 7 has no Unpublish, no Event settings, and no "Before the day" list.
- **Engineer's catch:** if an account's free period has ended, unpublishing a live volunteer event means it can't be published again.
- **Fix:**
  - Keep the same layout before and after publishing.
  - Add Unpublish with a confirmation that warns when the event couldn't be republished.
  - Only promise "at any time" when it's true.

### 8. Phone problems · found by 3 of 8
- **Progress shown by color only:** at phone width the step bar drops "done" and "now", leaving only color (WCAG 1.4.1).
- **Account missing:** the Account link disappears with no menu.
- **Small tap targets:** the lead chip's × is about 10 px, the Edit and Delete links sit side by side, and the checkbox is small.
- **Fix:**
  - Keep the step words, or use a check icon.
  - Add a menu button.
  - Make every target at least 44 px.
  - Pin Publish to the bottom on phone.

### 9. Empty time boxes look filled in, in dark mode · found by 2 of 8
- **What happens:** "Pick a time" is as bright as a real answer.
- **Fix:** move the hint under the label, or make the hint text clearly dimmer than real answers.

### 10. Setting a ready job back to draft after people signed up isn't designed · found by 2 of 8
- **What happens:** their shift would disappear from their view, but reminders would still go out.
- **Recommended:** block it while anyone is signed up, with a reason, the same way deleting a shift is handled.

### 11. Required states and sub-flows aren't designed yet · found by 2 of 8
- **States:**
  - field errors
  - "Saving…" and "Couldn't save"
  - publish failed
  - zero ready jobs
  - after the event
- **Sub-flows the main path needs:**
  - the shift editor
  - the things-to-bring job editor
  - "Add a lead" on a new event, which needs an invite from inside the job, because the team is empty
- **Copy jobs and Import:** these are new features, not buttons. Hide Import until it exists. Build Copy first, and have copied jobs arrive as drafts.

## Should fix (severity 2)

- **Delete only blocked in one place:** the app refuses to delete a shift with sign-ups, but the database would allow it (and would silently remove the sign-ups). Enforce it in the database. *Checked in code.*
- **Two meanings of "draft":** one is an event that isn't published, the other is a job that's hidden. Label job badges differently, for example "Hidden · needs a shift".
- **Sample numbers contradict each other:** "2 of 4 filled" before publishing, then "0 of 24" after. Fix the mock-up data, and decide whether organizers can fill shifts before publishing.
- **Type picker cards:** they don't look tappable, the conferences card looks pre-selected, the badge is cut off on desktop, and the lock icon is on one card only. The picker shows 4 of the 7 event types.
- **Two people editing one job:** the last save silently wins.
- **Long job lists:** a fall festival has 20–40 jobs. Past about 6, use a list or a dropdown.
- **Edit and Delete alignment:** they jump around from row to row in narrow columns.
- **Preview banner:** it scrolls away. Pin it, and keep its weight the same in both themes.
- **Faint dashed borders in dark mode:** about 1.5:1 contrast. Use the field-border color.
- **The stepper and pills are a new pattern:** either update DESIGN.md to make them the standard, or build them from the existing setup pieces.
- **Details step:**
  - it can't save half-done
  - "Where" is one box, but the app stores name, address, and map separately
  - there's no option for an event that ends on a different day
  - the time zone should default from the account, not the browser
- **The live page could do more:** add "Copy a message" for group texts, and "What happens next".
- **No measures:** decide what we'll count before building.
- **The type picker subheading is wrong:** it says the type can change "until people start signing up". Conferences can never change type, and volunteer sign-ups don't lock the type.
- **Plan check skipped when changing type:** changing the type of a published event skips the plan check. This is a real gap in the current app, raised by the Engineer.

## Polish (severity 1)

- **Header name:** it says "FIELD COMMAND". Read the name from brand.ts instead ("Field Command Events").
- **Vague links:** "Finish it" and "Preview" on the live page.
- **Item counts on the preview:** "cookies (0 of 6)" is unclear. Say "6 needed" instead.
- **Small wording fixes:** the Content Manager has exact rewrites for each.

## What's working well

- **Honest plan warning up front:** "set up now, publish with a plan", and "Everything you set up here is saved".
- **Draft marking:** drafts are marked three ways (icon, words, and dashed outline), and the preview is hard to mistake for the real page.
- **"When you publish":** especially "Nobody is emailed".
- **Disabled actions explain themselves:** "2 boxes left: Starts and Ends", "What's left: add a shift".
- **"Start from a past event"** is in the right place.
- **Phone job picker:** it becomes a labeled dropdown.
- **Contrast:** all text contrast measured passes in both modes.
- **Already in the database:** publishing rules, one conference at a time, published events staying live, and "keep sign-up closed".

## Disagreements

- **"Keep sign-up closed" at publish:** keep it with a button that changes (most reviewers), or move it to Event settings (Product Manager).
- **Partial save on Details:** let it save half-done (consultant, UX Designer), or keep the details in the browser until publish (Engineer).

## Review coverage

Only the UI Designer opened all 48 screenshots. The others opened 20–29, mostly skipping tablet and dark. Dark-mode findings from more than one reviewer (disabled buttons, empty boxes) were checked by the UI Designer across every width. The routine now asks for full coverage from the UI Designer and the consultant, and a minimum set from everyone else.

## Limits

This is an AI review of a static mock-up, not testing with real people. Before launch, try the rebuilt flow with a PTO president and a teacher.
